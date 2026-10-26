package api

import (
	"context"
	"testing"
	"time"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
)

func TestFamilyAtomicPGLionizeFullProgressExactCostsAndRestart(t *testing.T) {
	pool, s := hotelFixture(t)
	before := familyState(t, pool)
	var targets herov1.ListPersuadeTargetsResponse
	familyDispatch(t, s, familyPacket(RouteListPersuadeTargets, 0, 0, 0), &targets)
	if len(targets.Targets) != len(hero.DefaultPersuadeTargets()) || familyState(t, pool) != before {
		t.Fatalf("target list fabricated progress %+v", &targets)
	}
	for i, target := range hero.DefaultPersuadeTargets() {
		got := targets.Targets[i]
		if got.NpcCfgId != target.NpcCfgID || got.TemplateCfgId != target.TemplateCfgID || got.Friend != 0 || got.State != 0 || got.NextPersuadeAtMs != 0 {
			t.Fatalf("target defaults %+v", got)
		}
	}
	pc := hero.PlayerRef{ServerID: 1, PlayerID: 7}
	plan, err := s.heroSvc.PlanLionize(pc, hero.CityRef{CityID: 1}, 1003, nil, 2, nil)
	if err != nil {
		t.Fatal(err)
	}
	assets := readRecruitAssets(t, pool, 7)
	var befriended herov1.LionizeHeroResponse
	familyDispatch(t, s, familyPacket(RouteLionizeHero, 1, 0, 1003), &befriended)
	want := assets
	want.Wallet.Gold -= plan.GoldDebit
	if !befriended.Befriended || befriended.Recruited || befriended.HeroId != 0 || befriended.GoldSpent != plan.GoldDebit || befriended.Friend != hero.LionizeInitialFriend || readRecruitAssets(t, pool, 7) != want {
		t.Fatalf("befriend exact fee %+v", &befriended)
	}
	before = familyState(t, pool)
	if r := s.GatewayRouter().Dispatch(context.Background(), familyPacket(RouteLionizeHero, 1, 0, 1003)); r.Code == 0 || familyState(t, pool) != before {
		t.Fatalf("premature hire changed state %+v", r)
	}
	var persuaded herov1.PersuadeHeroResponse
	familyDispatch(t, s, familyPacket(RoutePersuadeHero, 1, 0, 1003), &persuaded)
	want.Books -= hero.PersuadeItemQty
	if persuaded.Friend != hero.LionizeInitialFriend+hero.PersuadeFriendDelta || persuaded.FriendDelta != hero.PersuadeFriendDelta || persuaded.NextPersuadeAtMs != hotelTestNow.Add(time.Duration(hero.PersuadeCooldownSeconds)*time.Second).UnixMilli() || readRecruitAssets(t, pool, 7) != want {
		t.Fatalf("persuade exact item/cooldown %+v", &persuaded)
	}
	before = familyState(t, pool)
	if r := s.GatewayRouter().Dispatch(context.Background(), familyPacket(RoutePersuadeHero, 1, 0, 1003)); r.Code == 0 || familyState(t, pool) != before {
		t.Fatalf("cooldown mutated %+v", r)
	}
	restarted := hotelPeer(t, pool)
	next := hotelTestNow.Add(time.Duration(hero.PersuadeCooldownSeconds) * time.Second)
	restarted.SetClock(func() time.Time { return next })
	familyDispatch(t, restarted, familyPacket(RoutePersuadeHero, 2, 0, 1003), &persuaded)
	want.Books -= hero.PersuadeItemQty
	if persuaded.Friend != hero.LionizeHireFriendMin || readRecruitAssets(t, pool, 7) != want {
		t.Fatalf("persisted progress %+v", &persuaded)
	}
	var hired herov1.LionizeHeroResponse
	familyDispatch(t, restarted, familyPacket(RouteLionizeHero, 2, 0, 1003), &hired)
	want.Heroes++
	if !hired.Recruited || hired.Befriended || hired.HeroId < 1000 || hired.GoldSpent != 0 || hired.State != int32(hero.LionizeStateRecruited) || readRecruitAssets(t, pool, 7) != want {
		t.Fatalf("hire identity/cost %+v", &hired)
	}
	var template, level, loyalty int32
	var status int16
	if err := pool.QueryRow(context.Background(), `SELECT template_cfg_id,level,loyalty,status FROM player_hero WHERE hero_id=$1`, hired.HeroId).Scan(&template, &level, &loyalty, &status); err != nil || template != 1003 || level != 1 || loyalty != hero.LoyaltyDefault || status != hero.StatusIdle {
		t.Fatalf("hire fields %d %d %d %d %v", template, level, loyalty, status, err)
	}
	before = familyState(t, pool)
	for _, route := range []string{RouteLionizeHero, RoutePersuadeHero} {
		if r := restarted.GatewayRouter().Dispatch(context.Background(), familyPacket(route, 1, 0, 1003)); r.Code == 0 || familyState(t, pool) != before {
			t.Fatalf("terminal progress regression %+v", r)
		}
	}
	familyDispatch(t, restarted, familyPacket(RouteListPersuadeTargets, 0, 0, 0), &targets)
	if targets.Targets[2].State != int32(hero.LionizeStateRecruited) || targets.Targets[2].Friend != hero.LionizeHireFriendMin {
		t.Fatalf("target state not durable %+v", targets.Targets[2])
	}
}

func TestFamilyAtomicPGLionizeBefriendHasNoCapacityGate(t *testing.T) {
	pool, s := hotelFixture(t)
	recruitSQL(t, pool, `UPDATE city_building SET level=0 WHERE building_cfg_id=1`)
	familyDispatch(t, s, familyPacket(RouteLionizeHero, 1, 0, 1003), new(herov1.LionizeHeroResponse))
	recruitSQL(t, pool, `UPDATE player_hero_lionize SET friend=$1`, hero.LionizeHireFriendMin)
	before := familyState(t, pool)
	if r := s.GatewayRouter().Dispatch(context.Background(), familyPacket(RouteLionizeHero, 1, 0, 1003)); r.Code == 0 || familyState(t, pool) != before {
		t.Fatalf("hire bypassed capacity %+v", r)
	}
}

func TestFamilyAtomicPGLionizeExistingTemplateEligibility(t *testing.T) {
	for _, status := range []int16{hero.StatusComing, hero.StatusCaptive} {
		t.Run(map[int16]string{hero.StatusComing: "coming", hero.StatusCaptive: "captive"}[status], func(t *testing.T) {
			pool, s := hotelFixture(t)
			h := familySeed(t, s, status, 1, 1)
			recruitSQL(t, pool, `UPDATE player_hero SET template_cfg_id=1003 WHERE hero_id=$1`, h.HeroID)
			before := familyState(t, pool)
			r := s.GatewayRouter().Dispatch(context.Background(), familyPacket(RouteLionizeHero, 1, 0, 1003))
			if status == hero.StatusComing && (r.Code == 0 || familyState(t, pool) != before) || status == hero.StatusCaptive && r.Code != 0 {
				t.Fatalf("changed existing-template eligibility %+v", r)
			}
		})
	}
}
