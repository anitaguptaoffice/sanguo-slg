package trick

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGCastTricks(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)
	_, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(95,'trick95','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,95,95,'计谋测试') ON CONFLICT DO NOTHING;
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,95,95,'计谋城',60,60) ON CONFLICT DO NOTHING;
		INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,display_name,level,exp,loyalty,force,intel,politics,command,status,is_monarch)
			VALUES(1,95,95,1001,'军师',1,0,100,50,100,80,60,1,false) ON CONFLICT DO NOTHING;
		INSERT INTO city_office(server_id,city_id,office,hero_id) VALUES(1,95,2,95)
			ON CONFLICT (server_id,city_id,office) DO UPDATE SET hero_id=95;
		INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,95,2004,5)
			ON CONFLICT (server_id,player_id,item_cfg_id) DO UPDATE SET quantity=5;
		INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y,hero_ids) VALUES
			(1,95,95,2,1,1,ARRAY[95]::bigint[]),(1,96,96,2,2,2,ARRAY[]::bigint[])
			ON CONFLICT (server_id,army_id) DO UPDATE SET owner_player_id=EXCLUDED.owner_player_id;`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO march_order(server_id,march_id,army_id,origin_city_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status)
		VALUES(1,95,95,95,1,1,5,5,1,$1,$2,1),(1,96,96,96,2,2,6,6,1,$1,$2,1)
		ON CONFLICT (server_id,march_id) DO UPDATE SET arrive_at=EXCLUDED.arrive_at,status=1`,
		now.Add(-time.Hour), now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	svc := New(pool, func() time.Time { return now })
	raid, err := svc.Cast(ctx, 1, 95, 95, TrickRaid, 95, 0)
	if err != nil || !raid.Success || raid.NewDeadline == nil || !raid.NewDeadline.Equal(now.Add(42*time.Minute)) {
		t.Fatalf("raid = %+v err=%v", raid, err)
	}
	lock, err := svc.Cast(ctx, 1, 95, 95, TrickLock, 96, 0)
	if err != nil || !lock.Success || lock.NewDeadline == nil || !lock.NewDeadline.Equal(now.Add(78*time.Minute)) {
		t.Fatalf("lock = %+v err=%v", lock, err)
	}
	pin, err := svc.Cast(ctx, 1, 95, 95, TrickPin, 96, 0)
	if err != nil || !pin.Success || pin.NewDeadline == nil {
		t.Fatalf("pin = %+v err=%v", pin, err)
	}
	feint, err := svc.Cast(ctx, 1, 95, 95, TrickFeint, 0, 0)
	if err != nil || !feint.Success || feint.FeintUntil == nil {
		t.Fatalf("feint = %+v err=%v", feint, err)
	}
	var qty int
	if err := pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=1 AND player_id=95 AND item_cfg_id=2004`).Scan(&qty); err != nil || qty != 1 {
		t.Fatalf("talisman = %d err=%v", qty, err)
	}
	if _, err := svc.Cast(ctx, 1, 95, 96, TrickRaid, 95, 0); err != ErrNoStrategist {
		t.Fatalf("missing strategist = %v", err)
	}
}
