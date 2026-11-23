package guild

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGDiplomacyAndGarrison(t *testing.T) {
	t.Setenv(pgfixture.EnvReuseSpec, "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	_, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES
			(98,'diplo98','x'),(99,'diplo99','x'),(100,'diplo100','x'),(101,'diplo101','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES
			(1,98,98,'盟主'),(1,99,99,'敌盟主'),(1,100,100,'盟友'),(1,101,101,'散人') ON CONFLICT DO NOTHING;
		INSERT INTO guild(server_id,guild_id,name,leader_player_id,member_count) VALUES
			(1,1,'盟一',98,2),(1,2,'盟二',99,1) ON CONFLICT DO NOTHING;
		INSERT INTO guild_member(server_id,guild_id,player_id,role) VALUES
			(1,1,98,1),(1,1,100,3),(1,2,99,1) ON CONFLICT DO NOTHING;
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES
			(1,98,98,'盟城',60,60),(1,99,99,'敌城',61,61),(1,100,100,'友城',62,62) ON CONFLICT DO NOTHING;
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES
			(1,98,'diplomacy',17,1),(1,99,'diplomacy',17,1),(1,100,'diplomacy',17,1)
			ON CONFLICT (server_id,city_id,slot_key) DO UPDATE SET level=1;
		INSERT INTO city_troop(server_id,city_id,unit_cfg_id,count,wounded) VALUES
			(1,98,1,10,0),(1,100,1,7,0)
			ON CONFLICT (server_id,city_id,unit_cfg_id) DO UPDATE SET count=EXCLUDED.count, wounded=0;
		DELETE FROM guild_relation WHERE server_id=1 AND guild_id=1;
		DELETE FROM guild_garrison WHERE server_id=1`)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)
	d := NewDiplomacy(pool, func() time.Time { return now })
	if ok, _, err := d.CanAttack(ctx, 1, 98, 99); err != nil || ok {
		t.Fatalf("undeclared war allowed=%v err=%v", ok, err)
	}
	if ok, _, err := d.CanAttack(ctx, 1, 98, 100); err != nil || ok {
		t.Fatalf("same guild allowed=%v err=%v", ok, err)
	}
	if ok, _, err := d.CanAttack(ctx, 1, 101, 99); err != nil || !ok {
		t.Fatalf("unguilded allowed=%v err=%v", ok, err)
	}
	rel, err := d.SetRelation(ctx, 1, 98, 1, 2, 3)
	if err != nil || !rel.Pending || !time.UnixMilli(rel.EffectiveAtMs).Equal(now.Add(8*time.Hour)) {
		t.Fatalf("hostile = %+v err=%v", rel, err)
	}
	if ok, _, err := d.CanAttack(ctx, 1, 98, 99); err != nil || ok {
		t.Fatalf("pending war allowed=%v err=%v", ok, err)
	}
	now = now.Add(8*time.Hour + time.Second)
	if ok, _, err := d.CanAttack(ctx, 1, 98, 99); err != nil || !ok {
		t.Fatalf("effective war allowed=%v err=%v", ok, err)
	}
	if ok, _, err := d.CanAttack(ctx, 1, 99, 98); err != nil || !ok {
		t.Fatalf("reverse war allowed=%v err=%v", ok, err)
	}
	rel, err = d.SetRelation(ctx, 1, 98, 1, 2, 1)
	if err != nil || rel.Pending || rel.State != 1 {
		t.Fatalf("friendly = %+v err=%v", rel, err)
	}
	if ok, _, err := d.CanAttack(ctx, 1, 98, 99); err != nil || ok {
		t.Fatalf("friendly attack allowed=%v err=%v", ok, err)
	}
	rows, err := d.Station(ctx, 1, 98, 98, 100, 1, 1, 4)
	if err != nil || len(rows) != 1 || rows[0].Count != 4 {
		t.Fatalf("ally station = %+v err=%v", rows, err)
	}
	var source, target int
	if err := pool.QueryRow(ctx, `SELECT count FROM city_troop WHERE server_id=1 AND city_id=98 AND unit_cfg_id=1`).Scan(&source); err != nil || source != 6 {
		t.Fatalf("source troop = %d err=%v", source, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count FROM city_troop WHERE server_id=1 AND city_id=100 AND unit_cfg_id=1`).Scan(&target); err != nil || target != 7 {
		t.Fatalf("ally troop = %d err=%v", target, err)
	}
	troops, err := d.GarrisonTroops(ctx, 1, 100)
	if err != nil || len(troops) != 1 || troops[0].Count != 4 {
		t.Fatalf("ally defense = %+v err=%v", troops, err)
	}
	if _, err := d.Station(ctx, 1, 98, 98, 99, 1, 1, 1); err != ErrGuildTarget {
		t.Fatalf("enemy station err=%v", err)
	}
	rows, err = d.Withdraw(ctx, 1, 98, 100, 98, 1, 1, 2)
	if err != nil || len(rows) != 1 || rows[0].Count != 2 {
		t.Fatalf("withdraw = %+v err=%v", rows, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count FROM city_troop WHERE server_id=1 AND city_id=98 AND unit_cfg_id=1`).Scan(&source); err != nil || source != 8 {
		t.Fatalf("withdraw source = %d err=%v", source, err)
	}
	troops, err = d.GarrisonTroops(ctx, 1, 100)
	if err != nil || len(troops) != 1 || troops[0].Count != 2 {
		t.Fatalf("withdraw defense = %+v err=%v", troops, err)
	}
}
