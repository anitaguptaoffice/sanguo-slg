package api

import (
	"context"
	"reflect"
	"strings"
	"testing"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestFamilyAtomicPGComingViewsAcceptRejectAndRestart(t *testing.T) {
	pool, s := hotelFixture(t)
	accept := familySeed(t, s, hero.StatusComing, 1, 7)
	reject := familySeed(t, s, hero.StatusComing, 2, 9)
	familySeed(t, s, hero.StatusCaptive, 1, 3)
	// Legacy rows may have zero loyalty; only that and status may change.
	recruitSQL(t, pool, `UPDATE player_hero SET loyalty=0,exp=123 WHERE hero_id=$1`, accept.HeroID)
	before := familyState(t, pool)
	var list herov1.ListComingHeroesResponse
	familyDispatch(t, s, familyPacket(RouteListComingHeroes, 0, 0, 0), &list)
	if len(list.Coming) != 2 || list.Coming[0].HeroId != accept.HeroID || list.Coming[0].CityId != 1 || list.Coming[1].CityId != 2 {
		t.Fatalf("coming list %+v", &list)
	}
	var pre herov1.TryAcceptComingResponse
	familyDispatch(t, s, familyPacket(RouteTryAcceptComing, 0, accept.HeroID, 0), &pre)
	if pre.HeroId != accept.HeroID || pre.Summary != "是否接受将领offer加入麾下？" || familyState(t, pool) != before {
		t.Fatalf("coming preview changed state %+v", &pre)
	}
	assets := readRecruitAssets(t, pool, 7)
	var got herov1.SureAcceptComingResponse
	familyDispatch(t, s, familyPacket(RouteSureAcceptComing, 0, accept.HeroID, 0), &got)
	if got.HeroId != accept.HeroID || got.Loyalty != 70 || got.Level != 7 || readRecruitAssets(t, pool, 7) != assets {
		t.Fatalf("accept identity/assets %+v", &got)
	}
	if exists, status, meta := familyHeroState(t, pool, accept.HeroID); !exists || status != hero.StatusIdle || meta != 0 {
		t.Fatalf("accept state %t %d %d", exists, status, meta)
	}
	restarted := hotelPeer(t, pool)
	tx, err := restarted.players.Pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	rows, err := restarted.heroSvc.Store.(*hero.PGStore).ListPlayerHeroesInTx(context.Background(), tx, 1, 7)
	_ = tx.Rollback(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := *accept
	want.Status, want.Loyalty, want.Exp = hero.StatusIdle, 70, 123
	if !reflect.DeepEqual(rows[0], &want) {
		t.Fatalf("accept rewrote fields %+v want %+v", rows[0], want)
	}
	familyDispatch(t, restarted, familyPacket(RouteRejectComing, 0, reject.HeroID, 0), new(herov1.RejectComingResponse))
	if exists, _, meta := familyHeroState(t, pool, reject.HeroID); exists || meta != 0 {
		t.Fatalf("reject left rows %t %d", exists, meta)
	}
	before = familyState(t, pool)
	for _, route := range []string{RouteTryAcceptComing, RouteSureAcceptComing, RouteRejectComing} {
		for _, id := range []int64{accept.HeroID, reject.HeroID} {
			if out := restarted.GatewayRouter().Dispatch(context.Background(), familyPacket(route, 1, id, 0)); out.Code == 0 || familyState(t, pool) != before {
				t.Fatalf("terminal operation %s %+v", route, out)
			}
		}
	}
}

func TestFamilyAtomicPGCaptivePlansCostsAndNoItemCases(t *testing.T) {
	for _, kind := range []string{"low-level", "inferred", "partial-id", "partial-quantity", "persisted"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := hotelFixture(t)
			if kind == "inferred" || kind == "persisted" {
				// The legacy 2050 placeholder is not embedded CONTENT catalog data.
				// Item-success atomicity is explicitly a catalog-injected fixture.
				familyCaptiveItemCatalog(t, s)
			}
			level := int32(60)
			if kind == "low-level" {
				level = 1
			}
			h := familySeed(t, s, hero.StatusCaptive, 1, level)
			recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,7,2050,9)`)
			rec := hero.CaptiveRecord{CityID: 1}
			switch kind {
			case "partial-id":
				rec.SummonItemCfgID = 2050
			case "partial-quantity":
				rec.SummonItemQty = 3
			case "persisted":
				rec.SummonItemCfgID, rec.SummonItemQty = 2050, 4
			}
			recruitSQL(t, pool, `UPDATE player_hero_captive SET summon_item_cfg_id=$2,summon_item_qty=$3 WHERE hero_id=$1`, h.HeroID, rec.SummonItemCfgID, rec.SummonItemQty)
			plan, err := hero.PlanCaptivePreview(hero.PlayerRef{ServerID: 1, PlayerID: 7}, 0, h, &rec)
			if err != nil {
				t.Fatal(err)
			}
			assets := readRecruitAssets(t, pool, 7)
			var list herov1.ListCaptiveHeroesResponse
			familyDispatch(t, s, familyPacket(RouteListCaptiveHeroes, 0, 0, 0), &list)
			if len(list.Captives) != 1 || list.Captives[0].HeroId != h.HeroID || list.Captives[0].CityId != 1 {
				t.Fatalf("captive list %+v", &list)
			}
			var pre herov1.TrySummonCaptiveResponse
			familyDispatch(t, s, familyPacket(RouteTrySummonCaptive, 0, h.HeroID, 0), &pre)
			if pre.GoldCost != plan.GoldDebit || pre.Summary != plan.Summary || len(pre.Items) != len(plan.ItemDebits) || readRecruitAssets(t, pool, 7) != assets {
				t.Fatalf("preview changed rules/assets %+v %+v", &pre, plan)
			}
			var saved hero.CaptiveRecord
			if err := pool.QueryRow(context.Background(), `SELECT city_id,summon_item_cfg_id,summon_item_qty FROM player_hero_captive WHERE hero_id=$1`, h.HeroID).Scan(&saved.CityID, &saved.SummonItemCfgID, &saved.SummonItemQty); err != nil || saved != plan.Record {
				t.Fatalf("preview requirements %+v %v", saved, err)
			}
			var out herov1.SureSummonCaptiveResponse
			familyDispatch(t, s, familyPacket(RouteSureSummonCaptive, 0, h.HeroID, 0), &out)
			want := assets
			want.Wallet.Gold -= plan.GoldDebit
			qty := int32(9)
			for _, it := range plan.ItemDebits {
				qty -= it.Quantity
			}
			if out.HeroId != h.HeroID || out.Loyalty != 50 || readRecruitAssets(t, pool, 7) != want || familyItemQty(t, pool, 2050) != qty {
				t.Fatalf("summon identity/debits %+v", &out)
			}
			if exists, status, meta := familyHeroState(t, pool, h.HeroID); !exists || status != hero.StatusIdle || meta != 0 {
				t.Fatalf("summon rows %t %d %d", exists, status, meta)
			}
			before := familyState(t, pool)
			for _, route := range []string{RouteTrySummonCaptive, RouteSureSummonCaptive, RouteReleaseCaptive} {
				if r := s.GatewayRouter().Dispatch(context.Background(), familyPacket(route, 0, h.HeroID, 0)); r.Code == 0 || familyState(t, pool) != before {
					t.Fatalf("terminal resurrection %s %+v", route, r)
				}
			}
		})
	}
}

func TestFamilyAtomicPGCaptiveReplansAfterStalePreview(t *testing.T) {
	pool, s := hotelFixture(t)
	familyCaptiveItemCatalog(t, s)
	h := familySeed(t, s, hero.StatusCaptive, 1, 1)
	var pre herov1.TrySummonCaptiveResponse
	familyDispatch(t, s, familyPacket(RouteTrySummonCaptive, 1, h.HeroID, 0), &pre)
	recruitSQL(t, pool, `UPDATE player_hero SET level=60 WHERE hero_id=$1`, h.HeroID)
	recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,7,2050,2)`)
	h.Level = 60
	before := readRecruitAssets(t, pool, 7)
	familyDispatch(t, s, familyPacket(RouteSureSummonCaptive, 1, h.HeroID, 0), new(herov1.SureSummonCaptiveResponse))
	want := before
	want.Wallet.Gold -= hero.HeroSummonGold(h)
	if pre.GoldCost == hero.HeroSummonGold(h) || readRecruitAssets(t, pool, 7) != want || familyItemQty(t, pool, 2050) != 0 {
		t.Fatal("summon used stale preview cost or requirements")
	}
}

func TestFamilyAtomicPGRejectsBusinessFailuresWithoutEffects(t *testing.T) {
	for _, kind := range []string{"coming-capacity", "captive-capacity", "gold", "item", "wrong-city", "missing-metadata", "wrong-owner"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := hotelFixture(t)
			if kind == "gold" || kind == "item" {
				familyCaptiveItemCatalog(t, s)
			}
			status, route := int16(hero.StatusCaptive), RouteSureSummonCaptive
			if kind == "coming-capacity" {
				status, route = hero.StatusComing, RouteSureAcceptComing
			}
			h := familySeed(t, s, status, 1, 60)
			city := int64(1)
			recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,7,2050,2)`)
			switch kind {
			case "coming-capacity", "captive-capacity":
				recruitSQL(t, pool, `UPDATE city_building SET level=0 WHERE building_cfg_id=1`)
			case "gold":
				recruitSQL(t, pool, `UPDATE player_wallet SET gold=0`)
			case "item":
				recruitSQL(t, pool, `DELETE FROM player_item WHERE item_cfg_id=2050`)
			case "wrong-city":
				city = 2
			case "missing-metadata":
				recruitSQL(t, pool, `DELETE FROM player_hero_captive`)
			case "wrong-owner":
				recruitSQL(t, pool, `UPDATE player_city SET player_id=9 WHERE city_id=1`)
				city = 0
			}
			before := familyState(t, pool)
			out := s.GatewayRouter().Dispatch(context.Background(), familyPacket(route, city, h.HeroID, 0))
			if out.Code == 0 || strings.Contains(out.Msg, "SQL") || familyState(t, pool) != before {
				t.Fatalf("business failure effects %+v", out)
			}
			if kind == "gold" && (out.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || out.Msg != hero.ErrInsufficientGold.Error()) ||
				kind == "item" && (out.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || out.Msg != hero.ErrInsufficientItem.Error()) {
				t.Fatalf("wrong asset error (not an unknown-catalog substitute): %+v", out)
			}
		})
	}
}
