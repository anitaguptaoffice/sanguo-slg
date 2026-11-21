package hero

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGEquipmentLifecycle(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	_, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(81,'equip81','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,81,81,'装备测试') ON CONFLICT DO NOTHING;
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,81,81,'装备城',60,60) ON CONFLICT DO NOTHING;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold) VALUES(1,81,0,0,0,5000,20000)
			ON CONFLICT (server_id,player_id) DO UPDATE SET iron=5000,gold=20000;
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES
			(1,81,'blacksmith',13,3),(1,81,'stable',15,3)
			ON CONFLICT (server_id,city_id,slot_key) DO UPDATE SET level=3;
		INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,display_name,level,exp,loyalty,force,intel,politics,command,status,is_monarch)
			VALUES(1,81,81,1001,'君主·装备测试',1,0,100,72,75,88,78,1,true)
			ON CONFLICT (server_id,hero_id) DO UPDATE SET is_monarch=true;
		DELETE FROM hero_equipment WHERE server_id=1 AND hero_id=81;
		DELETE FROM player_equipment WHERE server_id=1 AND player_id=81`)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	svc := NewEquipment(pool, func() time.Time { return now })

	weapon, gold, err := svc.Forge(ctx, 1, 81, 81, 2, 1)
	if err != nil {
		t.Fatal(err)
	}
	if weapon.CfgID != 301 || weapon.Name != "短刀" || gold != 19300 {
		t.Fatalf("forge = %+v gold=%d", weapon, gold)
	}
	if _, _, err := svc.Socket(ctx, 1, 81, 81, weapon.ID, 1); !errors.Is(err, ErrEquipmentSockets) {
		t.Fatalf("tier1 socket = %v", err)
	}
	enhanced, gold, err := svc.Enhance(ctx, 1, 81, 81, weapon.ID)
	if err != nil || enhanced.EnhanceLevel != 1 || enhanced.Force != 5 || gold != 19060 {
		t.Fatalf("enhance = %+v gold=%d err=%v", enhanced, gold, err)
	}

	axe, _, err := svc.Forge(ctx, 1, 81, 81, 2, 3)
	if err != nil {
		t.Fatal(err)
	}
	if axe.Name != "青龙刀" || axe.Sockets != 2 {
		t.Fatalf("tier3 = %+v", axe)
	}
	axe, gold, err = svc.Socket(ctx, 1, 81, 81, axe.ID, 1)
	if err != nil || len(axe.Gems) != 1 || axe.Force != 13 || gold == 0 {
		t.Fatalf("socket = %+v gold=%d err=%v", axe, gold, err)
	}
	axe, _, err = svc.Socket(ctx, 1, 81, 81, axe.ID, 2)
	if err != nil || len(axe.Gems) != 2 || axe.Force != 15 {
		t.Fatalf("socket2 = %+v err=%v", axe, err)
	}
	if _, _, err := svc.Socket(ctx, 1, 81, 81, axe.ID, 3); !errors.Is(err, ErrEquipmentSockets) {
		t.Fatalf("socket overflow = %v", err)
	}
	equipped, err := svc.Equip(ctx, 1, 81, 81, 81, axe.ID)
	if err != nil || len(equipped) != 1 || !equipped[0].Equipped || equipped[0].HeroID != 81 {
		t.Fatalf("equip = %+v err=%v", equipped, err)
	}
	eq, inv, blacksmith, stable, err := svc.List(ctx, 1, 81, 81, 81)
	if err != nil || len(eq) != 1 || len(inv) != 1 || blacksmith != 3 || stable != 3 {
		t.Fatalf("list eq=%d inv=%d bs=%d st=%d err=%v", len(eq), len(inv), blacksmith, stable, err)
	}
	mount, _, err := svc.Forge(ctx, 1, 81, 81, 3, 3)
	if err != nil {
		t.Fatal(err)
	}
	mount, gold, err = svc.TrainMount(ctx, 1, 81, 81, mount.ID)
	if err != nil || mount.EnhanceLevel != 1 || mount.SpeedPct != 10 || gold == 0 {
		t.Fatalf("mount = %+v gold=%d err=%v", mount, gold, err)
	}
	if _, _, err := svc.TrainMount(ctx, 1, 81, 81, axe.ID); !errors.Is(err, ErrEquipmentMount) {
		t.Fatalf("non-mount train = %v", err)
	}
	eq, err = svc.Unequip(ctx, 1, 81, 81, 81, 2)
	if err != nil || len(eq) != 0 {
		t.Fatalf("unequip = %+v err=%v", eq, err)
	}
}
