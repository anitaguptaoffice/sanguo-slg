package api

import (
	"bytes"
	"context"
	"math"
	"reflect"
	"testing"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

func TestPGRecruitV2HandlerAdmissionAndReplay(t *testing.T) {
	observer, binding, profile := recruitPGFixture(t, new(returnPGTrace))
	ctx := returnPGContext(t)
	returnPGExec(t, ctx, observer, "SELECT setval('work_queue_id_seq',100,false)")
	catalog := recruitAttemptPGCatalog(t)
	start := func() (*recruitGeneration, *gateway.Router) {
		t.Helper()
		g, err := newRecruitGeneration(binding, profile, catalog)
		returnPGOK(t, err)
		returnPGOK(t, g.initialize(ctx))
		t.Cleanup(func() { returnPGOK(t, g.close()) })
		// These session bindings stand in for successful gateway authentication.
		s := &Server{sessions: NewSessionRegistry()}
		s.sessions.Bind("bound", PlayerContext{ServerID: 1, PlayerID: 1, AccountID: 1})
		s.sessions.Bind("missing-account", PlayerContext{ServerID: 1, PlayerID: 1})
		return g, gateway.NewRouter(map[string]gateway.RouteHandler{routeRecruitTroopV2: s.recruitV2Handler(g)})
	}
	first, router := start()
	request := func(id byte, version uint32, unit, count int32) []byte {
		t.Helper()
		key := [16]byte{id}
		data, err := marshal(&militaryv1.RecruitTroopV2Request{
			CityId: 1, UnitCfgId: unit, Count: count, CommandId: key[:], IntentVersion: version,
		})
		returnPGOK(t, err)
		return data
	}
	dispatch := func(router *gateway.Router, session, trace string, shard int32, data []byte) *commonv1.ServerPacket {
		t.Helper()
		raw, err := marshal(&commonv1.ClientPacket{Route: routeRecruitTroopV2, SessionId: session, TraceId: trace, ServerId: shard, Payload: data})
		returnPGOK(t, err)
		packet, err := gateway.DecodeClient(raw)
		returnPGOK(t, err)
		reply := router.Dispatch(context.Background(), packet) // Gateway context need not have a deadline.
		if reply.GetTraceId() != trace {
			t.Fatal("wrong reply trace", reply.GetTraceId())
		}
		return reply
	}
	requireError := func(router *gateway.Router, session string, shard int32, data []byte, code commonv1.ErrorCode) {
		t.Helper()
		got := dispatch(router, session, "reject", shard, data)
		if got.GetCode() != int32(code) || len(got.GetData()) != 0 {
			t.Fatal("wrong rejection or unexpected receipt", got)
		}
	}
	before := returnPGSnapshot(t, ctx, observer, profile)
	paid := request(9, 1, 3, 2)
	requireError(router, "absent", 1, paid, commonv1.ErrorCode_COMMON_UNAUTHORIZED)
	requireError(router, "missing-account", 1, paid, commonv1.ErrorCode_COMMON_UNAUTHORIZED)
	requireError(router, "bound", 2, paid, commonv1.ErrorCode_COMMON_INVALID_PACKET)
	requireError(router, "bound", 1, nil, commonv1.ErrorCode_COMMON_INVALID_PACKET)
	requireError(router, "bound", 1, []byte{0xff}, commonv1.ErrorCode_COMMON_INVALID_PACKET)
	requireError(router, "bound", 1, request(0, 1, 3, 2), commonv1.ErrorCode_COMMON_INVALID_PACKET)
	requireError(router, "bound", 1, request(9, math.MaxUint32, 3, 2), commonv1.ErrorCode_COMMON_INVALID_PACKET)
	requireError(router, "bound", 1, request(9, 1, 3, 0), commonv1.ErrorCode_MILITARY_INVALID_TROOP_COUNT)
	requireError(router, "bound", 1, request(9, 1, 5, 2), commonv1.ErrorCode_MILITARY_INVALID_UNIT)
	if !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("pre-admission rejections changed stored state")
	}
	reply := dispatch(router, "bound", "paid", 0, paid)
	var wire militaryv1.RecruitTroopV2Response
	returnPGOK(t, unmarshal(reply.GetData(), &wire))
	a := recruitAttemptPGObserved(t, ctx, observer)
	expected := &militaryv1.RecruitAcceptance{
		QueueId: 100, CityId: 1, UnitCfgId: 3, Count: 2, FoodPaid: 12, WoodPaid: 18, IronPaid: 30, StonePaid: 42,
		DurationSec: 66, InitialStatus: 1, AcceptedAtMs: a.AcceptedAt.UnixMilli(),
		InitialStartAtMs: a.InitialStartAt.UnixMilli(), InitialFinishAtMs: a.InitialFinishAt.UnixMilli(),
		CatalogVersion: []byte(recruitAttemptPGVersion), RuleDigest: a.RuleDigest[:],
	}
	if reply.GetCode() != 0 || !proto.Equal(wire.GetAcceptance(), expected) {
		t.Fatal("V2 receipt differs from independent observation", reply, &wire)
	}
	returnPGOK(t, first.close())
	returnPGOK(t, first.s.admission.waitDrained(ctx))
	_, restarted := start()
	// Fixture-only owner transfer. Historical replay must still work.
	returnPGExec(t, ctx, observer, "UPDATE player_city SET player_id=2 WHERE server_id=1 AND city_id=1")
	before = returnPGSnapshot(t, ctx, observer, profile)
	replay := dispatch(restarted, "bound", "replay", 1, paid)
	if replay.GetCode() != 0 || !bytes.Equal(replay.GetData(), reply.GetData()) {
		t.Fatal("fresh generation altered the immutable receipt", replay)
	}
	for _, version := range []uint32{0, 2, 32768, 65537, math.MaxUint32} {
		requireError(restarted, "bound", 1, request(9, version, 3, 2), commonv1.ErrorCode_MILITARY_RECRUIT_INTENT_CONFLICT)
	}
	if !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("replay or conflict changed stored state, wallet or allocator")
	}
	returnPGExec(t, ctx, observer, "UPDATE player_city SET player_id=1 WHERE server_id=1 AND city_id=1")
	before = returnPGSnapshot(t, ctx, observer, profile)
	requireError(restarted, "bound", 1, request(10, 1, 3, 100), commonv1.ErrorCode_MILITARY_INSUFFICIENT_RESOURCE)
	after := returnPGSnapshot(t, ctx, observer, profile)
	// The allocator may consume a number before the wallet debit rejects.
	delete(before, "work_queue_id_seq")
	delete(after, "work_queue_id_seq")
	if !reflect.DeepEqual(before, after) {
		t.Fatal("insufficient wallet changed rows")
	}
}
