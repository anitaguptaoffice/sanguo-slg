package campaign

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGCampaignProgressAndRewards(t *testing.T) {
	t.Setenv(pgfixture.EnvReuseSpec, "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(98,'campaign98','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,98,98,'战役玩家') ON CONFLICT DO NOTHING;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold) VALUES(1,98,0,0,0,0,1000)
			ON CONFLICT (server_id,player_id) DO UPDATE SET gold=1000;
		DELETE FROM player_campaign_progress WHERE server_id=1 AND player_id=98;
		DELETE FROM player_campaign_reward WHERE server_id=1 AND player_id=98;
		DELETE FROM player_item WHERE server_id=1 AND player_id=98`); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)
	svc := New(pool, func() time.Time { return now })
	views, err := svc.List(ctx, 1, 98)
	if err != nil || len(views) != 8 {
		t.Fatalf("views=%d err=%v", len(views), err)
	}
	if !views[0].Unlocked || views[1].Unlocked {
		t.Fatalf("initial unlock: %+v %+v", views[0], views[1])
	}
	progress, err := svc.Complete(ctx, 1, 98, 1, 2)
	if err != nil || !progress.FirstClear || progress.Rewards.Gold != 300 || len(progress.Rewards.Items) != 1 {
		t.Fatalf("first clear=%+v err=%v", progress, err)
	}
	views, _ = svc.List(ctx, 1, 98)
	if !views[0].Cleared || views[0].Stars != 2 || !views[1].Unlocked {
		t.Fatalf("after clear: %+v %+v", views[0], views[1])
	}
	progress, err = svc.Complete(ctx, 1, 98, 1, 3)
	if err != nil || progress.FirstClear {
		t.Fatalf("replay=%+v err=%v", progress, err)
	}
	views, _ = svc.List(ctx, 1, 98)
	if views[0].Stars != 3 {
		t.Fatalf("best stars=%d", views[0].Stars)
	}
	var gold int64
	var items int
	if err := pool.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=1 AND player_id=98`).Scan(&gold); err != nil || gold != 1300 {
		t.Fatalf("gold=%d err=%v", gold, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*)::int FROM player_campaign_reward WHERE server_id=1 AND player_id=98`).Scan(&items); err != nil || items != 1 {
		t.Fatalf("reward rows=%d err=%v", items, err)
	}
	var qty int
	if err := pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=1 AND player_id=98 AND item_cfg_id=2060`).Scan(&qty); err != nil || qty != 1 {
		t.Fatalf("blueprint=%d err=%v", qty, err)
	}
}

func TestPGArenaDailyReward(t *testing.T) {
	t.Setenv(pgfixture.EnvReuseSpec, "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(97,'arena97','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,97,97,'比武玩家') ON CONFLICT DO NOTHING;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold) VALUES(1,97,0,0,0,0,0)
			ON CONFLICT (server_id,player_id) DO UPDATE SET gold=0;
		DELETE FROM player_arena_reward WHERE server_id=1 AND player_id=97`); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 22, 8, 0, 0, 0, time.UTC)
	svc := New(pool, func() time.Time { return now })
	opponents, err := svc.ListArena(ctx)
	if err != nil || len(opponents) != 3 {
		t.Fatalf("opponents=%d err=%v", len(opponents), err)
	}
	first, err := svc.CompleteArena(ctx, 1, 97, 1)
	if err != nil || !first.FirstWin || first.Gold != 200 {
		t.Fatalf("first=%+v err=%v", first, err)
	}
	second, err := svc.CompleteArena(ctx, 1, 97, 1)
	if err != nil || second.FirstWin {
		t.Fatalf("second=%+v err=%v", second, err)
	}
	now = now.Add(24 * time.Hour)
	third, err := svc.CompleteArena(ctx, 1, 97, 1)
	if err != nil || !third.FirstWin {
		t.Fatalf("next day=%+v err=%v", third, err)
	}
	var gold int64
	if err := pool.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=1 AND player_id=97`).Scan(&gold); err != nil || gold != 400 {
		t.Fatalf("gold=%d err=%v", gold, err)
	}
}
