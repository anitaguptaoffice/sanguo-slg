package api

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

func TestPGPreparedRecruitRuntime(t *testing.T) {
	pool, observer, binding, full := returnPGFixture(t, new(returnPGTrace))
	ctx := returnPGContext(t)
	profile := recruitSourceProjection(full, recruitPGNames)
	military := recruitSourceProjection(full, recruitPGNames[20:])
	catalog := recruitAttemptPGCatalog(t)
	returnPGExec(t, ctx, observer, "SELECT setval('work_queue_id_seq',100,false)")
	productionDDL, err := os.ReadFile("../../spec/db/007_domestic_production_checkpoint.sql")
	returnPGOK(t, err)
	returnPGExec(t, ctx, observer, string(productionDDL))
	returnPGExec(t, ctx, observer, `INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE
 VALUES(2,'foreign-fixture','not-a-credential');
 INSERT INTO account_session(session_id,account_id,expires_at) VALUES('00000000-0000-0000-0000-000000000002',2,'2030-01-01');
 INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,2,2,'foreign fixture');
 INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,2,1,'empty city',1,0);
 INSERT INTO city_production_checkpoint(server_id,city_id,player_id,settled_at) VALUES(1,1,1,'2026-01-01'),(1,2,1,'2026-01-01');
 INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id) VALUES(1,1,'hall',1);
 INSERT INTO mil_city_origin SELECT server_id,2,owner_player_id,cohort_id,format_version,created_at FROM mil_city_origin WHERE city_id=1;
 INSERT INTO city_troop SELECT 1,2,u,0,u FROM generate_series(1,4) u;
 UPDATE work_queue SET status=2 WHERE server_id=1 AND queue_id=1 AND queue_type=1`)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	const (
		session        = "00000000-0000-0000-0000-000000000001"
		foreignSession = "00000000-0000-0000-0000-000000000002"
	)
	start := func(checkLegacy bool) (*Server, *websocket.Conn, func()) {
		t.Helper()
		now := func() time.Time { return time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC) }
		hub := domestic.NewHub(now)
		hub.UseStore(domestic.NewPGStore(pool), 1, 0)
		s := NewServer(log, pool, world.NewService(world.NewPGStore(pool)), hub, march.NewHub(now))
		absent := s.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: routeRecruitTroopV2})
		if absent.GetMsg() != "unknown route" {
			t.Fatal("Recruit V2 exposed before prepared startup", absent)
		}
		if checkLegacy {
			s.BindSession(session, 1, 1, 1)
			got := s.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: RouteGetCityState,
				SessionId: session, ServerId: 1, Payload: mustProto(&domesticv1.GetCityStateRequest{CityId: 1})})
			var state domesticv1.GetCityStateResponse
			returnPGOK(t, unmarshal(got.GetData(), &state))
			if got.GetCode() != 0 || state.GetGarrison() == nil || state.GetRecruitQueue() != nil {
				t.Fatal("legacy request acquired prepared queue authority", got, &state)
			}
		}
		owner, err := binding.Begin(ctx)
		returnPGOK(t, err)
		t.Cleanup(func() { _, _ = rollbackRecruitValidation(owner) })
		fresh, err := march.NewFreshCityParticipant(ctx, binding, owner.Access(), military)
		returnPGOK(t, err)
		recruit, err := march.NewRecruitParticipant(ctx, binding, owner.Access(), military, catalog)
		returnPGOK(t, err)
		returnPGOK(t, owner.Rollback(ctx))
		durable, err := NewMilitaryDurable(binding, military, recruit, fresh)
		returnPGOK(t, err)
		s.AttachMilitaryDurable(durable)
		s.WireFirstCityPreparedCreation(&FirstCityPreparedCreationSource{Binding: binding, Profile: military, Mil: fresh})
		foreign := profile
		foreign.Cohort[0]++
		if err = s.WirePreparedRecruit(ctx, foreign, catalog); err == nil || s.preparedRecruit != nil {
			t.Fatal("foreign startup profile installed a source")
		}
		returnPGOK(t, s.WirePreparedRecruit(ctx, profile, catalog))
		if s.WirePreparedRecruit(ctx, profile, catalog) == nil || s.PublicRoutes()[routeRecruitTroopV2] {
			t.Fatal("prepared runtime is replaceable or makes Recruit public")
		}
		s.BindSession(session, 1, 1, 1)
		s.BindSession(foreignSession, 1, 2, 2)
		// Deliberately disagree with the committed source and test no fallback.
		s.SeedCityTroopsForTest(1, 1, 777)
		s.SeedCityTroopsForTest(2, 1, 777)
		cfg := gateway.DefaultConfig()
		cfg.PublicRoutes = s.PublicRoutes()
		handler := gateway.NewServer(log, cfg, gateway.AccessControl{}, account.SessionValidator{Svc: s.AccountService()}, s.GatewayRouter())
		httpServer := httptest.NewServer(handler.Handler())
		t.Cleanup(httpServer.Close)
		ws, _, err := websocket.DefaultDialer.DialContext(ctx, "ws"+strings.TrimPrefix(httpServer.URL, "http"), nil)
		returnPGOK(t, err)
		t.Cleanup(func() { _ = ws.Close() })
		deadline, _ := ctx.Deadline()
		returnPGOK(t, ws.SetReadDeadline(deadline))
		returnPGOK(t, ws.SetWriteDeadline(deadline))
		closeSource := func() {
			t.Helper()
			_ = ws.Close()
			httpServer.Close()
			returnPGOK(t, s.preparedRecruit.close())
			returnPGOK(t, s.preparedRecruit.s.admission.waitDrained(ctx))
		}
		return s, ws, closeSource
	}
	_, ws, stopFirst := start(true)
	key := march.RecruitCommandID{9}
	payload, err := marshal(&militaryv1.RecruitTroopV2Request{
		CityId: 1, UnitCfgId: 3, Count: 2, CommandId: key[:], IntentVersion: 1,
	})
	returnPGOK(t, err)
	send := func(route, token, trace string, shard int32, data []byte, read bool) *commonv1.ServerPacket {
		t.Helper()
		raw, err := marshal(&commonv1.ClientPacket{Route: route, SessionId: token, TraceId: trace, ServerId: shard, Payload: data})
		returnPGOK(t, err)
		returnPGOK(t, ws.WriteMessage(websocket.BinaryMessage, raw))
		if !read {
			return nil
		}
		kind, response, err := ws.ReadMessage()
		returnPGOK(t, err)
		reply := &commonv1.ServerPacket{}
		returnPGOK(t, unmarshal(response, reply))
		if kind != websocket.BinaryMessage || reply.GetTraceId() != trace {
			t.Fatal("incorrect gateway acknowledgement envelope", reply)
		}
		return reply
	}
	readCity := func(token string, shard int32, city int64, code commonv1.ErrorCode) *domesticv1.GetCityStateResponse {
		t.Helper()
		req := mustProto(&domesticv1.GetCityStateRequest{CityId: city})
		reply := send(RouteGetCityState, token, "get-city", shard, req, true)
		if reply.GetCode() != int32(code) || code != 0 && len(reply.GetData()) != 0 {
			t.Fatal("unexpected garrison route result", reply)
		}
		out := new(domesticv1.GetCityStateResponse)
		if code == 0 {
			returnPGOK(t, unmarshal(reply.GetData(), out))
		}
		return out
	}
	readyCity := func(unitThree int32, food int64) *domesticv1.CurrentRecruitQueue {
		t.Helper()
		got := readCity(session, 1, 1, 0)
		expected := &domesticv1.CityGarrisonSnapshot{Troops: []*domesticv1.ReadyTroopCount{
			{UnitCfgId: 1, Count: 11}, {UnitCfgId: 2, Count: 12}, {UnitCfgId: 3, Count: unitThree}, {UnitCfgId: 4, Count: 14},
		}}
		if !proto.Equal(got.GetGarrison(), expected) || got.GetWallet().GetFood() != food ||
			len(got.GetBuildings()) != 1 || got.GetBuildings()[0].GetSlotKey() != "hall" || got.GetProductionRates() == nil {
			t.Fatal("garrison, wallet or existing city fields differ from committed state", got)
		}
		return got.GetRecruitQueue()
	}
	empty := readCity(session, 1, 2, 0)
	if empty.GetGarrison() == nil || len(empty.GetGarrison().GetTroops()) != 0 {
		t.Fatal("valid all-zero ready stock did not encode as present-empty", empty)
	}
	emptyQueue := &domesticv1.CurrentRecruitQueue{}
	if !proto.Equal(empty.GetRecruitQueue(), emptyQueue) {
		t.Fatal("known empty queue did not round-trip with presence", empty)
	}
	unpaid := returnPGSnapshot(t, ctx, observer, profile)
	readCity(foreignSession, 1, 1, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND)
	readCity(session, 2, 1, commonv1.ErrorCode_COMMON_INVALID_PACKET)
	if got := send(routeRecruitTroopV2, "", "guest", 1, payload, true); got.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAUTHORIZED) {
		t.Fatal("missing authenticated session", got)
	}
	if got := send(routeRecruitTroopV2, session, "wrong-shard", 2, payload, true); got.GetCode() != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) {
		t.Fatal("mismatched shard reached durable admission", got)
	}
	for _, route := range []string{RouteCreateCity, RouteRecruitTroop, RouteStartMarch} {
		if got := send(route, session, "legacy", 1, payload, true); got.GetMsg() != "unknown route" {
			t.Fatal("incompatible legacy writer was reachable", route, got)
		}
	}
	if !reflect.DeepEqual(unpaid, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("rejected gateway operations wrote to the source")
	}
	send(routeRecruitTroopV2, session, "unobserved", 1, payload, false)
	proof, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	poll := time.NewTicker(5 * time.Millisecond)
	defer poll.Stop()
	for {
		var committed bool
		returnPGOK(t, observer.QueryRow(proof, "SELECT EXISTS(SELECT FROM mil_recruit_receipt WHERE queue_id=100)").Scan(&committed))
		if committed {
			break
		}
		select {
		case <-proof.Done():
			t.Fatal("server did not commit the submitted command")
		case <-poll.C:
		}
	}
	stopFirst() // The first client closes without ever reading its response.
	accepted := recruitAttemptPGObserved(t, ctx, observer)
	paid := returnPGSnapshot(t, ctx, observer, profile)
	restarted, nextWS, stopNext := start(false)
	defer stopNext()
	ws = nextWS
	replay := send(routeRecruitTroopV2, session, "replayed", 1, payload, true)
	want, err := recruitV2Response("replayed", recruitAttemptResult{outcome: recruitConfirmed, confirmed: accepted})
	returnPGOK(t, err)
	if replay.GetCode() != 0 || !bytes.Equal(replay.GetData(), want.GetData()) ||
		!reflect.DeepEqual(paid, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("fresh runtime replay changed receipt, wallet or queue", replay)
	}
	paidFood := int64(100) - accepted.Cost.Food
	assertActive := func(queue *domesticv1.CurrentRecruitQueue, finish time.Time) {
		t.Helper()
		want := &domesticv1.CurrentRecruitQueue{Jobs: []*domesticv1.CurrentRecruitJob{
			{QueueId: 100, UnitCfgId: 3, Count: 2, Status: 1, FinishAtMs: finish.UnixMilli()},
		}}
		if !proto.Equal(queue, want) {
			t.Fatal("unexpected persisted pending view", queue)
		}
	}
	assertActive(readyCity(13, paidFood), accepted.InitialFinishAt)
	pending := returnPGSnapshot(t, ctx, observer, profile)
	for _, relation := range []string{"city_troop", "work_queue", "mil_recruit_receipt"} {
		if paid[relation] != pending[relation] {
			t.Fatal("reading the pending garrison changed military state", relation)
		}
	}

	ticks, cadence := make(chan struct{}), make(chan struct{})
	done := make(chan struct{})
	workerCtx, stopWorker := context.WithCancel(ctx)
	defer stopWorker()
	go func() {
		defer close(done)
		restarted.runPreparedRecruitScheduler(workerCtx, func() bool {
			select {
			case cadence <- struct{}{}:
			case <-workerCtx.Done():
				return false
			}
			select {
			case <-ticks:
				return true
			case <-workerCtx.Done():
				return false
			}
		})
	}()
	finishedPass := func() {
		t.Helper()
		select {
		case <-cadence:
		case <-done:
			t.Fatal("prepared worker retired unexpectedly")
		case <-ctx.Done():
			t.Fatal("prepared worker did not reach its next cadence")
		}
	}
	tick := func() {
		t.Helper()
		select {
		case ticks <- struct{}{}:
			finishedPass()
		case <-ctx.Done():
			t.Fatal("prepared worker did not accept the next cadence")
		}
	}
	finishedPass()
	if !reflect.DeepEqual(pending, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("early worker pass changed persisted state")
	}
	advancePaidRecruitSchedules(t, ctx, observer, profile, restarted.preparedRecruit, &accepted)
	var elapsedFinish time.Time
	returnPGOK(t, observer.QueryRow(ctx, "SELECT finish_at FROM work_queue WHERE server_id=1 AND queue_id=100").Scan(&elapsedFinish))
	assertActive(readyCity(13, paidFood), elapsedFinish)
	advanced := returnPGSnapshot(t, ctx, observer, profile)
	tick()
	credited := returnPGSnapshot(t, ctx, observer, profile)
	for name, old := range advanced {
		if (old != credited[name]) != (name == "city_troop" || name == "work_queue") {
			t.Fatal("unexpected relation changed during due credit", name)
		}
	}
	var ready int32
	var status int16
	returnPGOK(t, observer.QueryRow(ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=3").Scan(&ready))
	returnPGOK(t, observer.QueryRow(ctx, "SELECT status FROM work_queue WHERE server_id=1 AND queue_id=100").Scan(&status))
	if ready != 15 || status != 2 {
		t.Fatal("expected exactly two new ready troops and a done job", ready, status)
	}
	tick()
	if !reflect.DeepEqual(credited, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("additional worker pass repeated the stock credit")
	}
	if !proto.Equal(readyCity(15, paidFood), emptyQueue) {
		t.Fatal("committed completion left a pending job")
	}
	stopWorker()
	select {
	case <-done:
	case <-ctx.Done():
		t.Fatal("prepared worker did not stop")
	}
	if got := send(routeRecruitTroopV2, session, "closed", 1, payload, true); got.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
		t.Fatal("retired source still admitted operations", got)
	}
	if retired := readCity(session, 1, 1, 0); retired.GetGarrison() != nil || retired.GetRecruitQueue() != nil {
		t.Fatal("retired prepared source exposed a stale or empty military view", retired)
	}
	_, ws, stopRestored := start(false)
	defer stopRestored()
	if !proto.Equal(readyCity(15, paidFood), emptyQueue) {
		t.Fatal("restored queue included terminal work")
	}
	militaryAfterRead := returnPGSnapshot(t, ctx, observer, profile)
	for _, relation := range []string{"city_troop", "work_queue", "mil_recruit_receipt"} {
		if credited[relation] != militaryAfterRead[relation] {
			t.Fatal("restored garrison read repeated a military effect", relation)
		}
	}
	returnPGExec(t, ctx, observer, "UPDATE work_queue SET status=1 WHERE server_id=1 AND queue_id=100 AND status=2; DELETE FROM mil_recruit_receipt WHERE server_id=1 AND queue_id=100")
	if readyCity(15, paidFood) != nil {
		t.Fatal("corrupt queue published authority or hid the valid garrison")
	}
	tag, err := observer.Exec(ctx, "DELETE FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=2")
	returnPGOK(t, err)
	if tag.RowsAffected() != 1 {
		t.Fatal("fixture did not remove the expected ready row")
	}
	if missing := readCity(session, 1, 1, 0).GetGarrison(); missing != nil {
		t.Fatal("incomplete evidence exposed a partial or cached garrison", missing)
	}
}
