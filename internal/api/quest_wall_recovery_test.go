package api

import (
	"context"
	"errors"
	"testing"

	commonpb "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
)

func TestWallLevelPGPaidMissingHistoryReadAndExplicitClaim(t *testing.T) {
	s, pool, a := wallLevelFixture(t)
	ctx := context.Background()
	cat, err := quest.MemCatalogFromPG(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	cfg, ok := cat.Get(1006)
	if !ok {
		t.Fatal("canonical wall config missing")
	}
	// An exact old successful payment with no quest row, never a new entitlement.
	if _, err = quest.NewContentGranter(s.contentSvc).GrantQuestReward(ctx, quest.GrantRequest{ServerID: 1, PlayerID: 7, QuestCfgID: 1006, IdempotencyKey: quest.QuestClaimIdempotencyKey(7, 1006), Rewards: cfg.Rewards}); err != nil {
		t.Fatal(err)
	}
	tutorialSQL(t, pool, `INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,70,'wall',7,1)`)
	profile := &commonpb.PlayerProfile{ServerId: 1, PlayerId: 7}
	if err = s.refreshTutorialProfile(ctx, profile); err != nil || profile.Level != 5 {
		t.Fatalf("paid passive profile%+v %v", profile, err)
	}
	row := wallRow(t, s, a)
	if row.State != quest.StateCompleted || row.AcceptedAt != nil || row.Progress.ServerVerifiedVersion != 0 {
		t.Fatalf("history repair %+v", row)
	}
	if _, _, err = s.questSvc.AcceptQuest(ctx, a, 1006); !errors.Is(err, quest.ErrAlreadyCompleted) {
		t.Fatalf("paid acceptance %v", err)
	}
	if row = wallRow(t, s, a); row.AcceptedAt != nil {
		t.Fatal("receipt created acceptance")
	}
	assertWallPayment(t, pool, 1)
	if resp := levelClaim(t, s, a, 1006); resp.Msg != quest.ErrAlreadyCompleted.Error() {
		t.Fatalf("explicit %+v", resp)
	}
	if err = s.refreshTutorialProfile(ctx, profile); err != nil || profile.Level != 6 {
		t.Fatalf("explicit profile%+v %v", profile, err)
	}
	assertWallPayment(t, pool, 1)
}

func TestWallLevelPGReadPathsAndCollateralGates(t *testing.T) {
	s, pool, a := wallLevelFixture(t)
	ctx := context.Background()
	tutorialSQL(t, pool, `INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,70,'wall',7,1)`)
	for _, id := range []int32{1009, 1014, 1018} {
		if _, _, err := s.questSvc.AcceptQuest(ctx, a, id); !errors.Is(err, quest.ErrLevelTooLow) {
			t.Fatalf("premature gate%d %v", id, err)
		}
	}
	if _, _, err := s.questSvc.AcceptQuest(ctx, a, 1006); err != nil {
		t.Fatal(err)
	}
	if resp := levelClaim(t, s, a, 1006); resp.Code != 0 {
		t.Fatalf("wall %+v", resp)
	}
	for _, read := range []struct {
		payload []byte
		handle  func(context.Context, *commonv1.ClientPacket) (*commonv1.ServerPacket, error)
	}{
		{mustProto(&questv1.ListPlayerQuestsRequest{ChainId: 200, IncludeCompleted: true}), s.handleListPlayerQuests},
		{mustProto(&questv1.GetQuestChainStatusRequest{ChainId: 200}), s.handleGetQuestChainStatus},
	} {
		tutorialSQL(t, pool, `UPDATE player SET level=5 WHERE server_id=1 AND player_id=7`)
		resp, err := read.handle(ctx, &commonv1.ClientPacket{SessionId: "level-1-7", Payload: read.payload})
		var level int32
		dbErr := pool.QueryRow(ctx, `SELECT level FROM player WHERE server_id=1 AND player_id=7`).Scan(&level)
		if err != nil || resp.Code != 0 || dbErr != nil || level != 6 {
			t.Fatalf("read floor%d response%+v %v %v", level, resp, err, dbErr)
		}
	}
	for _, id := range []int32{1007, 1009, 1014, 1018} {
		if _, _, err := s.questSvc.AcceptQuest(ctx, a, id); err != nil && !errors.Is(err, quest.ErrAlreadyAccepted) {
			t.Fatalf("existing gate%d %v", id, err)
		}
	}
	s.questAfterTrainTroops(ctx, 1, 7, 1, 50)
	s.questAfterUseItem(ctx, 1, 7, "map_fragment", 3)
	for _, id := range []int32{1007, 1009, 1014, 1018} {
		row, has, err := quest.NewPGStore(pool).GetPlayerQuest(ctx, 1, 7, id)
		if err != nil || !has {
			t.Fatalf("row%d %+v %v", id, row, err)
		}
		if id == 1014 {
			if row.State != quest.StateClaimable || row.Progress.Count != 50 {
				t.Fatalf("existing daily behavior %+v", row)
			}
		} else if row.State != quest.StateInProgress || row.Progress.Count != 0 {
			t.Fatalf("extended non-wall objective%d %+v", id, row)
		}
	}
}

func TestWallLevelPGCorruptLegacyReceiptCannotVerifyFloor(t *testing.T) {
	s, pool, a := wallLevelFixture(t)
	tutorialSQL(t, pool, `INSERT INTO player_quest(server_id,player_id,quest_cfg_id,state,progress) VALUES(1,7,1006,3,'{}');
 INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,70,'wall',7,1);
 INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,rewards,status,idempotency_key,completed_at)
 VALUES(1,1,7,'quest','1006','{"resources":{"wood":801}}',2,'quest:7:1006:claim',now())`)
	resp := levelClaim(t, s, a, 1006)
	if resp.Code == 0 || resp.Msg != "quest operation failed" {
		t.Fatalf("corrupt receipt %+v", resp)
	}
	if row := wallRow(t, s, a); row.Progress.ServerVerifiedVersion != 0 || row.AcceptedAt != nil {
		t.Fatalf("corrupt proof %+v", row)
	}
	if got, err := s.reconcileTutorialLevel(context.Background(), a); err != nil || got != 5 {
		t.Fatalf("corrupt floor%d %v", got, err)
	}
}
