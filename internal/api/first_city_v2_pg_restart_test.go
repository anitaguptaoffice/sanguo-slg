package api

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"google.golang.org/protobuf/proto"
)

// TestFirstCityPGResultAfterServerReconnect proves PG ledger survives a fresh Server process wiring.
func TestFirstCityPGResultAfterServerReconnect(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	if _, err := pool.Exec(ctx, "DELETE FROM player_city WHERE server_id=1 AND player_id=56"); err != nil {
		t.Fatal(err)
	}
	if err := world.NewPGStore(pool).SaveChunk(ctx, 1, world.GenerateChunk(1, 0, 0)); err != nil {
		t.Fatal(err)
	}
	h := domestic.NewHub(time.Now)
	h.UseStore(domestic.NewPGStore(pool), 1, 0)
	s := NewServer(nil, pool, world.NewService(world.NewPGStore(pool)), h, march.NewHub(nil))

	const playerID = int64(56)
	var accountID int64
	if err := pool.QueryRow(ctx,
		`INSERT INTO account(login_name,password_hash,status) VALUES ($1,'x',1) RETURNING account_id`,
		fmt.Sprintf("fc-restart-%d", playerID)).Scan(&accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO player(server_id,player_id,account_id,display_name) VALUES (1,$1,$2,'fc-restart')`,
		playerID, accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron) VALUES (1,$1,8000,8000,5000,5000)`,
		playerID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM world_first_city_command WHERE server_id=1 AND player_id=$1`, playerID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM world_first_city_actor_slot WHERE server_id=1 AND player_id=$1`, playerID); err != nil {
		t.Fatal(err)
	}

	wireFirstCityPG := func(srv *Server) {
		srv.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: playerID, AccountID: accountID})
		srv.EnableFirstCityV2Routes(func(PlayerContext) (string, bool) { return testFirstCityRealmUUID, true })
		srv.WireFirstCityV2Ledger(NewPGFirstCityLedger(pool), fixedTemplateIntake{ref: FirstCityTemplateRef("DATA-002")})
		srv.WireFirstCityV2Effect(srv.FirstCityCreationEffect())
	}
	wireFirstCityPG(s)

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
	const cmd = "66666666-6666-4666-8666-666666666666"
	scope := &worldv1.FirstCityScope{RealmId: testFirstCityRealmUUID, ServerId: 1, PlayerId: playerID, AccountId: accountID}
	proposal := &worldv1.FirstCityProposal{
		CommandId:   cmd,
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name:        proto.String("首城"),
		X:           proto.Int32(int32(buildable.X)),
		Y:           proto.Int32(int32(buildable.Y)),
	}
	submitPkt := &commonv1.ClientPacket{SessionId: "owner", TraceId: "restart", ServerId: 1,
		Payload: mustProto(&worldv1.SubmitFirstCityRequest{ExpectedScope: scope, Proposal: proposal})}
	out, err := s.handleSubmitFirstCity(ctx, submitPkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("submit: err=%v code=%d", err, out.GetCode())
	}

	store := world.NewPGStore(pool)
	restartedHub := domestic.NewHub(s.now)
	restartedHub.UseStore(domestic.NewPGStore(pool), 1, 0)
	restarted := NewServer(s.log, pool, world.NewService(store), restartedHub, march.NewHub(nil))
	wireFirstCityPG(restarted)

	getPkt := &commonv1.ClientPacket{SessionId: "owner", TraceId: "restart-get", ServerId: 1,
		Payload: mustProto(&worldv1.GetFirstCityResultRequest{ExpectedScope: scope, CommandId: cmd})}
	out, err = restarted.handleGetFirstCityResult(ctx, getPkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("get: err=%v code=%d msg=%s", err, out.GetCode(), out.GetMsg())
	}
	var getResp worldv1.GetFirstCityResultResponse
	if err := proto.Unmarshal(out.GetData(), &getResp); err != nil {
		t.Fatal(err)
	}
	ok := getResp.GetOutcome().GetCommand().GetSucceeded()
	if ok == nil || ok.GetCityId() <= 0 {
		t.Fatalf("outcome = %+v", getResp.GetOutcome())
	}
}

type failOnceFirstCityEffect struct {
	inner   FirstCityV2Effect
	failed  atomic.Bool
	attempt atomic.Int32
}

func (f *failOnceFirstCityEffect) Create(ctx context.Context, scope *worldv1.FirstCityScope, proposal *worldv1.FirstCityProposal) (int64, worldv1.FirstCityRejectionReason, error) {
	f.attempt.Add(1)
	if !f.failed.Swap(true) {
		return 0, worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_REASON_UNSPECIFIED, errors.New("transient effect outage")
	}
	return f.inner.Create(ctx, scope, proposal)
}

// TestFirstCityPGContinueAfterPendingReconnect resumes a durable PENDING after a new Server process.
func TestFirstCityPGContinueAfterPendingReconnect(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	if _, err := pool.Exec(ctx, "DELETE FROM player_city WHERE server_id=1 AND player_id=57"); err != nil {
		t.Fatal(err)
	}
	if err := world.NewPGStore(pool).SaveChunk(ctx, 1, world.GenerateChunk(1, 0, 0)); err != nil {
		t.Fatal(err)
	}
	h := domestic.NewHub(time.Now)
	h.UseStore(domestic.NewPGStore(pool), 1, 0)
	s := NewServer(nil, pool, world.NewService(world.NewPGStore(pool)), h, march.NewHub(nil))

	const playerID = int64(57)
	var accountID int64
	if err := pool.QueryRow(ctx,
		`INSERT INTO account(login_name,password_hash,status) VALUES ($1,'x',1) RETURNING account_id`,
		fmt.Sprintf("fc-pending-%d", playerID)).Scan(&accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO player(server_id,player_id,account_id,display_name) VALUES (1,$1,$2,'fc-pending')`,
		playerID, accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron) VALUES (1,$1,8000,8000,5000,5000)`,
		playerID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM world_first_city_command WHERE server_id=1 AND player_id=$1`, playerID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM world_first_city_actor_slot WHERE server_id=1 AND player_id=$1`, playerID); err != nil {
		t.Fatal(err)
	}

	wireFirstCity := func(srv *Server, effect FirstCityV2Effect) {
		srv.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: playerID, AccountID: accountID})
		srv.EnableFirstCityV2Routes(func(PlayerContext) (string, bool) { return testFirstCityRealmUUID, true })
		srv.WireFirstCityV2Ledger(NewPGFirstCityLedger(pool), fixedTemplateIntake{ref: FirstCityTemplateRef("DATA-002")})
		srv.WireFirstCityV2Effect(effect)
	}

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
	const cmd = "77777777-7777-4777-8777-777777777771"
	scope := &worldv1.FirstCityScope{RealmId: testFirstCityRealmUUID, ServerId: 1, PlayerId: playerID, AccountId: accountID}
	proposal := &worldv1.FirstCityProposal{
		CommandId:   cmd,
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name:        proto.String("首城"),
		X:           proto.Int32(int32(buildable.X)),
		Y:           proto.Int32(int32(buildable.Y)),
	}

	flaky := &failOnceFirstCityEffect{}
	wireFirstCity(s, flaky)
	flaky.inner = s.FirstCityCreationEffect()

	submitPkt := &commonv1.ClientPacket{SessionId: "owner", TraceId: "pending-submit", ServerId: 1,
		Payload: mustProto(&worldv1.SubmitFirstCityRequest{ExpectedScope: scope, Proposal: proposal})}
	out, err := s.handleSubmitFirstCity(ctx, submitPkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("submit: err=%v code=%d", err, out.GetCode())
	}
	var subResp worldv1.SubmitFirstCityResponse
	if err := proto.Unmarshal(out.GetData(), &subResp); err != nil {
		t.Fatal(err)
	}
	if subResp.GetOutcome().GetCommand().GetPending() == nil {
		t.Fatalf("expected pending submit outcome %+v", subResp.GetOutcome())
	}

	store := world.NewPGStore(pool)
	restartedHub := domestic.NewHub(s.now)
	restartedHub.UseStore(domestic.NewPGStore(pool), 1, 0)
	restarted := NewServer(s.log, pool, world.NewService(store), restartedHub, march.NewHub(nil))
	wireFirstCity(restarted, restarted.FirstCityCreationEffect())

	contPkt := &commonv1.ClientPacket{SessionId: "owner", TraceId: "pending-continue", ServerId: 1,
		Payload: mustProto(&worldv1.ContinueFirstCityRequest{ExpectedScope: scope, Proposal: proposal})}
	out, err = restarted.handleContinueFirstCity(ctx, contPkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("continue: err=%v code=%d msg=%s", err, out.GetCode(), out.GetMsg())
	}
	var contResp worldv1.ContinueFirstCityResponse
	if err := proto.Unmarshal(out.GetData(), &contResp); err != nil {
		t.Fatal(err)
	}
	ok := contResp.GetOutcome().GetCommand().GetSucceeded()
	if ok == nil || ok.GetCityId() <= 0 {
		t.Fatalf("continue outcome = %+v", contResp.GetOutcome())
	}
	out, err = restarted.handleContinueFirstCity(ctx, contPkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatal(err)
	}
	_ = proto.Unmarshal(out.GetData(), &contResp)
	if contResp.GetOutcome().GetCommand().GetSucceeded().GetCityId() != ok.GetCityId() {
		t.Fatalf("repeat continue mutated city id %+v", contResp.GetOutcome())
	}

	var cityCount int
	if err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM player_city WHERE server_id=1 AND player_id=$1`, playerID).Scan(&cityCount); err != nil {
		t.Fatal(err)
	}
	if cityCount != 1 {
		t.Fatalf("player cities = %d", cityCount)
	}
	if flaky.attempt.Load() != 1 {
		t.Fatalf("submit effect attempts = %d want 1", flaky.attempt.Load())
	}
}

// TestFirstCityPGDuplicateSubmitPendingNoDoubleCity mirrors client submit+auto-continue: intake ack then settlement.
func TestFirstCityPGDuplicateSubmitPendingNoDoubleCity(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	const playerID = int64(58)
	if _, err := pool.Exec(ctx, "DELETE FROM player_city WHERE server_id=1 AND player_id=$1", playerID); err != nil {
		t.Fatal(err)
	}
	if err := world.NewPGStore(pool).SaveChunk(ctx, 1, world.GenerateChunk(1, 0, 0)); err != nil {
		t.Fatal(err)
	}
	h := domestic.NewHub(time.Now)
	h.UseStore(domestic.NewPGStore(pool), 1, 0)
	s := NewServer(nil, pool, world.NewService(world.NewPGStore(pool)), h, march.NewHub(nil))

	var accountID int64
	if err := pool.QueryRow(ctx,
		`INSERT INTO account(login_name,password_hash,status) VALUES ($1,'x',1) RETURNING account_id`,
		fmt.Sprintf("fc-dup-%d", playerID)).Scan(&accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO player(server_id,player_id,account_id,display_name) VALUES (1,$1,$2,'fc-dup')`,
		playerID, accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron) VALUES (1,$1,8000,8000,5000,5000)`,
		playerID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM world_first_city_command WHERE server_id=1 AND player_id=$1`, playerID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM world_first_city_actor_slot WHERE server_id=1 AND player_id=$1`, playerID); err != nil {
		t.Fatal(err)
	}

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
	const cmd = "88888888-8888-4888-8888-888888888881"
	scope := &worldv1.FirstCityScope{RealmId: testFirstCityRealmUUID, ServerId: 1, PlayerId: playerID, AccountId: accountID}
	proposal := &worldv1.FirstCityProposal{
		CommandId:   cmd,
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name:        proto.String("首城"),
		X:           proto.Int32(int32(buildable.X)),
		Y:           proto.Int32(int32(buildable.Y)),
	}
	submitBody := mustProto(&worldv1.SubmitFirstCityRequest{ExpectedScope: scope, Proposal: proposal})
	submitPkt := func(trace string) *commonv1.ClientPacket {
		return &commonv1.ClientPacket{SessionId: "owner", TraceId: trace, ServerId: 1, Payload: submitBody}
	}
	contPkt := &commonv1.ClientPacket{SessionId: "owner", TraceId: "dup-continue", ServerId: 1,
		Payload: mustProto(&worldv1.ContinueFirstCityRequest{ExpectedScope: scope, Proposal: proposal})}

	flaky := &failOnceFirstCityEffect{}
	s.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: playerID, AccountID: accountID})
	s.EnableFirstCityV2Routes(func(PlayerContext) (string, bool) { return testFirstCityRealmUUID, true })
	s.WireFirstCityV2Ledger(NewPGFirstCityLedger(pool), fixedTemplateIntake{ref: FirstCityTemplateRef("DATA-002")})
	flaky.inner = s.FirstCityCreationEffect()
	s.WireFirstCityV2Effect(flaky)

	out, err := s.handleSubmitFirstCity(ctx, submitPkt("dup-submit-1"))
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("submit1: err=%v code=%d", err, out.GetCode())
	}
	var subResp worldv1.SubmitFirstCityResponse
	if err := proto.Unmarshal(out.GetData(), &subResp); err != nil {
		t.Fatal(err)
	}
	if subResp.GetOutcome().GetCommand().GetPending() == nil {
		t.Fatalf("expected pending %+v", subResp.GetOutcome())
	}
	out, err = s.handleSubmitFirstCity(ctx, submitPkt("dup-submit-2"))
	if err != nil || out.GetCode() != 0 {
		t.Fatal(err)
	}
	_ = proto.Unmarshal(out.GetData(), &subResp)
	if subResp.GetOutcome().GetCommand().GetPending() == nil {
		t.Fatalf("duplicate submit %+v", subResp.GetOutcome())
	}
	s.WireFirstCityV2Effect(s.FirstCityCreationEffect())
	out, err = s.handleContinueFirstCity(ctx, contPkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatal(err)
	}
	var contResp worldv1.ContinueFirstCityResponse
	if err := proto.Unmarshal(out.GetData(), &contResp); err != nil {
		t.Fatal(err)
	}
	if contResp.GetOutcome().GetCommand().GetSucceeded().GetCityId() <= 0 {
		t.Fatalf("continue %+v", contResp.GetOutcome())
	}
	var cityCount int
	if err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM player_city WHERE server_id=1 AND player_id=$1`, playerID).Scan(&cityCount); err != nil {
		t.Fatal(err)
	}
	if cityCount != 1 {
		t.Fatalf("player cities = %d", cityCount)
	}
	if flaky.attempt.Load() != 1 {
		t.Fatalf("effect attempts = %d want 1", flaky.attempt.Load())
	}
}

// TestFirstCityPGGetSettlesPending mirrors poll Get after durable PENDING intake.
func TestFirstCityPGGetSettlesPending(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	const playerID = int64(59)
	if _, err := pool.Exec(ctx, "DELETE FROM player_city WHERE server_id=1 AND player_id=$1", playerID); err != nil {
		t.Fatal(err)
	}
	if err := world.NewPGStore(pool).SaveChunk(ctx, 1, world.GenerateChunk(1, 0, 0)); err != nil {
		t.Fatal(err)
	}
	h := domestic.NewHub(time.Now)
	h.UseStore(domestic.NewPGStore(pool), 1, 0)
	s := NewServer(nil, pool, world.NewService(world.NewPGStore(pool)), h, march.NewHub(nil))

	var accountID int64
	if err := pool.QueryRow(ctx,
		`INSERT INTO account(login_name,password_hash,status) VALUES ($1,'x',1) RETURNING account_id`,
		fmt.Sprintf("fc-get-%d", playerID)).Scan(&accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO player(server_id,player_id,account_id,display_name) VALUES (1,$1,$2,'fc-get')`,
		playerID, accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron) VALUES (1,$1,8000,8000,5000,5000)`,
		playerID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM world_first_city_command WHERE server_id=1 AND player_id=$1`, playerID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM world_first_city_actor_slot WHERE server_id=1 AND player_id=$1`, playerID); err != nil {
		t.Fatal(err)
	}

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
	const cmd = "99999999-9999-4999-8999-999999999991"
	scope := &worldv1.FirstCityScope{RealmId: testFirstCityRealmUUID, ServerId: 1, PlayerId: playerID, AccountId: accountID}
	proposal := &worldv1.FirstCityProposal{
		CommandId:   cmd,
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name:        proto.String("首城"),
		X:           proto.Int32(int32(buildable.X)),
		Y:           proto.Int32(int32(buildable.Y)),
	}
	flaky := &failOnceFirstCityEffect{}
	s.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: playerID, AccountID: accountID})
	s.EnableFirstCityV2Routes(func(PlayerContext) (string, bool) { return testFirstCityRealmUUID, true })
	s.WireFirstCityV2Ledger(NewPGFirstCityLedger(pool), fixedTemplateIntake{ref: FirstCityTemplateRef("DATA-002")})
	flaky.inner = s.FirstCityCreationEffect()
	s.WireFirstCityV2Effect(flaky)

	submitPkt := &commonv1.ClientPacket{SessionId: "owner", TraceId: "get-submit", ServerId: 1,
		Payload: mustProto(&worldv1.SubmitFirstCityRequest{ExpectedScope: scope, Proposal: proposal})}
	out, err := s.handleSubmitFirstCity(ctx, submitPkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatal(err, out)
	}
	s.WireFirstCityV2Effect(s.FirstCityCreationEffect())

	getPkt := &commonv1.ClientPacket{SessionId: "owner", TraceId: "get-settle", ServerId: 1,
		Payload: mustProto(&worldv1.GetFirstCityResultRequest{ExpectedScope: scope, CommandId: cmd})}
	out, err = s.handleGetFirstCityResult(ctx, getPkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatal(err, out)
	}
	var getResp worldv1.GetFirstCityResultResponse
	if err := proto.Unmarshal(out.GetData(), &getResp); err != nil {
		t.Fatal(err)
	}
	if getResp.GetOutcome().GetCommand().GetSucceeded().GetCityId() <= 0 {
		t.Fatalf("get %+v", getResp.GetOutcome())
	}
	if flaky.attempt.Load() != 1 {
		t.Fatalf("effect attempts = %d", flaky.attempt.Load())
	}
}
