package api

import (
	"context"
	"errors"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"google.golang.org/protobuf/proto"
)

const (
	testFirstCityRealmUUID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
	testFirstCityCommand   = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
)

type fixedTemplateIntake struct {
	ref *worldv1.FirstCityTemplateRef
}

func (f fixedTemplateIntake) SelectTemplate(context.Context, *worldv1.FirstCityScope) (*worldv1.FirstCityTemplateRef, error) {
	if f.ref == nil {
		return nil, errors.New("no template")
	}
	return f.ref, nil
}

func testFirstCityScope() *worldv1.FirstCityScope {
	return &worldv1.FirstCityScope{RealmId: testFirstCityRealmUUID, ServerId: 1, PlayerId: 9, AccountId: 8}
}

func testFirstCityProposal() *worldv1.FirstCityProposal {
	return &worldv1.FirstCityProposal{
		CommandId:   testFirstCityCommand,
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name:        proto.String("新城"),
		X:           proto.Int32(12),
		Y:           proto.Int32(34),
	}
}

func testFirstCityPending(t *testing.T) *worldv1.FirstCityRecord {
	t.Helper()
	canon, err := firstCityCanonicalMessage(testFirstCityScope(), testFirstCityProposal())
	if err != nil {
		t.Fatal(err)
	}
	return &worldv1.FirstCityRecord{
		Canonical: canon,
		Template:  FirstCityTemplateRef("DATA-002"),
		State:     &worldv1.FirstCityRecord_Pending{Pending: &worldv1.FirstCityEmpty{}},
	}
}

func TestMemFirstCityLedgerSettle(t *testing.T) {
	ledger := NewMemFirstCityLedger()
	scope := testFirstCityScope()
	ctx := context.Background()
	pending := testFirstCityPending(t)
	if err := ledger.IntakePending(ctx, scope, pending); err != nil {
		t.Fatalf("intake: %v", err)
	}
	if head, err := ledger.Head(scope); err != nil || head.GetCommand().GetPending() == nil {
		t.Fatalf("head after intake: %v %+v", err, head)
	}
	succeeded := &worldv1.FirstCityRecord{
		Canonical: pending.GetCanonical(), Template: pending.GetTemplate(),
		State: &worldv1.FirstCityRecord_Succeeded{Succeeded: &worldv1.FirstCitySuccess{CityId: 77, ServerId: 1, PlayerId: 9}},
	}
	if err := ledger.Settle(ctx, scope, testFirstCityCommand, succeeded); err != nil {
		t.Fatalf("settle: %v", err)
	}
	head, err := ledger.Head(scope)
	if err != nil {
		t.Fatal(err)
	}
	if got := head.GetCommand().GetSucceeded().GetCityId(); got != 77 {
		t.Fatalf("head city id = %d", got)
	}
	if err := ledger.Settle(ctx, scope, testFirstCityCommand, succeeded); !errors.Is(err, errFirstCityHeadConflict) {
		t.Fatalf("second settle = %v, want head conflict", err)
	}
	other := proto.Clone(succeeded).(*worldv1.FirstCityRecord)
	other.GetCanonical().GetProposal().CommandId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
	if err := ledger.Settle(ctx, scope, testFirstCityCommand, other); err == nil {
		t.Fatal("settle with a different canonical intent succeeded")
	}
}

type stubEffect struct {
	cityID int64
	reason worldv1.FirstCityRejectionReason
	err    error
	calls  int
}

func (s *stubEffect) Create(context.Context, *worldv1.FirstCityScope, *worldv1.FirstCityProposal) (int64, worldv1.FirstCityRejectionReason, error) {
	s.calls++
	return s.cityID, s.reason, s.err
}

func TestSettleFirstCityEffect(t *testing.T) {
	newServer := func(effect FirstCityV2Effect) *Server {
		s := NewServer(nil, nil, nil, nil, nil)
		s.WireFirstCityV2Ledger(NewMemFirstCityLedger(), fixedTemplateIntake{ref: FirstCityTemplateRef("DATA-002")})
		s.WireFirstCityV2Effect(effect)
		if err := s.firstCityV2Ledger.IntakePending(context.Background(), testFirstCityScope(), testFirstCityPending(t)); err != nil {
			t.Fatal(err)
		}
		return s
	}
	t.Run("succeeded", func(t *testing.T) {
		s := newServer(&stubEffect{cityID: 41})
		settled := s.settleFirstCityEffect(context.Background(), testFirstCityScope(), testFirstCityPending(t))
		if got := settled.GetSucceeded().GetCityId(); got != 41 {
			t.Fatalf("city id = %d", got)
		}
		if !settled.GetSucceeded().GetIsCapital() || settled.GetSucceeded().GetWallLevel() != 1 || settled.GetSucceeded().GetMorale() != 100 {
			t.Fatalf("starter flags = %+v", settled.GetSucceeded())
		}
		head, err := s.firstCityV2Ledger.Head(testFirstCityScope())
		if err != nil || head.GetCommand().GetSucceeded() == nil {
			t.Fatalf("head not settled: %v %+v", err, head)
		}
	})
	t.Run("typed rejection", func(t *testing.T) {
		s := newServer(&stubEffect{reason: worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_COORDINATE_OCCUPIED})
		settled := s.settleFirstCityEffect(context.Background(), testFirstCityScope(), testFirstCityPending(t))
		if got := settled.GetRejectedNoEffect().GetReason(); got != worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_COORDINATE_OCCUPIED {
			t.Fatalf("rejection = %v", got)
		}
		head, _ := s.firstCityV2Ledger.Head(testFirstCityScope())
		if head.GetCommand().GetRejectedNoEffect() == nil {
			t.Fatalf("head not rejected: %+v", head)
		}
	})
	t.Run("unknown outcome stays pending", func(t *testing.T) {
		s := newServer(&stubEffect{err: errors.New("commit unknown")})
		settled := s.settleFirstCityEffect(context.Background(), testFirstCityScope(), testFirstCityPending(t))
		if settled.GetPending() == nil {
			t.Fatalf("settled despite unknown outcome: %+v", settled.State)
		}
	})
	t.Run("no effect", func(t *testing.T) {
		s := NewServer(nil, nil, nil, nil, nil)
		settled := s.settleFirstCityEffect(context.Background(), testFirstCityScope(), testFirstCityPending(t))
		if settled.GetPending() == nil {
			t.Fatalf("settled without an effect: %+v", settled.State)
		}
	})
}

func TestFirstCitySubmitCreatesCityPG(t *testing.T) {
	s, pool, _, _ := registrationServer(t)
	ctx := context.Background()
	var accountID int64
	if err := pool.QueryRow(ctx, "SELECT account_id FROM player WHERE server_id=1 AND player_id=55").Scan(&accountID); err != nil {
		t.Fatal(err)
	}
	if accountID <= 0 {
		t.Fatalf("account id = %d", accountID)
	}
	s.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: 55, AccountID: accountID})
	s.EnableFirstCityV2Routes(func(PlayerContext) (string, bool) { return testFirstCityRealmUUID, true })
	s.WireFirstCityV2Ledger(NewPGFirstCityLedger(pool), fixedTemplateIntake{ref: FirstCityTemplateRef("DATA-002")})
	s.WireFirstCityV2Effect(s.FirstCityCreationEffect())

	var buildable *world.Cell
	for _, c := range world.GenerateChunk(1, 0, 0) {
		if c.Buildable() && c.X > 0 && c.Y > 0 {
			buildable = &c
			break
		}
	}
	if buildable == nil {
		t.Fatal("no buildable tile")
	}
	scope := &worldv1.FirstCityScope{RealmId: testFirstCityRealmUUID, ServerId: 1, PlayerId: 55, AccountId: accountID}
	proposal := &worldv1.FirstCityProposal{
		CommandId:   testFirstCityCommand,
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name:        proto.String("首城"),
		X:           proto.Int32(int32(buildable.X)),
		Y:           proto.Int32(int32(buildable.Y)),
	}
	pkt := &commonv1.ClientPacket{SessionId: "owner", TraceId: "first-city", ServerId: 1,
		Payload: mustProto(&worldv1.SubmitFirstCityRequest{ExpectedScope: scope, Proposal: proposal})}
	out, err := s.handleSubmitFirstCity(ctx, pkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("submit: err=%v code=%d msg=%s", err, out.GetCode(), out.GetMsg())
	}
	var resp worldv1.SubmitFirstCityResponse
	if err := proto.Unmarshal(out.GetData(), &resp); err != nil {
		t.Fatal(err)
	}
	cmd := resp.GetOutcome().GetCommand()
	success := cmd.GetSucceeded()
	if success == nil {
		t.Fatalf("outcome = %+v", resp.GetOutcome())
	}
	if success.GetCityId() <= 0 || success.GetServerId() != 1 || success.GetPlayerId() != 55 {
		t.Fatalf("success = %+v", success)
	}
	var cities int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=55").Scan(&cities); err != nil {
		t.Fatal(err)
	}
	if cities != 1 {
		t.Fatalf("player_city rows = %d", cities)
	}
	var name string
	if err := pool.QueryRow(ctx, "SELECT name FROM player_city WHERE server_id=1 AND player_id=55").Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "首城" {
		t.Fatalf("city name = %q", name)
	}
	// A replay of the same command id must not create a second city.
	out, err = s.handleSubmitFirstCity(ctx, pkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("replay: err=%v code=%d", err, out.GetCode())
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=55").Scan(&cities); err != nil {
		t.Fatal(err)
	}
	if cities != 1 {
		t.Fatalf("player_city rows after replay = %d", cities)
	}
	var cmdState int
	if err := pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=55 AND command_id=$2::uuid`,
		testFirstCityRealmUUID, testFirstCityCommand).Scan(&cmdState); err != nil {
		t.Fatal(err)
	}
	if cmdState != 2 {
		t.Fatalf("ledger durable_state = %d", cmdState)
	}
}
