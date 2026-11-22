package rank

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGPrestigeAndPromotion(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	_, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(97,'rank97','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,97,97,'爵位测试') ON CONFLICT DO NOTHING;
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,97,97,'爵位城',60,60) ON CONFLICT DO NOTHING;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold) VALUES(1,97,0,0,0,0,5000)
			ON CONFLICT (server_id,player_id) DO UPDATE SET gold=5000;
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,97,'hall',1,2)
			ON CONFLICT (server_id,city_id,slot_key) DO UPDATE SET level=2;
		INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,97,2001,2)
			ON CONFLICT (server_id,player_id,item_cfg_id) DO UPDATE SET quantity=2;
		DELETE FROM player_rank WHERE server_id=1 AND player_id=97`)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)
	svc := NewPrestigeService(pool, func() time.Time { return now })
	view, err := svc.Get(ctx, 1, 97)
	if err != nil || view.RankLevel != 0 || view.CityCap != 1 || view.NextPrestige != 100 {
		t.Fatalf("initial = %+v err=%v", view, err)
	}
	if _, err := svc.Promote(ctx, 1, 97, 97); err != ErrRankPrestige {
		t.Fatalf("prestige gate = %v", err)
	}
	if err := svc.Add(ctx, 1, 97, 100); err != nil {
		t.Fatal(err)
	}
	view, err = svc.Promote(ctx, 1, 97, 97)
	if err != nil || view.RankLevel != 1 || view.CityCap != 2 || view.NextPrestige != 300 {
		t.Fatalf("promote = %+v err=%v", view, err)
	}
	var gold int64
	var qty int
	if err := pool.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=1 AND player_id=97`).Scan(&gold); err != nil || gold != 4000 {
		t.Fatalf("gold = %d err=%v", gold, err)
	}
	if err := pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=1 AND player_id=97 AND item_cfg_id=2001`).Scan(&qty); err != nil || qty != 1 {
		t.Fatalf("jewel = %d err=%v", qty, err)
	}
}
