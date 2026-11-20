package domestic

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGCivicRenameAndReload(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO account(account_id, login_name, password_hash) OVERRIDING SYSTEM VALUE VALUES (1, 'civic', 'x');
		INSERT INTO player(server_id, player_id, account_id, display_name) VALUES (1, 7, 1, '领主');
		INSERT INTO player_city(server_id, city_id, player_id, name, x, y) VALUES (1, 1, 7, '主城', 60, 60);
		INSERT INTO player_wallet(server_id, player_id, food, wood, stone, iron, gold) VALUES (1, 7, 10000, 10000, 10000, 10000, 500);
		INSERT INTO city_building(server_id, city_id, slot_key, building_cfg_id, level) VALUES (1, 1, 'hall', 1, 3);
		INSERT INTO city_production_checkpoint(server_id, city_id, player_id, settled_at) VALUES (1, 1, 7, now());`); err != nil {
		t.Fatal(err)
	}
	now := time.Unix(1798000000, 0)
	h := NewHubWithCatalog(func() time.Time { return now }, FullCatalog())
	h.UseStore(NewPGStore(pool), 1, 30*time.Second)
	city, err := h.LoadCity(ctx, 1, 7)
	if err != nil {
		t.Fatal(err)
	}
	if city.Name != "主城" || city.Gold != 500 || city.Civic.Population == 0 {
		t.Fatalf("loaded city: %+v", city)
	}
	view, err := h.ApplyCivicDecree(ctx, 1, DecreeRename, 0, "新野")
	if err != nil || view.Name != "新野" {
		t.Fatalf("rename: %+v %v", view, err)
	}
	var name string
	if err := pool.QueryRow(ctx, `SELECT name FROM player_city WHERE city_id=1`).Scan(&name); err != nil || name != "新野" {
		t.Fatalf("persisted name %q %v", name, err)
	}
	if _, err := h.ApplyCivicDecree(ctx, 1, DecreeSetTax, 20, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := h.ApplyCivicDecree(ctx, 1, DecreeSetWorkRate, 60, ""); err != nil {
		t.Fatal(err)
	}
	reloaded, err := h.LoadCity(ctx, 1, 7)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.Name != "新野" || reloaded.Civic.TaxRate != 20 || reloaded.Civic.WorkRate != 60 {
		t.Fatalf("reloaded civic: %+v", reloaded)
	}
}
