package api

import (
	"context"
	"testing"

	commonpb "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
)

func TestWallActorPGStaleSessionCannotRepairOrphanHistory(t *testing.T) {
	for _, entry := range []string{"helper", "profile", "list", "chain", "accept", "claim", "hint"} {
		t.Run(entry, func(t *testing.T) {
			s, pool, a := wallLevelFixture(t)
			ctx := context.Background()
			cat, err := quest.MemCatalogFromPG(ctx, pool)
			if err != nil {
				t.Fatal(err)
			}
			cfg, _ := cat.Get(1006)
			if _, err = quest.NewContentGranter(s.contentSvc).GrantQuestReward(ctx, quest.GrantRequest{ServerID: 1, PlayerID: 7, QuestCfgID: 1006, IdempotencyKey: quest.QuestClaimIdempotencyKey(7, 1006), Rewards: cfg.Rewards}); err != nil {
				t.Fatal(err)
			}
			tutorialSQL(t, pool, `DELETE FROM player WHERE server_id=1 AND player_id=7`)
			var response *commonv1.ServerPacket
			packet := &commonv1.ClientPacket{SessionId: "level-1-7"}
			switch entry {
			case "helper":
				_, err = s.recoverWallAndLevel(ctx, a)
			case "profile":
				err = s.refreshTutorialProfile(ctx, &commonpb.PlayerProfile{ServerId: 1, PlayerId: 7})
			case "list":
				packet.Payload = mustProto(&questv1.ListPlayerQuestsRequest{ChainId: 200})
				response, err = s.handleListPlayerQuests(ctx, packet)
			case "chain":
				packet.Payload = mustProto(&questv1.GetQuestChainStatusRequest{ChainId: 200})
				response, err = s.handleGetQuestChainStatus(ctx, packet)
			case "accept":
				packet.Payload = mustProto(&questv1.AcceptQuestRequest{QuestCfgId: 1006})
				response, err = s.handleAcceptQuest(ctx, packet)
			case "claim":
				response = levelClaim(t, s, a, 1006)
			case "hint":
				s.questAfterWallHint(ctx, 1, 7)
			}
			if entry == "helper" || entry == "profile" {
				if err == nil {
					t.Fatalf("missing actor accepted at%s", entry)
				}
			} else if entry != "hint" && (err != nil || response == nil || response.Code == 0 || len(response.Data) != 0) {
				t.Fatalf("unsafe response %+v %v", response, err)
			}
			var rows, players int
			if err = pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_quest WHERE server_id=1 AND player_id=7),(SELECT count(*) FROM player WHERE server_id=1 AND player_id=7)`).Scan(&rows, &players); err != nil || rows != 0 || players != 0 {
				t.Fatalf("orphan history rows%d players%d %v", rows, players, err)
			}
			assertWallPayment(t, pool, 1)
		})
	}
}

func TestWallActorPGPreflightIsScopedAndCancelable(t *testing.T) {
	s, _, a := wallLevelFixture(t)
	ctx := context.Background()
	if err := s.requireWallActor(ctx, a); err != nil {
		t.Fatal(err)
	}
	for _, actor := range []quest.Actor{{ServerID: 2, PlayerID: 7}, {ServerID: 1, PlayerID: 8}, {ServerID: 0, PlayerID: 7}, {ServerID: 1, PlayerID: 0}} {
		if err := s.requireWallActor(ctx, actor); err == nil {
			t.Fatalf("wrong actor %+v", actor)
		}
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if err := s.requireWallActor(canceled, a); err == nil {
		t.Fatal("cancellation ignored")
	}
}
