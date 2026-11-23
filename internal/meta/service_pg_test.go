package meta

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGAchievementsAndWorldPhase(t *testing.T) {
	t.Setenv(pgfixture.EnvReuseSpec, "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(96,'meta96','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,96,96,'成就玩家') ON CONFLICT DO NOTHING;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold) VALUES(1,96,0,0,0,0,0)
			ON CONFLICT (server_id,player_id) DO UPDATE SET gold=0;
		INSERT INTO player_rank(server_id,player_id,prestige,rank_level) VALUES(1,96,100,1)
			ON CONFLICT (server_id,player_id) DO UPDATE SET prestige=100;
		DELETE FROM player_achievement WHERE server_id=1 AND player_id=96;
		DELETE FROM player_item WHERE server_id=1 AND player_id=96;
		DELETE FROM player_campaign_progress WHERE server_id=1;
		DELETE FROM special_city_state WHERE server_id=1;
		DELETE FROM world_phase_state WHERE server_id=1`); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)
	svc := New(pool, func() time.Time { return now })
	views, err := svc.List(ctx, 1, 96)
	if err != nil || len(views) != 10 {
		t.Fatalf("views=%d err=%v", len(views), err)
	}
	if !views[0].CanClaim || views[1].CanClaim {
		t.Fatalf("claim state: %+v %+v", views[0], views[1])
	}
	if _, err := svc.Claim(ctx, 1, 96, 2); err != ErrNotReached {
		t.Fatalf("unreached err=%v", err)
	}
	view, err := svc.Claim(ctx, 1, 96, 1)
	if err != nil || view.Reward.Gold != 300 {
		t.Fatalf("claim=%+v err=%v", view, err)
	}
	if _, err := svc.Claim(ctx, 1, 96, 1); err != ErrAlreadyClaimed {
		t.Fatalf("second claim err=%v", err)
	}
	var gold int64
	if err := pool.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=1 AND player_id=96`).Scan(&gold); err != nil || gold != 300 {
		t.Fatalf("gold=%d err=%v", gold, err)
	}

	progress, err := svc.CurrentPhase(ctx, 1, 96)
	if err != nil || progress.Phase != 1 || progress.Name != "讨平黄巾" {
		t.Fatalf("phase=%+v err=%v", progress, err)
	}
	now = now.Add(time.Minute)
	phase, changed, err := svc.AdvancePhase(ctx, 1)
	if err != nil || changed || phase != 1 {
		t.Fatalf("advance empty=%d %v err=%v", phase, changed, err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO player_campaign_progress(server_id,player_id,stage_id,stars,cleared_at)
		SELECT 1,96,stage_id,1,now() FROM cfg_campaign_stage WHERE stage_id<=5`); err != nil {
		t.Fatal(err)
	}
	phase, changed, err = svc.AdvancePhase(ctx, 1)
	if err != nil || !changed || phase != 2 {
		t.Fatalf("advance phase2=%d %v err=%v", phase, changed, err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO guild(server_id,guild_id,name,leader_player_id,member_count) VALUES(1,9,'问鼎盟',96,1) ON CONFLICT DO NOTHING;
		INSERT INTO special_city_state(server_id,city_cfg_id,owner_guild_id) VALUES(1,6,9) ON CONFLICT (server_id,city_cfg_id) DO UPDATE SET owner_guild_id=9`); err != nil {
		t.Fatal(err)
	}
	phase, changed, err = svc.AdvancePhase(ctx, 1)
	if err != nil || !changed || phase != 3 {
		t.Fatalf("advance phase3=%d %v err=%v", phase, changed, err)
	}
	progress, _ = svc.CurrentPhase(ctx, 1, 96)
	if progress.Phase != 3 || progress.Name != "问鼎洛阳" || progress.OwnedCities != 1 {
		t.Fatalf("final phase=%+v", progress)
	}
	claim, err := svc.ClaimPhaseRewards(ctx, 1, 96)
	if err != nil || len(claim.Phases) != 2 || claim.Gold != 2000 || claim.Prestige != 200 || len(claim.Items) != 2 {
		t.Fatalf("phase claim=%+v err=%v", claim, err)
	}
	if _, err := svc.ClaimPhaseRewards(ctx, 1, 96); err != ErrAlreadyClaimed {
		t.Fatalf("second phase claim err=%v", err)
	}
	progress, _ = svc.CurrentPhase(ctx, 1, 96)
	if !progress.Claimed {
		t.Fatalf("phase claim state=%+v", progress)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO guild_member(server_id,guild_id,player_id,role) VALUES(1,9,96,1) ON CONFLICT DO NOTHING;
		INSERT INTO special_city_state(server_id,city_cfg_id,owner_guild_id) VALUES(1,1,9),(1,2,9) ON CONFLICT (server_id,city_cfg_id) DO UPDATE SET owner_guild_id=9;
		INSERT INTO player_special_capture(server_id,player_id,captures) VALUES(1,96,3) ON CONFLICT (server_id,player_id) DO UPDATE SET captures=3`); err != nil {
		t.Fatal(err)
	}
	views, err = svc.List(ctx, 1, 96)
	if err != nil {
		t.Fatal(err)
	}
	claimable := map[int32]bool{}
	for _, v := range views {
		if v.CanClaim {
			claimable[v.ID] = true
		}
	}
	for _, id := range []int32{6, 7, 10} {
		if !claimable[id] {
			t.Fatalf("achievement %d not claimable: %+v", id, views)
		}
	}
}
