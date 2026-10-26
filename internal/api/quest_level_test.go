package api

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SQL/proof/failure fixtures verify recovery, not natural-play onboarding QA.
func levelFixture(t *testing.T) (*Server, *pgxpool.Pool) {
	t.Helper()
	pool := walletBoundaryPool(t, true)
	raw, err := os.ReadFile("../../spec/data/generated/cfg_quest.sql")
	if err != nil {
		t.Fatal(err)
	}
	tutorialSQL(t, pool, string(raw))
	return starterServer(t, pool, 0), pool // Real PG quest store + canonical content adapter.
}

func levelPlayer(t *testing.T, s *Server, shard int32, id int64) quest.Actor {
	t.Helper()
	name := fmt.Sprintf("level-%d-%d", shard, id)
	tutorialSQL(t, s.players.Pool, `WITH a AS (INSERT INTO account(login_name,password_hash) VALUES($1,'fixture') RETURNING account_id)
        INSERT INTO player(server_id,player_id,account_id,display_name) SELECT $2,$3,account_id,$1 FROM a`, name, shard, id)
	tutorialSQL(t, s.players.Pool, `INSERT INTO player_wallet(server_id,player_id) VALUES($1,$2)`, shard, id)
	s.BindSessionForTest(name, PlayerContext{ServerID: shard, PlayerID: id})
	return quest.Actor{ServerID: shard, PlayerID: id}
}

func levelRows(t *testing.T, pool *pgxpool.Pool, a quest.Actor, last int32) {
	t.Helper()
	tutorialSQL(t, pool, `INSERT INTO player_quest(server_id,player_id,quest_cfg_id,state,progress)
        SELECT $1,$2,id,3,'{"count":1}'::jsonb FROM generate_series(1001,$3) id
        ON CONFLICT(server_id,player_id,quest_cfg_id) DO UPDATE SET state=3`, a.ServerID, a.PlayerID, last)
}

func levelClaim(t *testing.T, s *Server, a quest.Actor, id int32) *commonv1.ServerPacket {
	t.Helper()
	resp, err := s.handleClaimQuestReward(context.Background(), &commonv1.ClientPacket{
		SessionId: fmt.Sprintf("level-%d-%d", a.ServerID, a.PlayerID),
		Payload:   mustProto(&questv1.ClaimQuestRewardRequest{ServerId: 99, QuestCfgId: id}),
	})
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestTutorialLevelClaimPersistencePG(t *testing.T) {
	s, pool := levelFixture(t)
	ctx := context.Background()
	for _, initial := range []int32{1, 20} {
		a := levelPlayer(t, s, 1, int64(initial))
		tutorialSQL(t, pool, `UPDATE player SET level=$1 WHERE player_id=$2`, initial, a.PlayerID)
		tutorialSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,$1,$1,'fixture',$2,0)`, a.PlayerID, int32(a.PlayerID))
		tutorialSQL(t, pool, `INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES
            (1,$1,'hall',1,2),(1,$1,'farm',2,3),(1,$1,'wood',3,2),(1,$1,'barrack',6,2)`, a.PlayerID)
		tutorialSQL(t, pool, `INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id) VALUES(1,$1,$1,1001)`, a.PlayerID)
		for id := int32(1001); id <= 1005; id++ {
			if _, _, err := s.questSvc.AcceptQuest(ctx, a, id); err != nil {
				t.Fatal(err)
			}
			resp := levelClaim(t, s, a, id)
			var out questv1.ClaimQuestRewardResponse
			if resp.Code != 0 || unmarshal(resp.Data, &out) != nil {
				t.Fatalf("claim %d: %+v", id, resp)
			}
			want := max(initial, id-1000)
			var persisted int32
			if err := pool.QueryRow(ctx, `SELECT level FROM player WHERE server_id=$1 AND player_id=$2`, a.ServerID, a.PlayerID).Scan(&persisted); err != nil || out.GetPlayerLevel() != want || persisted != want {
				t.Fatalf("level=%d db=%d want=%d err=%v", out.GetPlayerLevel(), persisted, want, err)
			}
		}
	}
}

func TestTutorialLevelFailureDuplicateAndReceiptRecoveryPG(t *testing.T) {
	s, pool := levelFixture(t)
	a := levelPlayer(t, s, 1, 7)
	levelRows(t, pool, a, 1001)
	tutorialSQL(t, pool, `INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id) VALUES(1,7,7,1001)`)
	if _, _, err := s.questSvc.AcceptQuest(context.Background(), a, 1002); err != nil {
		t.Fatal(err)
	}
	tutorialSQL(t, pool, `CREATE FUNCTION fail_level() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.level>OLD.level THEN RAISE EXCEPTION 'secret level SQL'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER fail_level BEFORE UPDATE ON player FOR EACH ROW EXECUTE FUNCTION fail_level()`)
	resp := levelClaim(t, s, a, 1002)
	if resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || resp.Msg != "quest operation failed" || len(resp.Data) != 0 {
		t.Fatalf("unsafe level failure: %+v", resp)
	}
	check := func(want int32) {
		t.Helper()
		var level, qty, grants int32
		var state int16
		err := pool.QueryRow(context.Background(), `SELECT level,
            (SELECT quantity FROM player_item WHERE server_id=1 AND player_id=7 AND item_cfg_id=2004),
            (SELECT count(*) FROM reward_grant_queue WHERE server_id=1 AND player_id=7),
            (SELECT state FROM player_quest WHERE server_id=1 AND player_id=7 AND quest_cfg_id=1002)
            FROM player WHERE server_id=1 AND player_id=7`).Scan(&level, &qty, &grants, &state)
		if err != nil || level != want || qty != 1 || grants != 1 || state != quest.StateCompleted {
			t.Fatalf("level=%d qty=%d grants=%d state=%d %v", level, qty, grants, state, err)
		}
	}
	check(1)
	tutorialSQL(t, pool, `DROP TRIGGER fail_level ON player; DELETE FROM player_hero`)
	resp = levelClaim(t, starterServer(t, pool, 0), a, 1002) // Bind explicitly below; no process-local level recovery state.
	if resp.Code == 0 {
		t.Fatal("unbound restarted actor accepted")
	}
	restarted := starterServer(t, pool, 0)
	restarted.BindSessionForTest("level-1-7", PlayerContext{ServerID: 1, PlayerID: 7})
	resp = levelClaim(t, restarted, a, 1002)
	if resp.Msg != quest.ErrAlreadyCompleted.Error() || resp.Code == 0 || len(resp.Data) != 0 {
		t.Fatalf("duplicate semantics: %+v", resp)
	}
	check(2)
	// Historical paid receipt without proof must win before facts/level checks.
	tutorialSQL(t, pool, `UPDATE player SET level=1; UPDATE player_quest SET state=2,progress='{"count":0}' WHERE quest_cfg_id=1002;
        ALTER TABLE player_hero RENAME TO unavailable_hero`)
	resp = levelClaim(t, restarted, a, 1002)
	var out questv1.ClaimQuestRewardResponse
	if resp.Code != 0 || unmarshal(resp.Data, &out) != nil || out.PlayerLevel != 2 {
		t.Fatalf("receipt-first: %+v", resp)
	}
	check(2)
}

func TestTutorialLevelBoundedIsolatedAndReadRecoveryPG(t *testing.T) {
	s, pool := levelFixture(t)
	ctx := context.Background()
	a := levelPlayer(t, s, 1, 7)
	b := levelPlayer(t, s, 2, 7)
	c := levelPlayer(t, s, 1, 8)
	levelRows(t, pool, a, 1005)
	tutorialSQL(t, pool, `INSERT INTO player_quest(server_id,player_id,quest_cfg_id,state,progress,accepted_at) VALUES
        (2,7,1005,3,'{}',now()),(1,8,1001,2,'{"count":1,"server_verified_version":1}',now())`)
	for _, other := range []quest.Actor{b, c} {
		if got, err := s.reconcileTutorialLevel(ctx, other); err != nil || got != 1 {
			t.Fatalf("isolated/claimable: %d %v", got, err)
		}
	}
	for _, request := range []struct {
		payload []byte
		handle  func(context.Context, *commonv1.ClientPacket) (*commonv1.ServerPacket, error)
	}{
		{mustProto(&questv1.ListPlayerQuestsRequest{ChainId: 100}), s.handleListPlayerQuests},
		{mustProto(&questv1.GetQuestChainStatusRequest{ChainId: 100}), s.handleGetQuestChainStatus},
	} {
		tutorialSQL(t, pool, `UPDATE player SET level=1 WHERE server_id=1 AND player_id=7`)
		resp, err := request.handle(ctx, &commonv1.ClientPacket{SessionId: "level-1-7", Payload: request.payload})
		var level int32
		readErr := pool.QueryRow(ctx, `SELECT level FROM player WHERE server_id=1 AND player_id=7`).Scan(&level)
		if err != nil || resp.Code != 0 || readErr != nil || level != 5 {
			t.Fatalf("read recovery: %+v level=%d %v %v", resp, level, err, readErr)
		}
	}
	if got, err := s.reconcileTutorialLevel(ctx, quest.Actor{ServerID: 3, PlayerID: 7}); err == nil || got != 0 {
		t.Fatalf("missing actor: %d %v", got, err)
	}
	// Even a proof-bearing row cannot mint a new reward for an absent player.
	tutorialSQL(t, pool, `INSERT INTO player_quest(server_id,player_id,quest_cfg_id,state,progress,accepted_at)
        VALUES(3,7,1001,2,'{"count":1,"server_verified_version":1}',now())`)
	s.BindSessionForTest("level-3-7", PlayerContext{ServerID: 3, PlayerID: 7})
	resp := levelClaim(t, s, quest.Actor{ServerID: 3, PlayerID: 7}, 1001)
	var created int
	err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player WHERE server_id=3)+(SELECT count(*) FROM reward_grant_queue WHERE server_id=3)`).Scan(&created)
	if resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || len(resp.Data) != 0 || err != nil || created != 0 {
		t.Fatalf("missing player minted reward: %+v %d %v", resp, created, err)
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if got, err := s.reconcileTutorialLevel(canceled, a); err == nil || got != 0 {
		t.Fatalf("failed read: %d %v", got, err)
	}
	tutorialSQL(t, pool, `UPDATE cfg_quest SET quest_type=0 WHERE quest_cfg_id=1003`)
	if got, err := starterServer(t, pool, 0).reconcileTutorialLevel(ctx, a); err == nil || got != 0 {
		t.Fatalf("unknown config: %d %v", got, err)
	}
	var legacy questv1.ClaimQuestRewardResponse
	if err := unmarshal(nil, &legacy); err != nil || legacy.GetPlayerLevel() != 0 {
		t.Fatalf("unknown wire level: %+v %v", &legacy, err)
	}
}

func TestTutorialLevelLoginAndProfileFreshnessPG(t *testing.T) {
	s, pool := levelFixture(t)
	ctx := context.Background()
	tutorialSQL(t, pool, `INSERT INTO game_server(server_id,display_name,status) VALUES(1,'S1',1)`)
	if _, err := s.account.Register(ctx, "level-login", "secret"); err != nil {
		t.Fatal(err)
	}
	login := func() *commonv1.ServerPacket {
		return s.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: account.RouteLogin, Payload: mustProto(&accountv1.LoginRequest{LoginName: "level-login", Password: "secret", ServerId: 1})})
	}
	var first accountv1.LoginResponse
	resp := login()
	if resp.Code != 0 || unmarshal(resp.Data, &first) != nil {
		t.Fatalf("initial: %+v", resp)
	}
	a := quest.Actor{ServerID: 1, PlayerID: first.Player.PlayerId}
	levelRows(t, pool, a, 1005)
	resp = login()
	var logged accountv1.LoginResponse
	if resp.Code != 0 || unmarshal(resp.Data, &logged) != nil || logged.Player.Level != 5 {
		t.Fatalf("stale login: %+v", resp)
	}
	tutorialSQL(t, pool, `UPDATE player SET level=1`)
	resp = s.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: "account.v1.EnterGameServer", SessionId: logged.SessionId, Payload: mustProto(&accountv1.EnterGameServerRequest{ServerId: 1})})
	var entered accountv1.EnterGameServerResponse
	if resp.Code != 0 || unmarshal(resp.Data, &entered) != nil || entered.Player.Level != 5 {
		t.Fatalf("stale profile: %+v", resp)
	}
}
