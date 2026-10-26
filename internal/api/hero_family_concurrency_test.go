package api

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestFamilyAtomicPGConcurrentTerminalTransitions(t *testing.T) {
	for _, kind := range []string{"accept-reject", "accept-accept", "summon-release", "summon-summon", "try-release", "try-summon", "release-release"} {
		t.Run(kind, func(t *testing.T) {
			pool, a := hotelFixture(t)
			b := hotelPeer(t, pool)
			if kind == "summon-release" || kind == "summon-summon" || kind == "try-summon" {
				// Both independently wired APIs need the explicitly injected 2050
				// test catalog; this is not natural embedded-catalog gameplay proof.
				familyCaptiveItemCatalog(t, a)
				familyCaptiveItemCatalog(t, b)
			}
			status, left, right := int16(hero.StatusCaptive), RouteSureSummonCaptive, RouteReleaseCaptive
			switch kind {
			case "accept-reject":
				status, left, right = hero.StatusComing, RouteSureAcceptComing, RouteRejectComing
			case "accept-accept":
				status, left, right = hero.StatusComing, RouteSureAcceptComing, RouteSureAcceptComing
			case "summon-summon":
				right = RouteSureSummonCaptive
			case "try-release":
				left = RouteTrySummonCaptive
			case "try-summon":
				left, right = RouteTrySummonCaptive, RouteSureSummonCaptive
			case "release-release":
				left = RouteReleaseCaptive
			}
			h := familySeed(t, a, status, 1, 60)
			recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,7,2050,2)`)
			before := readRecruitAssets(t, pool, 7)
			out := hotelRace(t, a, b, familyPacket(left, 0, h.HeroID, 0), familyPacket(right, 1, h.HeroID, 0))
			success := 0
			for _, r := range out {
				if r.Code == 0 {
					success++
				}
			}
			if left == RouteTrySummonCaptive {
				if out[1].Code != 0 || success < 1 {
					t.Fatalf("terminal operation lost to preview %+v %+v", out[0], out[1])
				}
			} else if success != 1 {
				t.Fatalf("duplicate terminal success %+v %+v", out[0], out[1])
			}
			exists, finalStatus, meta := familyHeroState(t, pool, h.HeroID)
			if meta != 0 || exists && finalStatus != hero.StatusIdle {
				t.Fatalf("partial transition %t %d %d", exists, finalStatus, meta)
			}
			want, qty := before, int32(2)
			if !exists {
				want.Heroes--
			} else if status == hero.StatusCaptive {
				want.Wallet.Gold -= hero.HeroSummonGold(h)
				qty = 0
			}
			if got := readRecruitAssets(t, pool, 7); got != want || familyItemQty(t, pool, 2050) != qty {
				t.Fatalf("partial/duplicate fee %+v want %+v", got, want)
			}
			state := familyState(t, pool)
			for _, route := range []string{left, right} {
				if r := b.GatewayRouter().Dispatch(context.Background(), familyPacket(route, 0, h.HeroID, 0)); r.Code == 0 || familyState(t, pool) != state {
					t.Fatalf("terminal metadata resurrected %+v", r)
				}
			}
		})
	}
}

func TestFamilyAtomicPGLionizeConcurrentProgress(t *testing.T) {
	for _, kind := range []string{"befriend-befriend", "befriend-persuade", "persuade-persuade", "hire-hire", "hire-persuade"} {
		t.Run(kind, func(t *testing.T) {
			pool, a := hotelFixture(t)
			b := hotelPeer(t, pool)
			left, right := RouteLionizeHero, RouteLionizeHero
			if kind != "befriend-befriend" && kind != "befriend-persuade" {
				familyDispatch(t, a, familyPacket(RouteLionizeHero, 1, 0, 1003), nil)
			}
			switch kind {
			case "befriend-persuade":
				right = RoutePersuadeHero
			case "persuade-persuade":
				left, right = RoutePersuadeHero, RoutePersuadeHero
			case "hire-hire", "hire-persuade":
				recruitSQL(t, pool, `UPDATE player_hero_lionize SET friend=$1`, hero.LionizeHireFriendMin)
				if kind == "hire-persuade" {
					right = RoutePersuadeHero
				}
			}
			before := readRecruitAssets(t, pool, 7)
			out := hotelRace(t, a, b, familyPacket(left, 1, 0, 1003), familyPacket(right, 2, 0, 1003))
			success := 0
			for _, r := range out {
				if r.Code == 0 {
					success++
				}
			}
			if kind == "befriend-persuade" {
				if out[0].Code != 0 || success < 1 {
					t.Fatalf("befriend lost %+v %+v", out[0], out[1])
				}
			} else if success != 1 {
				t.Fatalf("progress duplicated %+v %+v", out[0], out[1])
			}
			want, friend, state := before, int32(hero.LionizeInitialFriend), int16(hero.LionizeStateBefriended)
			switch kind {
			case "befriend-befriend", "befriend-persuade":
				plan, err := a.heroSvc.PlanLionize(hero.PlayerRef{ServerID: 1, PlayerID: 7}, hero.CityRef{CityID: 1}, 1003, nil, 2, nil)
				if err != nil {
					t.Fatal(err)
				}
				want.Wallet.Gold -= plan.GoldDebit
				if kind == "befriend-persuade" && out[1].Code == 0 {
					friend += hero.PersuadeFriendDelta
					want.Books -= hero.PersuadeItemQty
				}
			case "persuade-persuade":
				friend += hero.PersuadeFriendDelta
				want.Books -= hero.PersuadeItemQty
			default:
				want.Heroes++
				friend, state = hero.LionizeHireFriendMin, hero.LionizeStateRecruited
			}
			var gotFriend int32
			var gotState int16
			if err := pool.QueryRow(context.Background(), `SELECT friend,state FROM player_hero_lionize WHERE server_id=1 AND player_id=7 AND npc_cfg_id=1003`).Scan(&gotFriend, &gotState); err != nil || gotFriend != friend || gotState != state || readRecruitAssets(t, pool, 7) != want {
				t.Fatalf("progress/assets %d %d want %d %d, %v", gotFriend, gotState, friend, state, err)
			}
		})
	}
}

func TestFamilyAtomicPGCrossFamilySingleRemainingCapacity(t *testing.T) {
	for _, pair := range [][2]string{{"coming", "captive"}, {"coming", "hire"}, {"captive", "hire"}, {"coming", "hotel"}, {"captive", "hotel"}, {"hire", "hotel"}} {
		t.Run(pair[0]+"-"+pair[1], func(t *testing.T) {
			pool, a := hotelFixture(t)
			b := hotelPeer(t, pool)
			packets := [2]*commonv1.ClientPacket{}
			costs := [2]int64{}
			for i, kind := range pair {
				city := int64(i + 1)
				switch kind {
				case "coming":
					h := familySeed(t, a, hero.StatusComing, city, 1)
					packets[i] = familyPacket(RouteSureAcceptComing, city, h.HeroID, 0)
				case "captive":
					h := familySeed(t, a, hero.StatusCaptive, city, 1)
					packets[i], costs[i] = familyPacket(RouteSureSummonCaptive, city, h.HeroID, 0), hero.HeroSummonGold(h)
				case "hire":
					familyDispatch(t, a, familyPacket(RouteLionizeHero, city, 0, 1003), nil)
					recruitSQL(t, pool, `UPDATE player_hero_lionize SET friend=$1`, hero.LionizeHireFriendMin)
					packets[i] = familyPacket(RouteLionizeHero, city, 0, 1003)
				case "hotel":
					c := hotelListReply(t, a, city).Candidates[0]
					packets[i], costs[i] = hotelPacket(hotelRecruit, city, c.CandidateId), c.GoldCost
				}
			}
			recruitSQL(t, pool, `UPDATE city_building SET level=1 WHERE building_cfg_id=1`)
			before := readRecruitAssets(t, pool, 7)
			out := hotelRace(t, a, b, packets[0], packets[1])
			if (out[0].Code == 0) == (out[1].Code == 0) || familyOwned(t, pool) != 1 {
				t.Fatalf("capacity not shared %+v %+v", out[0], out[1])
			}
			winner := 0
			if out[1].Code == 0 {
				winner = 1
			}
			want := before
			want.Wallet.Gold -= costs[winner]
			if pair[winner] == "hire" || pair[winner] == "hotel" {
				want.Heroes++
			}
			if readRecruitAssets(t, pool, 7) != want {
				t.Fatalf("losing capacity transaction charged %+v want %+v", readRecruitAssets(t, pool, 7), want)
			}
		})
	}
}
