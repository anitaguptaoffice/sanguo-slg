package specialcity

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGSpecialCityCaptureRecoverTaxRecruit(t *testing.T) {
	t.Setenv(pgfixture.EnvReuseSpec, "0")
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(98,'special98','x') ON CONFLICT DO NOTHING;
		INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,98,98,'国战玩家') ON CONFLICT DO NOTHING;
		INSERT INTO guild(server_id,guild_id,name,leader_player_id,member_count) VALUES(1,1,'国战盟',98,1) ON CONFLICT DO NOTHING;
		INSERT INTO guild_member(server_id,guild_id,player_id,role) VALUES(1,1,98,1) ON CONFLICT DO NOTHING;
		INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,98,98,'国战城',60,60) ON CONFLICT DO NOTHING;
		INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron,gold) VALUES(1,98,100000,100000,100000,100000,10000)
			ON CONFLICT (server_id,player_id) DO UPDATE SET food=100000,wood=100000,stone=100000,iron=100000,gold=10000;
		DELETE FROM special_city_state WHERE server_id=1;
		DELETE FROM special_city_tax_claim WHERE server_id=1;
		DELETE FROM city_troop WHERE server_id=1 AND city_id=98`); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)
	svc := New(pool, func() time.Time { return now })
	cities, err := svc.List(ctx, 1)
	if err != nil || len(cities) < 9 {
		t.Fatalf("cities=%d err=%v", len(cities), err)
	}
	var capital City
	for _, c := range cities {
		if c.Name == "洛阳" {
			capital = c
		}
	}
	if capital.Total() != 22000 || capital.UnitCfgID != 14 || capital.UnitName != "虎豹骑" {
		t.Fatalf("capital=%+v", capital)
	}

	captured, guildID, err := svc.AfterBattle(ctx, 1, 1, 98, true, nil)
	if err != nil || !captured || guildID != 1 {
		t.Fatalf("capture=%v guild=%d err=%v", captured, guildID, err)
	}
	got, err := svc.Defense(ctx, 1, 120, 140)
	if err != nil || got.OwnerGuildID != 1 || got.Total() != 3000 {
		t.Fatalf("defense=%+v err=%v", got, err)
	}

	// A lost defense stores survivors and recovers to the initial garrison afterwards.
	if _, _, err := svc.AfterBattle(ctx, 1, 1, 98, false, []march.TroopStack{{UnitCfgID: 1, Count: 120}}); err != nil {
		t.Fatal(err)
	}
	got, err = svc.Defense(ctx, 1, 120, 140)
	if err != nil || got.Total() != 120 || got.NextRecoverAt.IsZero() {
		t.Fatalf("after loss=%+v err=%v", got, err)
	}
	now = now.Add(31 * time.Minute)
	got, err = svc.Defense(ctx, 1, 120, 140)
	if err != nil || got.Total() != 3000 {
		t.Fatalf("recovered=%+v err=%v", got, err)
	}

	if _, _, err := svc.AfterBattle(ctx, 1, 6, 98, true, nil); err != nil {
		t.Fatal(err)
	}
	units, err := svc.UnlockedUnits(ctx, 1, 98)
	if err != nil || len(units) != 1 || units[0] != 13 {
		t.Fatalf("units=%v err=%v", units, err)
	}
	total, err := svc.Recruit(ctx, 1, 98, 98, 13, 20)
	if err != nil || total != 20 {
		t.Fatalf("recruit=%d err=%v", total, err)
	}

	tax, err := svc.ClaimTax(ctx, 1, 98)
	if err != nil || tax.Cities != 2 || tax.Food != 500+1500 {
		t.Fatalf("tax=%+v err=%v", tax, err)
	}
	if _, err := svc.ClaimTax(ctx, 1, 98); err != ErrAlreadyClaimed {
		t.Fatalf("second claim err=%v", err)
	}
	var food int64
	if err := pool.QueryRow(ctx, `SELECT food FROM player_wallet WHERE server_id=1 AND player_id=98`).Scan(&food); err != nil || food != 100000-300*20+2000 {
		t.Fatalf("wallet food=%d err=%v", food, err)
	}
}
