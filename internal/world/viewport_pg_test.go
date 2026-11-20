package world

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func viewportPG(t *testing.T) (*Service, context.Context) {
	t.Helper()
	pool := pgfixture.OpenFullSpecDB(t)
	return NewService(NewPGStore(pool)), context.Background()
}

func TestPGViewportReturnsTilesAndOwnership(t *testing.T) {
	svc, ctx := viewportPG(t)
	cells := []Cell{
		{X: 5, Y: 5, Terrain: TerrainForest, Level: 4, MaxLevel: 10, ProvinceID: 3, NpcKind: 1},
		{X: 6, Y: 5, Terrain: TerrainPlain, Level: 2, MaxLevel: 10, ProvinceID: 3, OwnerCityID: 9},
		{X: 7, Y: 5, Terrain: TerrainLake, Level: 6, MaxLevel: 10, ProvinceID: 3},
		{X: 100, Y: 100, Terrain: TerrainPlain, Level: 1, MaxLevel: 10, ProvinceID: 5},
	}
	if err := svc.Store.SaveChunk(ctx, 1, cells); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Store.(*PGStore).Pool.Exec(ctx, `
		INSERT INTO account(account_id, login_name, password_hash) OVERRIDING SYSTEM VALUE VALUES (1, 'vp', 'x');
		INSERT INTO player(server_id, player_id, account_id, display_name) VALUES (1, 7, 1, '领主');
		INSERT INTO player_city(server_id, city_id, player_id, name, x, y) VALUES (1, 9, 7, '主城', 6, 5);
		INSERT INTO city_building(server_id, city_id, slot_key, building_cfg_id, level) VALUES (1, 9, 'hall', 1, 6);
		INSERT INTO field_army(server_id, army_id, owner_player_id, x, y) VALUES (1, 3, 7, 5, 5);
		INSERT INTO march_order(server_id, march_id, army_id, from_x, from_y, to_x, to_y, purpose, depart_at, arrive_at)
		VALUES (1, 11, 3, 5, 5, 6, 5, 1, now(), now() + interval '5 minutes')`); err != nil {
		t.Fatal(err)
	}

	tiles, marches, err := svc.Viewport(ctx, 1, 6, 5, 1, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(tiles) != 3 {
		t.Fatalf("viewport tiles %d, want 3", len(tiles))
	}
	if tiles[0].X != 5 || tiles[2].X != 7 {
		t.Fatalf("tiles not ordered by y,x: %+v", tiles)
	}
	// The plain tile at (6,5) is the site of city 9: the viewport marks it as a
	// city tile and carries the site owner even though owner_city_id was NULL.
	owned := tiles[1]
	if owned.Terrain != TerrainCity || owned.OwnerCityID != 9 {
		t.Fatalf("city site not promoted: %+v", owned)
	}
	if owned.OwnerPlayerID != 7 || owned.OwnerName != "领主" || owned.OwnerCityName != "主城" {
		t.Fatalf("owner join missing: %+v", owned)
	}
	if owned.CityLevel != 6 {
		t.Fatalf("city hall level missing: %+v", owned)
	}
	if len(marches) != 1 || marches[0].MarchID != 11 || marches[0].OwnerID != 7 {
		t.Fatalf("marches: %+v", marches)
	}

	detail, err := svc.TileDetail(ctx, 1, 5, 5)
	if err != nil || detail == nil {
		t.Fatalf("detail: %v %v", detail, err)
	}
	if detail.NpcKind != 1 || detail.Level != 4 {
		t.Fatalf("detail content: %+v", detail)
	}
	if out, err := svc.TileDetail(ctx, 1, -1, 0); err != nil || out != nil {
		t.Fatalf("out of bounds detail: %v %v", out, err)
	}
}

func TestWildConfigResolvesGarrisonAndBonus(t *testing.T) {
	cfg, err := LoadWildConfig("../../spec/data/generated/world_wild.json")
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.Terrains) != 7 {
		t.Fatalf("terrains %d, want 7", len(cfg.Terrains))
	}
	forest := cfg.Terrain(TerrainForest)
	if forest == nil || forest.Name != "森林" {
		t.Fatalf("forest profile missing: %+v", forest)
	}
	level := forest.Level(4)
	if level == nil || len(level.Troops) == 0 || level.HeroLevel != 4 {
		t.Fatalf("forest level 4: %+v", level)
	}
	total := int32(0)
	for _, troop := range level.Troops {
		total += troop.Count
	}
	if total < 240 {
		t.Fatalf("forest level 4 garrison %d, want >= 240", total)
	}
	if level.Loot.Wood <= 0 {
		t.Fatalf("forest level 4 loot: %+v", level.Loot)
	}
	camp := cfg.Profile(Cell{Terrain: TerrainForest, Level: 4, NpcKind: 1})
	if camp == nil || len(camp.Troops) == 0 {
		t.Fatalf("camp profile: %+v", camp)
	}
	if city := cfg.Profile(Cell{Terrain: TerrainCity, Level: 1}); city != nil {
		t.Fatal("city tiles must not resolve a wild profile")
	}
}

func TestViewportBoundsClamp(t *testing.T) {
	minX, minY, maxX, maxY := viewportBounds(-10, -10, 20, 20)
	if minX != 0 || minY != 0 || maxX > MapSize-1 || maxY > MapSize-1 {
		t.Fatalf("clamp: %d %d %d %d", minX, minY, maxX, maxY)
	}
	if _, _, maxX, _ = viewportBounds(MapSize+5, 10, 20, 20); maxX != MapSize-1 {
		t.Fatalf("upper clamp: %d", maxX)
	}
}

var _ = time.Now

func TestPGViewportOwnedFieldsAndAbandon(t *testing.T) {
	svc, ctx := viewportPG(t)
	if err := svc.Store.SaveChunk(ctx, 1, []Cell{
		{X: 10, Y: 10, Terrain: TerrainForest, Level: 3, MaxLevel: 10, ProvinceID: 2, OwnerCityID: 5},
		{X: 11, Y: 10, Terrain: TerrainPlain, Level: 2, MaxLevel: 10, ProvinceID: 2, OwnerCityID: 5},
		{X: 12, Y: 10, Terrain: TerrainLake, Level: 4, MaxLevel: 10, ProvinceID: 2, OwnerCityID: 6},
	}); err != nil {
		t.Fatal(err)
	}
	fields, err := svc.OwnedFields(ctx, 1, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(fields) != 2 || fields[0].X != 10 || fields[1].X != 11 {
		t.Fatalf("owned fields: %+v", fields)
	}
	ok, err := svc.AbandonField(ctx, 1, 5, 10, 10)
	if err != nil || !ok {
		t.Fatalf("abandon: %v %v", ok, err)
	}
	if ok, err := svc.AbandonField(ctx, 1, 6, 11, 10); err != nil || ok {
		t.Fatalf("foreign abandon: %v %v", ok, err)
	}
	fields, err = svc.OwnedFields(ctx, 1, 5)
	if err != nil || len(fields) != 1 || fields[0].X != 11 {
		t.Fatalf("after abandon: %+v %v", fields, err)
	}
}
