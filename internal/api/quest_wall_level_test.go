package api

import (
	"context"
	"testing"

	commonpb "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Deterministic integration fixtures, never represented as natural construction.
func wallLevelFixture(t *testing.T) (*Server, *pgxpool.Pool, quest.Actor) {
	t.Helper()
	s, pool := levelFixture(t)
	a := levelPlayer(t, s, 1, 7)
	tutorialSQL(t, pool, `UPDATE player SET level=5 WHERE server_id=1 AND player_id=7;
 INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,70,7,'wall-fixture',10,10)`)
	return s, pool, a
}

func wallRow(t *testing.T, s *Server, a quest.Actor) quest.PlayerQuestRow {
	t.Helper()
	row, has, err := quest.NewPGStore(s.players.Pool).GetPlayerQuest(context.Background(), a.ServerID, a.PlayerID, 1006)
	if err != nil || !has {
		t.Fatalf("wall row %+v %t %v", row, has, err)
	}
	return row
}

func assertWallPayment(t *testing.T, pool *pgxpool.Pool, want int) {
	t.Helper()
	var count, qty int
	var wood int64
	err := pool.QueryRow(context.Background(), `SELECT
 (SELECT count(*) FROM reward_grant_queue WHERE server_id=1 AND player_id=7 AND idempotency_key='quest:7:1006:claim'),
 COALESCE((SELECT quantity FROM player_item WHERE server_id=1 AND player_id=7 AND item_cfg_id=2018),0),
 wood FROM player_wallet WHERE server_id=1 AND player_id=7`).Scan(&count, &qty, &wood)
	if err != nil || count != want || qty != want || wood != int64(800*want) {
		t.Fatalf("payment count%d qty%d wood%d %v", count, qty, wood, err)
	}
}

func TestWallLevelPGOwnedCompletedBuildingAndClaim(t *testing.T) {
	s, pool, a := wallLevelFixture(t)
	ctx := context.Background()
	if _, _, err := s.questSvc.AcceptQuest(ctx, a, 1006); err != nil {
		t.Fatal(err)
	}
	// Metadata wall_level defaults to1, but no completed cfg7 exists for this actor.
	tutorialSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,71,8,'other-owner',11,10),(2,70,7,'other-shard',10,10);
 INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level,upgrade_finish_at) VALUES
 (1,70,'wall',7,0,now()+interval '1 hour'),(1,71,'wall',7,99,NULL),(2,70,'wall',7,99,NULL)`)
	s.questAfterBuildLevel(ctx, 1, 7, 7, 99) // Spoofed hint payload is not evidence.
	if row := wallRow(t, s, a); row.State != quest.StateInProgress || row.Progress.ServerVerifiedVersion != 0 {
		t.Fatalf("queued/foreign wall credited %+v", row)
	}
	if got, err := s.reconcileTutorialLevel(ctx, a); err != nil || got != 5 {
		t.Fatalf("premature floor%d %v", got, err)
	}
	tutorialSQL(t, pool, `UPDATE city_building SET level=1,upgrade_finish_at=NULL WHERE server_id=1 AND city_id=70`)
	s.questAfterBuildLevel(ctx, 1, 7, 7, 1)
	if row := wallRow(t, s, a); row.State != quest.StateClaimable || row.Progress.ServerVerifiedVersion != 2 {
		t.Fatalf("proof %+v", row)
	}
	if got, err := s.reconcileTutorialLevel(ctx, a); err != nil || got != 5 {
		t.Fatalf("claimable floor%d %v", got, err)
	}
	resp := levelClaim(t, s, a, 1006)
	var reply questv1.ClaimQuestRewardResponse
	if resp.Code != 0 || unmarshal(resp.Data, &reply) != nil || reply.PlayerLevel != 6 {
		t.Fatalf("claim %+v reply%+v", resp, &reply)
	}
	assertWallPayment(t, pool, 1)
	tutorialSQL(t, pool, `DELETE FROM city_building WHERE server_id=1 AND city_id=70`)
	fresh := starterServer(t, pool, 0)
	profile := &commonpb.PlayerProfile{ServerId: 1, PlayerId: 7}
	if err := fresh.refreshTutorialProfile(ctx, profile); err != nil || profile.Level != 6 {
		t.Fatalf("restart %+v %v", profile, err)
	}
	fresh.BindSessionForTest("level-1-7", PlayerContext{ServerID: 1, PlayerID: 7})
	if again := levelClaim(t, fresh, a, 1006); again.Msg != quest.ErrAlreadyCompleted.Error() {
		t.Fatalf("repeat %+v", again)
	}
	assertWallPayment(t, pool, 1)
}

func TestWallLevelPGLegacyRequiresExplicitNoPayoutClaim(t *testing.T) {
	s, pool, a := wallLevelFixture(t)
	ctx := context.Background()
	tutorialSQL(t, pool, `INSERT INTO player_quest(server_id,player_id,quest_cfg_id,state,progress) VALUES(1,7,1006,3,'{"count":99}');
 INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,70,'wall',7,1)`)
	for i := 0; i < 2; i++ {
		s.questAfterBuildLevel(ctx, 1, 7, 7, 1)
		if got, err := s.recoverWallAndLevel(ctx, a); err != nil || got != 5 {
			t.Fatalf("passive floor%d %v", got, err)
		}
		profile := &commonpb.PlayerProfile{ServerId: 1, PlayerId: 7}
		if err := s.refreshTutorialProfile(ctx, profile); err != nil || profile.Level != 5 {
			t.Fatalf("passive profile%+v %v", profile, err)
		}
	}
	if row := wallRow(t, s, a); row.AcceptedAt != nil || row.Progress.ServerVerifiedVersion != 0 {
		t.Fatalf("passive manufactured %+v", row)
	}
	resp := levelClaim(t, s, a, 1006)
	if resp.Msg != quest.ErrAlreadyCompleted.Error() {
		t.Fatalf("legacy %+v", resp)
	}
	row := wallRow(t, s, a)
	if row.AcceptedAt != nil || !row.Progress.LegacyNoPayoutVerified || row.Progress.ServerVerifiedVersion != 2 || row.State != quest.StateCompleted {
		t.Fatalf("legacy proof %+v", row)
	}
	if got, err := s.reconcileTutorialLevel(ctx, a); err != nil || got != 6 {
		t.Fatalf("explicit floor%d %v", got, err)
	}
	assertWallPayment(t, pool, 0)
}

func TestWallLevelPGReceiptAndLevelWriteFailureRecovery(t *testing.T) {
	for _, kind := range []string{"completion", "level"} {
		t.Run(kind, func(t *testing.T) {
			s, pool, a := wallLevelFixture(t)
			ctx := context.Background()
			tutorialSQL(t, pool, `INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,70,'wall',7,1)`)
			if _, _, err := s.questSvc.AcceptQuest(ctx, a, 1006); err != nil {
				t.Fatal(err)
			}
			if kind == "completion" {
				tutorialSQL(t, pool, `CREATE FUNCTION fail_wall() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.quest_cfg_id=1006 AND NEW.state=3 THEN RAISE EXCEPTION 'private wall completion'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER fail_wall BEFORE UPDATE ON player_quest FOR EACH ROW EXECUTE FUNCTION fail_wall()`)
			} else {
				tutorialSQL(t, pool, `CREATE FUNCTION fail_wall() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.level>5 THEN RAISE EXCEPTION 'private wall level'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER fail_wall BEFORE UPDATE ON player FOR EACH ROW EXECUTE FUNCTION fail_wall()`)
			}
			resp := levelClaim(t, s, a, 1006)
			if resp.Code == 0 || resp.Msg != "quest operation failed" || len(resp.Data) != 0 {
				t.Fatalf("failed response %+v", resp)
			}
			assertWallPayment(t, pool, 1)
			if kind == "completion" {
				tutorialSQL(t, pool, `DROP TRIGGER fail_wall ON player_quest`)
			} else {
				tutorialSQL(t, pool, `DROP TRIGGER fail_wall ON player`)
			}
			tutorialSQL(t, pool, `DELETE FROM city_building WHERE server_id=1 AND city_id=70`)
			fresh := starterServer(t, pool, 0)
			profile := &commonpb.PlayerProfile{ServerId: 1, PlayerId: 7}
			if err := fresh.refreshTutorialProfile(ctx, profile); err != nil || profile.Level != 6 {
				t.Fatalf("recovery %+v %v", profile, err)
			}
			if row := wallRow(t, fresh, a); row.State != quest.StateCompleted || row.Progress.ServerVerifiedVersion != 2 || row.RewardClaimedAt == nil {
				t.Fatalf("paid recovery %+v", row)
			}
			assertWallPayment(t, pool, 1)
			tutorialSQL(t, pool, `UPDATE player SET level=20 WHERE server_id=1 AND player_id=7`)
			if got, err := fresh.reconcileTutorialLevel(ctx, a); err != nil || got != 20 {
				t.Fatalf("downgrade%d %v", got, err)
			}
		})
	}
}
