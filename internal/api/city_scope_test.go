package api

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

// Each shard intentionally owns the same numeric city and player IDs. World
// ownership alone is therefore insufficient to select this shard-less Hub.
func scopeServer(t *testing.T) (*Server, *pgxpool.Pool) {
	t.Helper()
	s, pool, now, _ := registrationServer(t)
	recruitSQL(t, pool, `INSERT INTO player(server_id,player_id,account_id,display_name)
		SELECT 2,player_id,account_id,'other shard' FROM player;
		UPDATE player_wallet SET food=50000,wood=50000,stone=50000,iron=50000;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron) VALUES(2,55,60000,60000,60000,60000);
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,7,55,'local',1,1),(2,7,55,'foreign',22,22);
		INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,55,2003,3),(2,55,2003,3),(2,55,2001,1);
		INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,10,55,1001,1),(2,10,55,1001,1)`)
	for _, sid := range []int32{1, 2} {
		h := s.domestic
		if sid == 2 {
			h = domestic.NewHub(func() time.Time { return now })
			h.UseStore(domestic.NewPGStore(pool), sid, 0)
		}
		c := &domestic.CityState{ID: 7, PlayerID: 55, LastSettleAt: now,
			Buildings: map[string]*domestic.BuildingInstance{"hall": {CfgID: 1, Level: 3}, "farm": {CfgID: 2, Level: 1}}}
		if err := h.RegisterNewCity(context.Background(), c); err != nil {
			t.Fatal(err)
		}
	}
	s.hydratePlayerCities(context.Background(), PlayerContext{ServerID: 1, PlayerID: 55})
	if len(s.cachedCityIDs()) != 1 {
		t.Fatal("preloaded Hub hydration omitted API cache registration")
	}
	s.sessions.Bind("foreign", PlayerContext{ServerID: 2, PlayerID: 55})
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	s.contentSvc = content.NewService(cat)
	s.contentCatalog = &contentCatalogBinding{service: s.contentSvc, catalog: cat}
	s.contentSvc.UseStore(content.NewPGStore(pool))
	s.questSvc = quest.NewService(quest.NewPGStore(pool), quest.NewMemCatalog([]quest.QuestCfg{
		{QuestCfgID: 9001, QuestType: quest.QuestTypeDaily, ChainID: quest.DailyChainID, Repeatable: true, UnlockLevel: 1,
			Objectives: []quest.Objective{{Type: "collect_resource", Resource: "food", Count: 100}}},
		{QuestCfgID: 9002, QuestType: quest.QuestTypeDaily, ChainID: quest.DailyChainID, Repeatable: true, UnlockLevel: 1,
			Objectives: []quest.Objective{{Type: "train_troops", UnitCode: "militia", Count: 10}}},
	}), nil, nil)
	for _, sid := range []int32{1, 2} {
		for _, id := range []int32{9001, 9002} {
			if _, _, err := s.questSvc.AcceptQuest(context.Background(), quest.Actor{ServerID: sid, PlayerID: 55}, id); err != nil {
				t.Fatal(err)
			}
		}
	}
	return s, pool
}

func scopeRows(t *testing.T, pool *pgxpool.Pool) map[string]string {
	t.Helper()
	out := map[string]string{}
	for _, table := range []string{"player_wallet", "player_item", "city_production_checkpoint", "city_building", "work_queue", "player_quest", "player_hero", "hero_assignment"} {
		var rows string
		if err := pool.QueryRow(context.Background(), `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]')::text FROM `+table+` t`).Scan(&rows); err != nil {
			t.Fatal(err)
		}
		out[table] = rows
	}
	return out
}

func TestCityScopePGRejectsForeignShardAndPool(t *testing.T) {
	for _, mode := range []string{"foreign-shard", "distinct-pool"} {
		t.Run(mode, func(t *testing.T) {
			s, pool := scopeServer(t)
			if _, err := s.domestic.StartBuildingUpgrade(7, "farm", 2); err != nil {
				t.Fatal(err)
			}
			ctx, session := context.Background(), "foreign"
			pc := PlayerContext{ServerID: 2, PlayerID: 55}
			if mode == "distinct-pool" {
				other, err := pgxpool.NewWithConfig(ctx, pool.Config())
				if err != nil {
					t.Fatal(err)
				}
				defer other.Close()
				s.players.Pool = other
				pc.ServerID, session = 1, "owner"
			}
			cities, err := s.world.Store.PlayerCities(ctx, pc.ServerID, pc.PlayerID)
			if err != nil || len(cities) != 1 || cities[0].CityID != 7 {
				t.Fatalf("fixture must be an owned world row: %+v %v", cities, err)
			}
			before, city, military := scopeRows(t, pool), s.citySnapshot(7), s.military.SnapshotCity(7)
			coord, _ := s.cityCoordinate(7)
			for _, tc := range []struct {
				name    string
				request proto.Message
				handle  func(context.Context, *commonv1.ClientPacket) (*commonv1.ServerPacket, error)
			}{
				{"read", &domesticv1.GetCityStateRequest{CityId: 7}, s.handleGetCityState},
				{"upgrade", &domesticv1.StartBuildingUpgradeRequest{CityId: 7, SlotKey: "farm", BuildingCfgId: 2}, s.handleStartBuildingUpgrade},
				{"recruit-train", &militaryv1.RecruitTroopRequest{CityId: 7, UnitCfgId: 1, Count: 1}, s.handleRecruitTroop},
				{"march", &militaryv1.StartMarchRequest{CityId: 7, HeroId: 10}, s.handleStartMarch},
				{"list-marches", &militaryv1.ListMarchesRequest{}, s.handleListMarches},
				{"assign", &herov1.SetCityChiefRequest{CityId: 7, HeroId: 10}, s.handleSetCityChief},
				{"chief-read", &herov1.GetCityChiefRequest{CityId: 7}, s.handleGetCityChief},
				{"chief-clear", &herov1.ClearCityChiefRequest{CityId: 7}, s.handleClearCityChief},
				{"build-speedup", &contentv1.UseConsumableRequest{ItemCfgId: 2003, Count: 1}, s.handleUseConsumable},
			} {
				out, err := tc.handle(ctx, &commonv1.ClientPacket{SessionId: session, Payload: mustProto(tc.request)})
				if err != nil || out == nil || out.Code == 0 || len(out.Data) != 0 {
					t.Fatalf("%s allowed wrong Hub: %+v %v", tc.name, out, err)
				}
			}
			s.hydratePlayerCities(ctx, pc)
			s.refreshDomesticWalletAfterCommit(ctx, pc.ServerID, pc.PlayerID)
			s.applyDomesticBuildSpeedup(pc.ServerID, pc.PlayerID, 300)
			if got, _ := s.cityCoordinate(7); got != coord || !reflect.DeepEqual(city, s.citySnapshot(7)) || !reflect.DeepEqual(military, s.military.SnapshotCity(7)) || !reflect.DeepEqual(before, scopeRows(t, pool)) {
				t.Fatal("rejected scope changed cache, coordinates, wallet, proof, queue or assignment")
			}
			// The unloaded path must not load the configured shard's city either.
			freshHub := domestic.NewHub(nil)
			freshHub.UseStore(domestic.NewPGStore(pool), 1, 0)
			fresh := NewServer(nil, s.players.Pool, s.world, freshHub, march.NewHub(nil))
			fresh.hydratePlayerCities(ctx, pc)
			if fresh.playerOwnsCity(ctx, pc, 7) || fresh.citySnapshot(7) != nil || len(fresh.cachedCityIDs()) != 0 || fresh.military.SnapshotCity(7) != nil {
				t.Fatal("wrong scope hydrated an unloaded city")
			}
		})
	}
}

func TestCityScopePGConfiguredShardStillWorks(t *testing.T) {
	s, pool := scopeServer(t)
	ctx := context.Background()
	// A foreign-shard refresh must not import even a legitimate new local balance.
	recruitSQL(t, pool, `UPDATE player_wallet SET food=food+123 WHERE server_id=1`)
	before := s.citySnapshot(7)
	wallet, err := s.ShopWalletStore().Spend(ctx, content.PlayerRef{ServerID: 2, PlayerID: 55}, content.ResourceWallet{Food: 10})
	if err != nil || wallet.Food != 59990 {
		t.Fatalf("foreign shard wallet operation: %+v %v", wallet, err)
	}
	if !reflect.DeepEqual(before, s.citySnapshot(7)) {
		t.Fatal("foreign commit refreshed local Hub")
	}
	// Non-build consumables still use their own shard-keyed content boundary.
	out, err := s.handleUseConsumable(ctx, &commonv1.ClientPacket{SessionId: "foreign", Payload: mustProto(&contentv1.UseConsumableRequest{ItemCfgId: 2001, Count: 1})})
	if err != nil || out == nil || out.Code != 0 || !reflect.DeepEqual(before, s.citySnapshot(7)) {
		t.Fatalf("foreign resource pack should remain independent: %+v %v", out, err)
	}
	s.refreshDomesticWalletAfterCommit(ctx, 1, 55)
	if s.citySnapshot(7).Wallet.Food != before.Wallet.Food+123 {
		t.Fatal("configured-shard refresh did not reconcile")
	}
	for _, tc := range []struct {
		request proto.Message
		handle  func(context.Context, *commonv1.ClientPacket) (*commonv1.ServerPacket, error)
	}{
		{&domesticv1.GetCityStateRequest{CityId: 7}, s.handleGetCityState},
		{&domesticv1.StartBuildingUpgradeRequest{CityId: 7, SlotKey: "farm", BuildingCfgId: 2}, s.handleStartBuildingUpgrade},
		{&militaryv1.RecruitTroopRequest{CityId: 7, UnitCfgId: 1, Count: 1}, s.handleRecruitTroop},
		{&militaryv1.ListMarchesRequest{}, s.handleListMarches},
		{&herov1.SetCityChiefRequest{CityId: 7, HeroId: 10}, s.handleSetCityChief},
		{&herov1.GetCityChiefRequest{CityId: 7}, s.handleGetCityChief},
		{&herov1.ClearCityChiefRequest{CityId: 7}, s.handleClearCityChief},
		{&contentv1.UseConsumableRequest{ItemCfgId: 2003, Count: 1}, s.handleUseConsumable},
	} {
		out, err := tc.handle(ctx, &commonv1.ClientPacket{SessionId: "owner", Payload: mustProto(tc.request)})
		if err != nil || out == nil || out.Code != 0 {
			t.Fatalf("configured shard %T: %+v %v", tc.request, out, err)
		}
	}
}

func TestHeroCityOwnershipRequiresWorldEvenWithCache(t *testing.T) {
	s, pool := scopeServer(t)
	ctx, pc := context.Background(), PlayerContext{ServerID: 1, PlayerID: 55}
	before := scopeRows(t, pool)
	for _, unavailable := range []*world.Service{nil, {}, world.NewService(&cityOwnershipStore{err: errors.New("unavailable")}), ownershipWorld()} {
		s.world = unavailable
		if s.playerOwnsCity(ctx, pc, 7) {
			t.Fatal("cached hero ownership bypassed unavailable/absent world ownership")
		}
		out, err := s.handleSetCityChief(ctx, &commonv1.ClientPacket{SessionId: "owner", Payload: mustProto(&herov1.SetCityChiefRequest{CityId: 7, HeroId: 10})})
		if err != nil || out == nil || out.Code == 0 {
			t.Fatalf("unavailable world assignment: %+v %v", out, err)
		}
	}
	if !reflect.DeepEqual(before, scopeRows(t, pool)) {
		t.Fatal("world-unavailable hero request mutated durable state")
	}
}

func TestCityScopePGAlternateContentCatalogCannotBypass(t *testing.T) {
	s, pool := scopeServer(t)
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	// Reinterpret a normal resource pack as a build speedup in an alternate
	// service, then bind its actual catalog too. Both paths must reject pre-debit.
	def := cat.Items[2003]
	def.ID = 2001
	cat.Items[2001] = def
	s.contentSvc = content.NewService(cat)
	s.contentSvc.UseStore(content.NewPGStore(pool))
	before := scopeRows(t, pool)
	for _, bind := range []bool{false, true} {
		if bind {
			s.contentCatalog = &contentCatalogBinding{service: s.contentSvc, catalog: cat}
		}
		out, err := s.handleUseConsumable(context.Background(), &commonv1.ClientPacket{SessionId: "foreign", Payload: mustProto(&contentv1.UseConsumableRequest{ItemCfgId: 2001, Count: 1})})
		if err != nil || out == nil || out.Code == 0 || !reflect.DeepEqual(before, scopeRows(t, pool)) {
			t.Fatalf("alternate build effect bypassed scope (bound=%v): %+v %v", bind, out, err)
		}
	}
}
