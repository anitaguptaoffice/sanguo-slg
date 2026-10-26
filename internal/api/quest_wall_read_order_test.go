package api

import (
	"context"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"testing"
)

type wallInterleavedReceipt struct {
	*quest.ContentGranter
	reads int
}

func (g *wallInterleavedReceipt) FindQuestRewardReceipt(ctx context.Context, r quest.GrantRequest) (quest.GrantReceipt, bool, error) {
	g.reads++
	// Deterministic competing claimant: payment commits after API pre-refresh but
	// before the service's second read-side recovery; completion was interrupted.
	if g.reads == 2 {
		if _, err := g.ContentGranter.GrantQuestReward(ctx, r); err != nil {
			return quest.GrantReceipt{}, false, err
		}
	}
	return g.ContentGranter.FindQuestRewardReceipt(ctx, r)
}

func TestWallLevelPGSecondReadRecoveryRefreshesFloor(t *testing.T) {
	for _, entry := range []string{"list", "chain"} {
		t.Run(entry, func(t *testing.T) {
			s, pool, a := wallLevelFixture(t)
			ctx := context.Background()
			tutorialSQL(t, pool, `INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,70,'wall',7,1)`)
			if _, _, err := s.questSvc.AcceptQuest(ctx, a, 1006); err != nil {
				t.Fatal(err)
			}
			cat, err := quest.MemCatalogFromPG(ctx, pool)
			if err != nil {
				t.Fatal(err)
			}
			g := &wallInterleavedReceipt{ContentGranter: quest.NewContentGranter(s.contentSvc)}
			s.questSvc = quest.NewService(quest.NewPGStore(pool), cat, g, s.questPlayerLevel)
			s.questSvc.SetTutorialFactsProvider(questTutorialFactsProvider(pool))
			var resp *commonv1.ServerPacket
			if entry == "list" {
				resp, err = s.handleListPlayerQuests(ctx, &commonv1.ClientPacket{SessionId: "level-1-7", Payload: mustProto(&questv1.ListPlayerQuestsRequest{ChainId: 200, IncludeCompleted: true})})
			} else {
				resp, err = s.handleGetQuestChainStatus(ctx, &commonv1.ClientPacket{SessionId: "level-1-7", Payload: mustProto(&questv1.GetQuestChainStatusRequest{ChainId: 200})})
			}
			if err != nil || resp.Code != 0 {
				t.Fatalf("read %+v %v", resp, err)
			}
			row := wallRow(t, s, a)
			var level int32
			if err = pool.QueryRow(ctx, `SELECT level FROM player WHERE server_id=1 AND player_id=7`).Scan(&level); err != nil {
				t.Fatal(err)
			}
			t.Logf("entry=%s receipt reads=%d durable state=%d proof=%d persisted level=%d", entry, g.reads, row.State, row.Progress.ServerVerifiedVersion, level)
			if row.State != quest.StateCompleted || row.Progress.ServerVerifiedVersion != 2 {
				t.Fatalf("fixture did not recover completion %+v", row)
			}
			assertWallPayment(t, pool, 1)
			if level != 6 {
				t.Errorf("successful %s response left level one read behind after its own completed-proof recovery: %d", entry, level)
			}
		})
	}
}

func TestReviewerWallSecondReadLevelFailureIsExplicit(t *testing.T) {
	s, pool, a := wallLevelFixture(t)
	ctx := context.Background()
	tutorialSQL(t, pool, `INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,70,'wall',7,1)`)
	if _, _, err := s.questSvc.AcceptQuest(ctx, a, 1006); err != nil {
		t.Fatal(err)
	}
	cat, err := quest.MemCatalogFromPG(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	g := &wallInterleavedReceipt{ContentGranter: quest.NewContentGranter(s.contentSvc)}
	s.questSvc = quest.NewService(quest.NewPGStore(pool), cat, g, s.questPlayerLevel)
	s.questSvc.SetTutorialFactsProvider(questTutorialFactsProvider(pool))
	tutorialSQL(t, pool, `CREATE FUNCTION reviewer_fail_read_level() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.level>5 THEN RAISE EXCEPTION 'reviewer read level failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER reviewer_fail_read_level BEFORE UPDATE ON player FOR EACH ROW EXECUTE FUNCTION reviewer_fail_read_level()`)
	resp, err := s.handleListPlayerQuests(ctx, &commonv1.ClientPacket{SessionId: "level-1-7", Payload: mustProto(&questv1.ListPlayerQuestsRequest{ChainId: 200, IncludeCompleted: true})})
	if err != nil || resp.Code == 0 || resp.Msg != "quest operation failed" || len(resp.Data) != 0 {
		t.Fatalf("post-recovery level write failure not surfaced %+v %v", resp, err)
	}
	if row := wallRow(t, s, a); row.State != quest.StateCompleted || row.Progress.ServerVerifiedVersion != 2 {
		t.Fatalf("payment recovery lost %+v", row)
	}
	assertWallPayment(t, pool, 1)
	tutorialSQL(t, pool, `DROP TRIGGER reviewer_fail_read_level ON player`)
	if level, err := s.recoverWallAndLevel(ctx, a); err != nil || level != 6 {
		t.Fatalf("retry floor %d %v", level, err)
	}
	assertWallPayment(t, pool, 1)
}
