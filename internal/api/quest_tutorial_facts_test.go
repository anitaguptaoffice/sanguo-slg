package api

import (
	"context"
	"errors"
	"math"
	"os"
	"reflect"
	"testing"
	"time"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/jackc/pgx/v5/pgxpool"
)

func tutorialSQL(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

func TestTutorialFactsPersistedIsolationPG(t *testing.T) {
	pool, ctx := walletBoundaryPool(t, true), context.Background()
	tutorialSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES
		(1,10,7,'a',1,1),(1,11,7,'b',2,1),(1,12,8,'other owner',3,1),(2,10,7,'other shard',1,1);
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level,upgrade_finish_at) VALUES
		(1,10,'hall',1,1,now()+interval '1 hour'),(1,11,'hall',1,2,NULL),(1,11,'farm',2,3,NULL),
		(1,12,'hall',1,99,NULL),(2,10,'hall',1,88,NULL),(1,99,'orphan',6,99,NULL);
		INSERT INTO work_queue(server_id,queue_id,player_id,city_id,queue_type,payload,start_at,finish_at)
		VALUES(1,1,7,10,1,'{"cfg_id":1,"target":99}',now(),now()+interval '1 hour');
		INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id) VALUES(1,1,8,1001),(2,1,7,1001)`)
	provider := questTutorialFactsProvider(pool)
	facts, err := provider(ctx, quest.Actor{ServerID: 1, PlayerID: 7})
	if err != nil || facts.HasOwnedHero || !reflect.DeepEqual(facts.CompletedBuildingLevels, map[int32]int32{1: 2, 2: 3}) {
		t.Fatalf("persisted owned maxima: %+v %v", facts, err)
	}
	for status := 0; status <= 7; status++ {
		tutorialSQL(t, pool, `INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status)
			VALUES(1,2,7,1001,$1) ON CONFLICT(server_id,hero_id) DO UPDATE SET status=$1`, status)
		facts, err = provider(ctx, quest.Actor{ServerID: 1, PlayerID: 7})
		if err != nil || !facts.HasOwnedHero {
			t.Fatalf("hero status %d: %+v %v", status, facts, err)
		}
	}
	facts, err = provider(ctx, quest.Actor{ServerID: 3, PlayerID: 7})
	if err != nil || facts.HasOwnedHero || len(facts.CompletedBuildingLevels) != 0 {
		t.Fatalf("empty actor: %+v %v", facts, err)
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := provider(canceled, quest.Actor{ServerID: 1, PlayerID: 7}); err == nil {
		t.Fatal("provider hid cancellation")
	}
	if _, err := questTutorialFactsProvider(nil)(ctx, quest.Actor{}); err == nil {
		t.Fatal("missing persistence accepted")
	}
}

func TestTutorialPublicProgressRejectedAndTrustedDailyPreserved(t *testing.T) {
	ctx, store := context.Background(), quest.NewMemStore()
	cfgs := append(devQuestCatalog().All(), quest.QuestCfg{QuestCfgID: 9001, QuestType: quest.QuestTypeDaily,
		ChainID: quest.DailyChainID, Objectives: []quest.Objective{{Type: "recruit_hero", Count: 1}}})
	s := NewServer(nil, nil, nil, nil, nil)
	s.questSvc = quest.NewService(store, quest.NewMemCatalog(cfgs), nil, nil)
	s.BindSessionForTest("actor", PlayerContext{ServerID: 1, PlayerID: 7})
	actor := quest.Actor{ServerID: 1, PlayerID: 7}
	for _, id := range []int32{1001, 9001} {
		if _, _, err := s.questSvc.AcceptQuest(ctx, actor, id); err != nil {
			t.Fatal(err)
		}
		for _, value := range []int32{math.MinInt32, -1, 0, 1, math.MaxInt32} {
			for _, absolute := range []bool{true, false} {
				pkt := &commonv1.ClientPacket{SessionId: "actor", Payload: mustProto(&questv1.ReportQuestProgressRequest{
					ServerId: 2, QuestCfgId: id, Absolute: absolute, ProgressValue: value, EventType: "server_verified_version=1;recruit_hero",
				})}
				for replay := 0; replay < 2; replay++ {
					resp, err := s.handleReportQuestProgress(ctx, pkt)
					if err != nil || resp.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) {
						t.Fatalf("public report: %+v %v", resp, err)
					}
				}
			}
		}
		row, _, err := store.GetPlayerQuest(ctx, 1, 7, id)
		if err != nil || row.State != quest.StateInProgress || row.Progress != (quest.ProgressCounter{}) {
			t.Fatalf("spoof changed progress: %+v %v", row, err)
		}
	}
	s.questAfterRecruitHero(ctx, 1, 7)
	row, _, _ := store.GetPlayerQuest(ctx, 1, 7, 9001)
	if row.State != quest.StateClaimable || row.Progress.Count != 1 {
		t.Fatalf("trusted daily disabled: %+v", row)
	}
	s.questSvc.SetTutorialFactsProvider(func(context.Context, quest.Actor) (quest.TutorialFacts, error) {
		return quest.TutorialFacts{CompletedBuildingLevels: map[int32]int32{1: 2}}, nil
	})
	s.questAfterUseItem(ctx, 1, 7, "speedup_build_5m", 1)
	row, _, _ = store.GetPlayerQuest(ctx, 1, 7, 1001)
	if row.Progress.ServerVerifiedVersion != 1 {
		t.Fatalf("speedup completion did not reconcile: %+v", row)
	}
	for _, pkt := range []*commonv1.ClientPacket{
		{SessionId: "missing"}, {SessionId: "actor", ServerId: 2}, {SessionId: "actor", Payload: []byte{255}},
	} {
		if resp, err := s.handleReportQuestProgress(ctx, pkt); err != nil || resp.Code == 0 {
			t.Fatalf("invalid caller accepted: %+v %v", resp, err)
		}
	}
}

func TestTutorialReconciliationHooksAndReadsPG(t *testing.T) {
	ctx, pool := context.Background(), walletBoundaryPool(t, true)
	// Authenticated fixture actors need real rows for authoritative level repair.
	tutorialSQL(t, pool, `WITH a AS (INSERT INTO account(login_name,password_hash)
        SELECT 'facts-'||id,'fixture' FROM generate_series(7,10) id RETURNING account_id,login_name)
        INSERT INTO player(server_id,player_id,account_id,display_name)
        SELECT 1,substring(login_name from 7)::bigint,account_id,login_name FROM a`)

	raw, err := os.ReadFile("../../spec/data/generated/cfg_quest.sql")
	if err != nil {
		t.Fatal(err)
	}
	tutorialSQL(t, pool, string(raw)) // Unchanged official DATA-002, not rewritten fixtures.
	s := starterServer(t, pool, 0)
	now := time.Now().UTC()
	s.domestic = domestic.NewHub(func() time.Time { return now })
	s.domestic.UseStore(domestic.NewPGStore(pool), 1, 0)
	city := &domestic.CityState{ID: 10, PlayerID: 7, LastSettleAt: now,
		Wallet:    domestic.Resources{Food: 50000, Wood: 50000, Iron: 50000, Stone: 50000},
		Buildings: map[string]*domestic.BuildingInstance{"hall": {CfgID: 1, Level: 1}}}
	tutorialSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,10,7,'a',1,1)`)
	if err := s.domestic.RegisterNewCity(ctx, city); err != nil {
		t.Fatal(err)
	}
	s.cacheCity(10, city)
	s.registerNewCity(10, 1, 1)
	s.BindSessionForTest("actor", PlayerContext{ServerID: 1, PlayerID: 7})
	check := func(id int32, state int16, proof int32) {
		t.Helper()
		row, has, err := quest.NewPGStore(pool).GetPlayerQuest(ctx, 1, 7, id)
		if err != nil || !has || row.State != state || row.Progress.ServerVerifiedVersion != proof {
			t.Fatalf("quest %d: %+v %v", id, row, err)
		}
	}
	pkt := &commonv1.ClientPacket{SessionId: "actor", Payload: mustProto(&questv1.AcceptQuestRequest{QuestCfgId: 1001})}
	if resp, err := s.handleAcceptQuest(ctx, pkt); err != nil || resp.Code != 0 {
		t.Fatalf("accept: %+v %v", resp, err)
	}
	pkt.Payload = mustProto(&domesticv1.StartBuildingUpgradeRequest{CityId: 10, SlotKey: "hall", BuildingCfgId: 1})
	if resp, err := s.handleStartBuildingUpgrade(ctx, pkt); err != nil || resp.Code != 0 {
		t.Fatalf("upgrade: %+v %v", resp, err)
	}
	check(1001, quest.StateInProgress, 0)
	now = now.Add(time.Hour) // Fault/clock fixture, not natural-play timing evidence.
	pkt.Payload = mustProto(&domesticv1.GetCityStateRequest{CityId: 10})
	if resp, err := s.handleGetCityState(ctx, pkt); err != nil || resp.Code != 0 {
		t.Fatalf("finish: %+v %v", resp, err)
	}
	check(1001, quest.StateClaimable, 1)
	pkt.Payload = mustProto(&questv1.ClaimQuestRewardRequest{QuestCfgId: 1001})
	if resp, err := s.handleClaimQuestReward(ctx, pkt); err != nil || resp.Code != 0 {
		t.Fatalf("claim: %+v %v", resp, err)
	}
	pkt.Payload = mustProto(&questv1.AcceptQuestRequest{QuestCfgId: 1002})
	if resp, err := s.handleAcceptQuest(ctx, pkt); err != nil || resp.Code != 0 {
		t.Fatalf("accept hero: %+v %v", resp, err)
	}
	if _, err := s.contentSvc.Grant(content.PlayerRef{ServerID: 1, PlayerID: 7}, content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2004, Qty: 1}}}, "test-book"); err != nil {
		t.Fatal(err)
	}
	pkt.Payload = mustProto(&herov1.RecruitHeroRequest{TemplateCfgId: 1001})
	if resp, err := s.handleRecruitHero(ctx, pkt); err != nil || resp.Code != 0 {
		t.Fatalf("recruit: %+v %v", resp, err)
	}
	check(1002, quest.StateClaimable, 1)
	// A separate actor did the action before accepting; session identity wins.
	s.BindSessionForTest("other", PlayerContext{ServerID: 1, PlayerID: 8})
	tutorialSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,11,8,'b',2,1);
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,11,'hall',1,2)`)
	pkt = &commonv1.ClientPacket{SessionId: "other", Payload: mustProto(&questv1.AcceptQuestRequest{ServerId: 2, QuestCfgId: 1001})}
	if resp, err := s.handleAcceptQuest(ctx, pkt); err != nil || resp.Code != 0 {
		t.Fatalf("action before accept: %+v %v", resp, err)
	}
	row, _, _ := quest.NewPGStore(pool).GetPlayerQuest(ctx, 1, 8, 1001)
	if row.Progress.ServerVerifiedVersion != 1 {
		t.Fatalf("missing actor-scoped accept proof: %+v", row)
	}
	for _, id := range []int64{9, 10} {
		s.BindSessionForTest("late", PlayerContext{ServerID: 1, PlayerID: id})
		pkt = &commonv1.ClientPacket{SessionId: "late", Payload: mustProto(&questv1.AcceptQuestRequest{QuestCfgId: 1001})}
		if resp, err := s.handleAcceptQuest(ctx, pkt); err != nil || resp.Code != 0 {
			t.Fatalf("accept before missed event: %+v %v", resp, err)
		}
		tutorialSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,$1+100,$1,'late',$1,1);
			`, id)
		tutorialSQL(t, pool, `INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,$1+100,'hall',1,2)`, id)
		pkt.Payload = mustProto(&questv1.GetQuestChainStatusRequest{ChainId: 100})
		handle := s.handleGetQuestChainStatus
		if id == 10 {
			pkt.Payload = mustProto(&questv1.ListPlayerQuestsRequest{ChainId: 100})
			handle = s.handleListPlayerQuests
		}
		if resp, err := handle(ctx, pkt); err != nil || resp.Code != 0 {
			t.Fatalf("missed event read repair: %+v %v", resp, err)
		}
		row, _, _ := quest.NewPGStore(pool).GetPlayerQuest(ctx, 1, id, 1001)
		if row.Progress.ServerVerifiedVersion != 1 {
			t.Fatalf("read missing proof: %+v", row)
		}
	}
	// No normalization of malformed database config into the dev fallback.
	tutorialSQL(t, pool, `UPDATE cfg_quest SET quest_type=0 WHERE quest_cfg_id=1001`)
	s = starterServer(t, pool, 0)
	s.BindSessionForTest("actor", PlayerContext{ServerID: 1, PlayerID: 7})
	pkt = &commonv1.ClientPacket{SessionId: "actor", Payload: mustProto(&questv1.GetQuestChainStatusRequest{ChainId: 100})}
	if resp, err := s.handleGetQuestChainStatus(ctx, pkt); err != nil || resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) {
		t.Fatalf("corrupt config normalized: %+v %v", resp, err)
	}
}

func TestTutorialProviderFailureSafeResponses(t *testing.T) {
	s, store, ctx := NewServer(nil, nil, nil, nil, nil), quest.NewMemStore(), context.Background()
	s.questSvc = quest.NewService(store, devQuestCatalog(), nil, nil)
	s.questSvc.SetTutorialFactsProvider(func(context.Context, quest.Actor) (quest.TutorialFacts, error) {
		return quest.TutorialFacts{}, errors.New("secret SQL connection details")
	})
	s.BindSessionForTest("actor", PlayerContext{ServerID: 1, PlayerID: 7})
	for _, request := range []struct {
		payload []byte
		handle  func(context.Context, *commonv1.ClientPacket) (*commonv1.ServerPacket, error)
	}{
		{mustProto(&questv1.AcceptQuestRequest{QuestCfgId: 1001}), s.handleAcceptQuest},
		{mustProto(&questv1.ListPlayerQuestsRequest{ChainId: 100}), s.handleListPlayerQuests},
		{mustProto(&questv1.GetQuestChainStatusRequest{ChainId: 100}), s.handleGetQuestChainStatus},
	} {
		resp, err := request.handle(ctx, &commonv1.ClientPacket{SessionId: "actor", Payload: request.payload})
		if err != nil || resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || resp.Msg != "quest operation failed" {
			t.Fatalf("unsafe provider response: %+v %v", resp, err)
		}
	}
	row, _, _ := store.GetPlayerQuest(ctx, 1, 7, 1001)
	if row.State != quest.StateInProgress || row.Progress.ServerVerifiedVersion != 0 {
		t.Fatalf("provider failure proved quest: %+v", row)
	}
}
