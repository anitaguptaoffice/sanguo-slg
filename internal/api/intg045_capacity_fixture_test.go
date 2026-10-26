package api_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

func smokeINTG045AssertOwned(t *testing.T, ctx context.Context, srv *api.Server, playerID int64, want int) {
	t.Helper()
	rows, err := srv.HeroService().Store.ListPlayerHeroes(ctx, intg006ServerID, playerID)
	if err != nil {
		t.Fatal(err)
	}
	if got := hero.CountOwnedHeroes(rows); got != want {
		t.Fatalf("owned heroes=%d want=%d", got, want)
	}
}

func smokeINTG045AssertIdle(t *testing.T, ctx context.Context, srv *api.Server, playerID, heroID int64, level int32, loyalty int) {
	t.Helper()
	h, err := srv.HeroService().Store.GetHero(ctx, intg006ServerID, heroID)
	if err != nil || h == nil || h.PlayerID != playerID || h.Status != hero.StatusIdle || h.Level != level || h.Loyalty != loyalty {
		t.Fatalf("converted hero=%+v want player=%d idle level=%d loyalty=%d err=%v", h, playerID, level, loyalty, err)
	}
}

func smokeINTG045AssertOffice(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, sid string, cityID int64, want int32) {
	t.Helper()
	// Reading the live domestic view must not erase the capacity fixture in PG.
	level, finish := smokeBuildingSlotFinishMS(t, c, sid, cityID, "hall")
	var persisted int32
	err := pool.QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=$3`, intg006ServerID, cityID, hero.BuildingCfgHeroOffice).Scan(&persisted)
	if err != nil || level != want || persisted != want || finish != 0 {
		t.Fatalf("office live=%d persisted=%d finish=%d want=%d err=%v", level, persisted, finish, want, err)
	}
}

// Upgrade exactly one canonical office slot per successful acquisition. Raw SQL
// level20 was overwritten by a wallet refresh of the live domestic hall1 cache.
// Normal upgrade + one canonical 300s speedup keeps both representations aligned.
func smokeINTG045UpgradeOffice(t *testing.T, ctx context.Context, c *websocket.Conn, srv *api.Server, pool *pgxpool.Pool, sid string, playerID, cityID int64, target int32) {
	t.Helper()
	smokeINTG045AssertOwned(t, ctx, srv, playerID, int(target-1))
	smokeINTG045AssertOffice(t, ctx, c, pool, sid, cityID, target-1)
	// cfg_building.json: hall base 200/200/100/50, growth1.6, floor per resource.
	costs := map[int32][4]int64{2: {320, 320, 160, 80}, 3: {512, 512, 256, 128}, 4: {819, 819, 409, 204}}
	cost, ok := costs[target]
	if !ok {
		t.Fatalf("unplanned office target=%d", target)
	}
	before := smokeGatewayGetCityState(t, c, sid, cityID).GetWallet()
	up := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteStartBuildingUpgrade, TraceId: fmt.Sprintf("i45-office-%d", target), SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&domesticv1.StartBuildingUpgradeRequest{CityId: cityID, SlotKey: "hall", BuildingCfgId: hero.BuildingCfgHeroOffice}),
	})
	if up.Code != 0 {
		t.Fatalf("office upgrade target=%d code=%d msg=%s", target, up.Code, up.Msg)
	}
	var out domesticv1.StartBuildingUpgradeResponse
	if err := proto.Unmarshal(up.Data, &out); err != nil {
		t.Fatal(err)
	}
	after := out.GetWallet()
	delta := [4]int64{before.GetFood() - after.GetFood(), before.GetWood() - after.GetWood(), before.GetStone() - after.GetStone(), before.GetIron() - after.GetIron()}
	if delta != cost || out.GetBuilding().GetLevel() != target-1 || out.GetFinishAtMs() <= 0 || out.GetQueueId() <= 0 {
		t.Fatalf("office upgrade target=%d delta=%v want=%v response=%+v", target, delta, cost, &out)
	}
	smokeINTG045OnlyBuildQueue(t, ctx, c, pool, sid, playerID, cityID, out.GetQueueId(), target)
	var seconds int64
	if err := pool.QueryRow(ctx, `SELECT (meta->>'speedup_sec')::bigint FROM cfg_item WHERE item_cfg_id=2003 AND item_type=2 AND meta->'applies_to' ? 'build'`).Scan(&seconds); err != nil || seconds != 300 {
		t.Fatalf("canonical speedup seconds=%d err=%v", seconds, err)
	}
	quantity := func() int32 {
		var n int32
		if err := pool.QueryRow(ctx, `SELECT COALESCE((SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=2003),0)`, intg006ServerID, playerID).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	bagBefore := quantity()
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg045-office", TicketID: "T-i45-office"}
	_, grant, err := srv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2003, Qty: 1}}}, fmt.Sprintf("intg045-office-%d", target))
	if err != nil || grant.Duplicate || quantity() != bagBefore+1 {
		t.Fatalf("office speedup grant target=%d err=%v duplicate=%v", target, err, grant.Duplicate)
	}
	use := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteUseConsumable, TraceId: fmt.Sprintf("i45-office-speed-%d", target), SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.UseConsumableRequest{ServerId: intg006ServerID, ItemCfgId: 2003, Count: 1}),
	})
	if use.Code != 0 {
		t.Fatalf("office speedup code=%d msg=%s", use.Code, use.Msg)
	}
	var used contentv1.UseConsumableResponse
	if err := proto.Unmarshal(use.Data, &used); err != nil {
		t.Fatal(err)
	}
	if used.GetSpeedupSeconds() != 300 || used.GetRemaining() != bagBefore || quantity() != bagBefore {
		t.Fatalf("office speedup wrong effect: %+v", &used)
	}
	smokeINTG045AssertOffice(t, ctx, c, pool, sid, cityID, target)
	t.Logf("INTG-045: canonical office%d->%d verified, resource debit=%v; speedup2003 grant+1/use-1; owned=%d", target-1, target, cost, target-1)
}

// The old speedup protocol has no city target. Flush/read every owned live
// city, then require exactly one eligible queue: this hall upgrade.
func smokeINTG045OnlyBuildQueue(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, sid string, playerID, cityID, queueID int64, target int32) {
	t.Helper()
	rows, err := pool.Query(ctx, `SELECT city_id FROM player_city WHERE server_id=$1 AND player_id=$2`, intg006ServerID, playerID)
	if err != nil {
		t.Fatal(err)
	}
	var cities []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		cities = append(cities, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	live := 0
	for _, id := range cities {
		state := smokeGatewayGetCityState(t, c, sid, id)
		for _, b := range state.GetBuildings() {
			if b.GetUpgradeFinishAtMs() > 0 {
				live++
				if id != cityID || b.GetSlotKey() != "hall" {
					t.Fatalf("other eligible build: city=%d building=%+v", id, b)
				}
			}
		}
	}
	var all, intended int
	err = pool.QueryRow(ctx, `SELECT count(*), count(*) FILTER(WHERE city_id=$3 AND queue_id=$4 AND status=1 AND payload->>'slot'='hall' AND (payload->>'target')::int=$5) FROM work_queue WHERE server_id=$1 AND player_id=$2 AND queue_type=1 AND status IN(0,1)`, intg006ServerID, playerID, cityID, queueID, target).Scan(&all, &intended)
	if err != nil || live != 1 || all != 1 || intended != 1 {
		t.Fatalf("speedup eligibility live=%d all=%d intended=%d err=%v", live, all, intended, err)
	}
}

// Full before/after PG state for the rejected acquisition, not a replacement
// expected restart snapshot. Include every hero, metadata row, wallet and bag.
func smokeINTG045CapacityState(t *testing.T, ctx context.Context, pool *pgxpool.Pool, playerID, cityID int64) string {
	t.Helper()
	var state string
	err := pool.QueryRow(ctx, `SELECT jsonb_build_object(
 'heroes',(SELECT jsonb_agg(to_jsonb(h) ORDER BY hero_id) FROM player_hero h WHERE server_id=$1 AND player_id=$2),
 'coming',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.hero_id) FROM player_hero_coming m JOIN player_hero h USING(server_id,hero_id) WHERE h.server_id=$1 AND h.player_id=$2),
 'captive',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.hero_id) FROM player_hero_captive m JOIN player_hero h USING(server_id,hero_id) WHERE h.server_id=$1 AND h.player_id=$2),
 'wallet',(SELECT to_jsonb(w) FROM player_wallet w WHERE server_id=$1 AND player_id=$2),
 'bag',(SELECT jsonb_agg(to_jsonb(i) ORDER BY item_cfg_id) FROM player_item i WHERE server_id=$1 AND player_id=$2),
 'queues',(SELECT jsonb_agg(to_jsonb(q) ORDER BY city_id,queue_type,queue_id) FROM work_queue q WHERE server_id=$1 AND player_id=$2),
 'buildings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY slot_key) FROM city_building b WHERE server_id=$1 AND city_id=$3)
 )::text`, intg006ServerID, playerID, cityID).Scan(&state)
	if err != nil {
		t.Fatal(err)
	}
	return state
}
