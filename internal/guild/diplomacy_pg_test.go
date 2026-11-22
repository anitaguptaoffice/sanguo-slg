package guild

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGDiplomacyAndGarrison(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	_, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(98,'diplo98','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,98,98,'盟主') ON CONFLICT DO NOTHING;
		INSERT INTO guild(server_id,guild_id,name,leader_player_id,member_count) VALUES(1,1,'盟一',98,1),(1,2,'盟二',99,1) ON CONFLICT DO NOTHING;
		INSERT INTO guild_member(server_id,guild_id,player_id,role) VALUES(1,1,98,1) ON CONFLICT DO NOTHING;
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,98,98,'盟城',60,60) ON CONFLICT DO NOTHING;
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES(1,98,'diplomacy',17,1)
			ON CONFLICT (server_id,city_id,slot_key) DO UPDATE SET level=1;
		INSERT INTO city_troop(server_id,city_id,unit_cfg_id,count,wounded) VALUES(1,98,1,10,0)
			ON CONFLICT (server_id,city_id,unit_cfg_id) DO UPDATE SET count=10, wounded=0;
		DELETE FROM guild_relation WHERE server_id=1 AND guild_id=1;
		DELETE FROM guild_garrison WHERE server_id=1 AND city_id=98`)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)
	d := NewDiplomacy(pool, func() time.Time { return now })
	rel, err := d.SetRelation(ctx, 1, 98, 1, 2, 3)
	if err != nil || !rel.Pending || !time.UnixMilli(rel.EffectiveAtMs).Equal(now.Add(8*time.Hour)) {
		t.Fatalf("hostile = %+v err=%v", rel, err)
	}
	rel, err = d.SetRelation(ctx, 1, 98, 1, 2, 1)
	if err != nil || rel.Pending || rel.State != 1 {
		t.Fatalf("friendly = %+v err=%v", rel, err)
	}
	rows, err := d.Station(ctx, 1, 98, 98, 1, 1, 4)
	if err != nil || len(rows) != 1 || rows[0].Count != 4 {
		t.Fatalf("station = %+v err=%v", rows, err)
	}
	var cityCount int
	if err := pool.QueryRow(ctx, `SELECT count FROM city_troop WHERE server_id=1 AND city_id=98 AND unit_cfg_id=1`).Scan(&cityCount); err != nil || cityCount != 6 {
		t.Fatalf("city troop = %d err=%v", cityCount, err)
	}
	troops, err := d.GarrisonTroops(ctx, 1, 98)
	if err != nil || len(troops) != 1 || troops[0].Count != 4 {
		t.Fatalf("defense = %+v err=%v", troops, err)
	}
}
