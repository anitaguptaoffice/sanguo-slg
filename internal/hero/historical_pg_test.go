package hero

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGHistoricalHeroLoop(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	_, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(91,'hist91','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,91,91,'历史测试') ON CONFLICT DO NOTHING;
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,91,91,'历史城',60,60) ON CONFLICT DO NOTHING;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold) VALUES(1,91,0,0,0,0,20000)
			ON CONFLICT (server_id,player_id) DO UPDATE SET gold=20000;
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES
			(1,91,'inn',10,3),(1,91,'hall',1,5)
			ON CONFLICT (server_id,city_id,slot_key) DO UPDATE SET level=EXCLUDED.level;
		INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,91,2001,3)
			ON CONFLICT (server_id,player_id,item_cfg_id) DO UPDATE SET quantity=3;
		DELETE FROM player_hero_rumor WHERE server_id=1 AND player_id=91;
		DELETE FROM player_hero WHERE server_id=1 AND player_id=91;
		UPDATE historical_hero SET state=0,owner_player_id=NULL,city_id=NULL,captured_at=NULL,friend=0
			WHERE server_id=1 AND npc_cfg_id IN (1001,1002)`)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 22, 0, 0, 0, 0, time.UTC)
	store := NewPGStore(pool)
	svc := NewHistorical(pool, store, func() time.Time { return now })

	rows, err := svc.List(ctx, 1, 91)
	if err != nil || len(rows) < 4 {
		t.Fatalf("list = %d err=%v", len(rows), err)
	}
	for _, row := range rows {
		if row.NpcCfgID == 1001 && (row.Discovered || row.X != -1 || row.Y != -1) {
			t.Fatalf("undiscovered row leaked coords: %+v", row)
		}
	}
	found, gold, err := svc.Search(ctx, 1, 91, 91, 1001)
	if err != nil || found.X != 65 || found.Y != 65 || !found.Discovered || gold != 19500 {
		t.Fatalf("search = %+v gold=%d err=%v", found, gold, err)
	}
	if again, gold2, err := svc.Search(ctx, 1, 91, 91, 1001); err != nil || !again.Discovered || gold2 != gold {
		t.Fatalf("second search = %+v gold=%d err=%v", again, gold2, err)
	}
	captured, err := svc.Capture(ctx, 1, 91, 91, 65, 65, 0)
	if err != nil || captured == nil || captured.Status != StatusCaptive {
		t.Fatalf("capture = %+v err=%v", captured, err)
	}
	if again, err := svc.Capture(ctx, 1, 91, 91, 65, 65, 0); again != nil || err != nil {
		t.Fatalf("double capture = %+v err=%v", again, err)
	}
	owned, gold, err := svc.Persuade(ctx, 1, 91, 91, 1001)
	if err != nil || owned.Status != StatusIdle || gold != 14500 {
		t.Fatalf("persuade = %+v gold=%d err=%v", owned, gold, err)
	}
	var state int16
	if err := pool.QueryRow(ctx, `SELECT state FROM historical_hero WHERE server_id=1 AND npc_cfg_id=1001`).Scan(&state); err != nil || state != 2 {
		t.Fatalf("historical state = %d err=%v", state, err)
	}
	var qty int
	if err := pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=1 AND player_id=91 AND item_cfg_id=2001`).Scan(&qty); err != nil || qty != 2 {
		t.Fatalf("jewel qty = %d err=%v", qty, err)
	}
	if _, _, err := svc.Persuade(ctx, 1, 91, 91, 1001); err != ErrHistoricalState {
		t.Fatalf("second persuade = %v", err)
	}
	if failed, err := svc.Capture(ctx, 1, 91, 91, 68, 68, 99); failed != nil || err != nil {
		t.Fatalf("failed capture roll = %+v err=%v", failed, err)
	}
}
