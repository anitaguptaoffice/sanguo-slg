package api

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
)

func TestPGPreparedRecruitRuntime(t *testing.T) {
	pool, observer, binding, full := returnPGFixture(t, new(returnPGTrace))
	ctx := returnPGContext(t)
	profile := recruitSourceProjection(full, recruitPGNames)
	military := recruitSourceProjection(full, recruitPGNames[20:])
	catalog := recruitAttemptPGCatalog(t)
	returnPGExec(t, ctx, observer, "SELECT setval('work_queue_id_seq',100,false)")
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	const session = "00000000-0000-0000-0000-000000000001"
	start := func() (*Server, *websocket.Conn, func()) {
		t.Helper()
		s := NewServer(log, pool, nil, nil, nil)
		absent := s.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: routeRecruitTroopV2})
		if absent.GetMsg() != "unknown route" {
			t.Fatal("Recruit V2 exposed before prepared startup", absent)
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
		s.BindSessionForTest(session, PlayerContext{ServerID: 1, PlayerID: 1, AccountID: 1})
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
	_, ws, stopFirst := start()
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
	unpaid := returnPGSnapshot(t, ctx, observer, profile)
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
	restarted, nextWS, stopNext := start()
	defer stopNext()
	ws = nextWS
	replay := send(routeRecruitTroopV2, session, "replayed", 1, payload, true)
	want, err := recruitV2Response("replayed", recruitAttemptResult{outcome: recruitConfirmed, confirmed: accepted})
	returnPGOK(t, err)
	if replay.GetCode() != 0 || !bytes.Equal(replay.GetData(), want.GetData()) ||
		!reflect.DeepEqual(paid, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("fresh runtime replay changed receipt, wallet or queue", replay)
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
	if !reflect.DeepEqual(paid, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("early worker pass changed persisted state")
	}
	advancePaidRecruitSchedules(t, ctx, observer, profile, restarted.preparedRecruit, &accepted)
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
	stopWorker()
	select {
	case <-done:
	case <-ctx.Done():
		t.Fatal("prepared worker did not stop")
	}
	if got := send(routeRecruitTroopV2, session, "closed", 1, payload, true); got.GetCode() != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
		t.Fatal("retired source still admitted operations", got)
	}
}
