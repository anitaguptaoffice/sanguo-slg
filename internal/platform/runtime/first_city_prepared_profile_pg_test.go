package runtime

import (
	"context"
	"io"
	"log/slog"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/config"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/shard"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

func preparedProfilePG(t *testing.T) (*pgxpool.Pool, freshsource.Profile) {
	t.Helper()
	t.Setenv("SANGUO_PG_REUSE_SPEC", "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	preparedCheck(t, api.EnsureFirstCityPreparedMilDDL(ctx, pool))
	p := milProfile()
	p.Objects = make(map[string]freshsource.ObjectIdentity)
	preparedCheck(t, pool.QueryRow(ctx, `SELECT d.datname,d.oid,n.nspname,n.oid,n.nspowner,current_user,r.oid,session_user,s.oid
 FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s
 WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`).Scan(
		&p.DatabaseName, &p.DatabaseOID, &p.SchemaName, &p.SchemaOID, &p.SchemaOwnerOID, &p.CurrentRoleName, &p.CurrentRoleOID, &p.SessionRoleName, &p.SessionRoleOID))
	names := append(append([]string(nil), militaryObjects...), strings.Fields(`map_cell map_cell_pkey player_city player_city_pkey player_city_server_id_x_y_key idx_player_city_owner player_city_id_seq
player_wallet player_wallet_pkey city_production_checkpoint city_production_checkpoint_pkey idx_city_production_player city_building city_building_pkey idx_city_building_cfg`)...)
	for _, name := range names {
		var identity freshsource.ObjectIdentity
		preparedCheck(t, pool.QueryRow(ctx, `SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2`,
			p.SchemaOID, name).Scan(&identity.OID, &identity.OwnerOID))
		p.Objects[name] = identity
	}
	cfg := pool.Config()
	cfg.ConnConfig.RuntimeParams["search_path"] = p.SchemaName
	runtimePool, err := pgxpool.NewWithConfig(ctx, cfg)
	preparedCheck(t, err)
	t.Cleanup(runtimePool.Close)
	return runtimePool, p
}

func preparedCheck(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func TestPGPreparedFirstCityRuntime(t *testing.T) {
	pool, p := preparedProfilePG(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	preparedCheck(t, db.SeedDevServer(ctx, pool, 1, "local-test"))
	cells := world.GenerateChunk(1, 0, 0)
	preparedCheck(t, world.NewPGStore(pool).SaveChunk(ctx, 1, cells))
	var x, y int32
	for _, cell := range cells {
		if cell.Buildable() && cell.X > 0 && cell.Y > 0 {
			x, y = int32(cell.X), int32(cell.Y)
			break
		}
	}
	if x == 0 {
		t.Fatal("fixture did not find a buildable cell")
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	cfg := config.Config{HTTPAddr: "127.0.0.1:0", PreparedFirstCity: true, MILFreshProfileFile: writeMilProfile(t, milFile(p))}
	missing := p
	missing.Objects = maps.Clone(p.Objects)
	delete(missing.Objects, "player_city")
	bad := cfg
	bad.MILFreshProfileFile = writeMilProfile(t, milFile(missing))
	nonlocal := cfg
	nonlocal.HTTPAddr = ":8080"
	recruitWithoutAccounts := cfg
	recruitWithoutAccounts.PreparedRecruit = true
	for _, invalid := range []config.Config{bad, nonlocal, recruitWithoutAccounts,
		{PreparedFirstCity: true, HTTPAddr: cfg.HTTPAddr}, {PreparedRecruit: true, HTTPAddr: cfg.HTTPAddr}} {
		if srv, err := (&App{Config: invalid, Log: log, DB: pool}).NewAPIServer(ctx); srv != nil || err == nil {
			t.Fatal("requested prepared mode fell back to a legacy server")
		}
	}
	observer, err := pool.Acquire(ctx)
	preparedCheck(t, err)
	defer observer.Release()
	app := &App{Config: cfg, Log: log, DB: pool}
	start := func() (*websocket.Conn, func()) {
		t.Helper()
		runCtx, stop := context.WithCancel(ctx)
		t.Cleanup(stop)
		srv, err := app.NewAPIServer(runCtx)
		preparedCheck(t, err)
		var stopRecruit func() error
		if app.Config.PreparedRecruit {
			stopRecruit = startPreparedRecruitWorker(runCtx, srv.RunPreparedRecruitScheduler)
			t.Cleanup(func() { preparedCheck(t, stopRecruit()) })
		}
		handler := app.HTTPHandler(runCtx, srv)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/gm/grant", nil))
		if rr.Code != http.StatusNotFound {
			t.Fatalf("GM writer available in prepared mode: %d", rr.Code)
		}
		httpSrv := httptest.NewServer(handler)
		t.Cleanup(httpSrv.Close)
		const protocol = "sanguo.recruit-v2"
		dialer := *websocket.DefaultDialer
		dialer.Subprotocols = []string{protocol}
		ws, _, err := dialer.DialContext(runCtx, "ws"+strings.TrimPrefix(httpSrv.URL, "http")+"/ws", nil)
		preparedCheck(t, err)
		t.Cleanup(func() { _ = ws.Close() })
		wantProtocol := ""
		if app.Config.PreparedRecruit {
			wantProtocol = protocol
		}
		if ws.Subprotocol() != wantProtocol {
			t.Fatalf("prepared runtime negotiated %q, want %q", ws.Subprotocol(), wantProtocol)
		}
		closeRuntime := func() {
			stop()
			_ = ws.Close()
			httpSrv.Close()
			if stopRecruit != nil {
				preparedCheck(t, stopRecruit())
			}
		}
		t.Cleanup(closeRuntime)
		deadline, _ := runCtx.Deadline()
		preparedCheck(t, ws.SetReadDeadline(deadline))
		preparedCheck(t, ws.SetWriteDeadline(deadline))
		return ws, closeRuntime
	}
	ws, stop := start()
	var session string
	send := func(route string, in, out proto.Message) *commonv1.ServerPacket {
		t.Helper()
		payload, err := proto.Marshal(in)
		preparedCheck(t, err)
		packet, err := proto.Marshal(&commonv1.ClientPacket{Route: route, Payload: payload, SessionId: session, ServerId: 1, TraceId: route})
		preparedCheck(t, err)
		preparedCheck(t, ws.WriteMessage(websocket.BinaryMessage, packet))
		kind, raw, err := ws.ReadMessage()
		preparedCheck(t, err)
		reply := new(commonv1.ServerPacket)
		preparedCheck(t, proto.Unmarshal(raw, reply))
		if kind != websocket.BinaryMessage || reply.GetTraceId() != route || out != nil && reply.GetCode() != 0 {
			t.Fatalf("%s response %v", route, reply)
		}
		if out != nil {
			preparedCheck(t, proto.Unmarshal(reply.GetData(), out))
		}
		return reply
	}
	login := func() {
		var login accountv1.LoginResponse
		send(account.RouteLogin, &accountv1.LoginRequest{LoginName: "localprepared", Password: "local-test-only", ServerId: 1}, &login)
		session = login.GetSessionId()
		var entry accountv1.EnterGameServerResponse
		send(shard.RouteEnterGameServer, &accountv1.EnterGameServerRequest{ServerId: 1}, &entry)
		session = entry.GetSessionId()
	}
	send(account.RouteRegister, &accountv1.RegisterRequest{LoginName: "localprepared", Password: "local-test-only"}, &accountv1.RegisterResponse{})
	login()
	var discover worldv1.DiscoverFirstCityIntentResponse
	send(api.RouteDiscoverFirstCityIntent, &worldv1.DiscoverFirstCityIntentRequest{}, &discover)
	proposal := &worldv1.FirstCityProposal{CommandId: "1b33bef2-d2ff-4a94-aad4-539de52e58de", Name: proto.String("Demo City"),
		X: &x, Y: &y, Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}}}
	var submitted worldv1.SubmitFirstCityResponse
	send(api.RouteSubmitFirstCity, &worldv1.SubmitFirstCityRequest{ExpectedScope: discover.GetScope(), Proposal: proposal}, &submitted)
	city := submitted.GetOutcome().GetCommand().GetSucceeded().GetCityId()
	if city <= 0 {
		t.Fatalf("prepared city did not settle: %v", &submitted)
	}
	for _, route := range []string{api.RouteCreateCity, api.RouteRecruitTroop, api.RouteStartMarch} {
		if reply := send(route, nil, nil); reply.GetMsg() != "unknown route" {
			t.Fatalf("legacy writer available: %s", route)
		}
	}
	stop()
	ws, stop = start()
	session = ""
	login()
	var result worldv1.GetFirstCityResultResponse
	send(api.RouteGetFirstCityResult, &worldv1.GetFirstCityResultRequest{ExpectedScope: discover.GetScope(), CommandId: proposal.CommandId}, &result)
	var exact bool
	preparedCheck(t, observer.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_city)=1
 AND EXISTS(SELECT FROM mil_city_origin WHERE server_id=1 AND owner_player_id=$1 AND city_id=$2 AND cohort_id=$3 AND format_version=1)
 AND (SELECT array_agg(unit_cfg_id ORDER BY unit_cfg_id)=ARRAY[1,2,3,4] AND bool_and(count=0 AND wounded=0)
      FROM city_troop WHERE server_id=1 AND city_id=$2)
 AND (SELECT count(*) FROM world_first_city_command WHERE durable_state=2)=1`,
		discover.GetScope().GetPlayerId(), city, p.Cohort[:]).Scan(&exact))
	if !exact || !proto.Equal(submitted.GetOutcome().GetCommand(), result.GetOutcome().GetCommand()) {
		t.Fatal("fresh runtime did not retain the exact prepared city and receipt")
	}
	const recruitRoute = "military.v1.RecruitTroopV2"
	if got := send(recruitRoute, nil, nil); got.GetMsg() != "unknown route" {
		t.Fatal("first-city opt-in exposed Recruit by itself", got)
	}
	stop()
	// Extend only the reviewed owned source. Use an independent object inventory.
	for _, name := range strings.Fields("account account_pkey uq_account_login_name account_account_id_seq account_session account_session_pkey idx_account_session_account player player_pkey uq_player_account_per_server idx_player_account") {
		var identity freshsource.ObjectIdentity
		preparedCheck(t, observer.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2",
			p.SchemaOID, name).Scan(&identity.OID, &identity.OwnerOID))
		p.Objects[name] = identity
	}
	app.Config.PreparedRecruit = true
	app.Config.MILFreshProfileFile = writeMilProfile(t, milFile(p))
	ws, stop = start()
	session = ""
	login()
	player := discover.GetScope().GetPlayerId()
	wallet := func() int64 {
		t.Helper()
		var food int64
		preparedCheck(t, observer.QueryRow(ctx, "SELECT food FROM player_wallet WHERE server_id=1 AND player_id=$1", player).Scan(&food))
		return food
	}
	before := wallet()
	const count int32 = 120
	intent := &militaryv1.RecruitTroopV2Request{CityId: city, UnitCfgId: 1, Count: count,
		CommandId: []byte("prepared-recruit"), IntentVersion: 1}
	var accepted militaryv1.RecruitTroopV2Response
	send(recruitRoute, intent, &accepted)
	a := accepted.GetAcceptance()
	if a.GetQueueId() <= 0 || a.GetCityId() != city || a.GetCount() != count ||
		a.GetFoodPaid() != int64(count) || wallet() != before-int64(count) {
		t.Fatalf("wrong prepared admission or debit: %v", &accepted)
	}
	stop()
	ws, stop = start()
	session = ""
	login()
	var replay militaryv1.RecruitTroopV2Response
	send(recruitRoute, intent, &replay)
	if !proto.Equal(&replay, &accepted) || wallet() != before-int64(count) {
		t.Fatal("restart replay changed the immutable acceptance or paid again")
	}
	stop()

	// Advance only the fixture-owned schedule and its paired initial evidence.
	tx, err := observer.Begin(ctx)
	preparedCheck(t, err)
	defer func() { _ = tx.Rollback(ctx) }()
	args := []any{a.GetQueueId(), player, city, a.GetInitialStartAtMs(), a.GetInitialFinishAtMs(), a.GetAcceptedAtMs()}
	tag, err := tx.Exec(ctx, `WITH moved AS (
 UPDATE work_queue SET start_at=start_at-interval '1 hour',finish_at=finish_at-interval '1 hour'
 WHERE server_id=1 AND queue_id=$1 AND player_id=$2 AND city_id=$3 AND queue_type=3 AND status=1
 AND start_at=to_timestamp($4::bigint/1000.0) AND finish_at=to_timestamp($5::bigint/1000.0) RETURNING queue_id)
 UPDATE mil_recruit_receipt SET accepted_at=accepted_at-interval '1 hour',
 initial_start_at=initial_start_at-interval '1 hour',initial_finish_at=initial_finish_at-interval '1 hour'
 WHERE server_id=1 AND queue_id IN (SELECT queue_id FROM moved) AND city_id=$3
 AND accepted_at=to_timestamp($6::bigint/1000.0)
 AND initial_start_at=to_timestamp($4::bigint/1000.0) AND initial_finish_at=to_timestamp($5::bigint/1000.0)`, args...)
	preparedCheck(t, err)
	if tag.RowsAffected() != 1 {
		t.Fatal("time fixture did not advance the exact owned job")
	}
	preparedCheck(t, tx.Commit(ctx))
	ws, stop = start() // The real scheduler scans already-due work at startup.
	wait, cancelWait := context.WithTimeout(ctx, 5*time.Second)
	defer cancelWait()
	poll := time.NewTicker(10 * time.Millisecond)
	defer poll.Stop()
	for {
		var settled bool
		preparedCheck(t, observer.QueryRow(wait, `SELECT
 (SELECT count FROM city_troop WHERE server_id=1 AND city_id=$1 AND unit_cfg_id=1)=$2
 AND (SELECT status FROM work_queue WHERE server_id=1 AND queue_id=$3)=2
 AND (SELECT count(*) FROM work_queue WHERE server_id=1 AND queue_type=3)=1
 AND (SELECT count(*) FROM mil_recruit_receipt)=1`, city, count, a.GetQueueId()).Scan(&settled))
		if settled {
			break
		}
		select {
		case <-wait.Done():
			t.Fatal("prepared startup worker did not apply exactly one due credit")
		case <-poll.C:
		}
	}
	if wallet() != before-int64(count) {
		t.Fatal("due processing debited the wallet again")
	}
	stop()

	// Hold the actual due worker inside its PostgreSQL read while the runtime stops.
	gate := &preparedDueStopTrace{entered: make(chan struct{}), canceled: make(chan struct{}), release: make(chan struct{})}
	cfgWithTrace := pool.Config()
	cfgWithTrace.ConnConfig.Tracer = gate
	traced, err := pgxpool.NewWithConfig(ctx, cfgWithTrace)
	preparedCheck(t, err)
	defer traced.Close()
	workerCtx, cancelWorker := context.WithCancel(ctx)
	defer cancelWorker()
	app.DB = traced
	srv, err := app.NewAPIServer(workerCtx)
	preparedCheck(t, err)
	stopWorker := startPreparedRecruitWorker(workerCtx, srv.RunPreparedRecruitScheduler)
	released := false
	defer func() {
		if !released {
			close(gate.release)
			preparedCheck(t, stopWorker())
		}
	}()
	preparedCheck(t, waitPreparedShutdown(gate.entered, 5*time.Second, "worker did not reach its due read"))
	stopped := make(chan error, 1)
	go func() { stopped <- stopWorker() }()
	preparedCheck(t, waitPreparedShutdown(gate.canceled, 5*time.Second, "worker did not see cancellation"))
	select {
	case err := <-stopped:
		t.Fatalf("worker stop returned before the due read was released: %v", err)
	default:
	}
	close(gate.release)
	released = true
	select {
	case err := <-stopped:
		preparedCheck(t, err)
	case <-ctx.Done():
		t.Fatal("worker did not exit after the due read was released")
	}
}

type preparedDueStopTrace struct {
	entered, canceled, release chan struct{}
}

func (g *preparedDueStopTrace) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if data.SQL == "SELECT pg_catalog.clock_timestamp()" {
		close(g.entered)
		<-ctx.Done()
		close(g.canceled)
		<-g.release
	}
	return ctx
}

func (*preparedDueStopTrace) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}
