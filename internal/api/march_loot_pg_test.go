package api

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestPGCreditMarchLoot(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	binding, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	var schema string
	if err := pool.QueryRow(ctx, `SELECT current_schema()`).Scan(&schema); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id, login_name, password_hash) OVERRIDING SYSTEM VALUE VALUES (1, 'loot', 'x');
		INSERT INTO player(server_id, player_id, account_id, display_name) VALUES (1, 7, 1, '领主');
		INSERT INTO player_wallet(server_id, player_id, food, wood, stone, iron, gold) VALUES (1, 7, 10, 20, 30, 40, 50);
		INSERT INTO player_item(server_id, player_id, item_cfg_id, quantity) VALUES (1, 7, 2003, 1);
		INSERT INTO player_hero(server_id, hero_id, player_id, template_cfg_id, level, exp, status) VALUES (1, 11, 7, 1001, 5, 100, 3);
		INSERT INTO field_army(server_id, army_id, owner_player_id, x, y, hero_ids) VALUES (1, 5, 7, 20, 10, '{11}');
		INSERT INTO march_loot(server_id, march_id, food, wood, stone, iron, gold, items, hero_exp)
		VALUES (1, 9, 500, 300, 100, 50, 25, '[{"ItemCfgID":2003,"Count":2},{"ItemCfgID":2001,"Count":1}]', 80)`); err != nil {
		t.Fatal(err)
	}

	txCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	owner, err := binding.Begin(txCtx)
	if err != nil {
		t.Fatal(err)
	}
	access := owner.Access()
	if err := creditMarchLoot(txCtx, access, binding, schema, march.ReturnCandidate{ServerID: 1, PlayerID: 7, CityID: 3, MarchID: 9, ArmyID: 5}); err != nil {
		t.Fatalf("credit: %v", err)
	}
	if err := owner.Commit(txCtx); err != nil {
		t.Fatal(err)
	}

	var food, wood, stone, iron, gold, exp int64
	var quantity int32
	if err := pool.QueryRow(ctx, `SELECT food,wood,stone,iron,gold FROM player_wallet WHERE server_id=1 AND player_id=7`).
		Scan(&food, &wood, &stone, &iron, &gold); err != nil {
		t.Fatal(err)
	}
	if food != 510 || wood != 320 || stone != 130 || iron != 90 || gold != 75 {
		t.Fatalf("wallet: %d %d %d %d %d", food, wood, stone, iron, gold)
	}
	if err := pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=1 AND player_id=7 AND item_cfg_id=2003`).Scan(&quantity); err != nil {
		t.Fatal(err)
	}
	if quantity != 3 {
		t.Fatalf("item 2003 quantity %d, want 3", quantity)
	}
	if err := pool.QueryRow(ctx, `SELECT exp FROM player_hero WHERE server_id=1 AND hero_id=11`).Scan(&exp); err != nil {
		t.Fatal(err)
	}
	if exp != 180 {
		t.Fatalf("hero exp %d, want 180", exp)
	}
	var rows int64
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM march_loot WHERE server_id=1 AND march_id=9`).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 0 {
		t.Fatal("loot row was not consumed")
	}

	// A second settlement finds no row and credits nothing.
	txCtx2, cancel2 := context.WithTimeout(ctx, 5*time.Second)
	defer cancel2()
	owner2, err := binding.Begin(txCtx2)
	if err != nil {
		t.Fatal(err)
	}
	if err := creditMarchLoot(txCtx2, owner2.Access(), binding, schema, march.ReturnCandidate{ServerID: 1, PlayerID: 7, CityID: 3, MarchID: 9, ArmyID: 5}); err != nil {
		t.Fatalf("replay: %v", err)
	}
	_ = owner2.Rollback(txCtx2)
	if err := pool.QueryRow(ctx, `SELECT food FROM player_wallet WHERE server_id=1 AND player_id=7`).Scan(&food); err != nil {
		t.Fatal(err)
	}
	if food != 510 {
		t.Fatalf("replay credited again: %d", food)
	}
}
