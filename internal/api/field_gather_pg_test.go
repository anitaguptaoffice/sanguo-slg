package api

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

func TestPGFieldGatherLifecycle(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	wild, err := world.LoadWildConfig("../../spec/data/generated/world_wild.json")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO player_wallet(server_id, player_id, food, wood, stone, iron, gold) VALUES (1, 7, 5000, 0, 0, 0, 0);
		INSERT INTO player_city(server_id, city_id, player_id, name, x, y) VALUES (1, 100, 7, '主城', 60, 60);
		INSERT INTO map_cell(server_id, x, y, terrain, level, max_level, province_id, owner_city_id)
			VALUES (1, 30, 40, 3, 4, 10, 1, 100), (1, 31, 40, 1, 2, 10, 1, NULL)`); err != nil {
		t.Fatal(err)
	}
	now := time.Unix(1795000000, 0)
	svc := world.NewGatherService(pool, wild)
	svc.Now = func() time.Time { return now }

	if _, err := svc.Start(ctx, 1, 7, 100, 11, 31, 40); !errors.Is(err, world.ErrFieldNotOwned) {
		t.Fatalf("unowned field: %v", err)
	}
	gather, err := svc.Start(ctx, 1, 7, 100, 11, 30, 40)
	if err != nil {
		t.Fatal(err)
	}
	if gather.Level != 4 || gather.Terrain != world.TerrainForest || gather.FinishAt != now.Add(time.Hour) {
		t.Fatalf("gather: %+v", gather)
	}
	if gather.Reward.Food != 320 || gather.Reward.Wood != 560 || len(gather.Reward.Items) != 1 ||
		gather.Reward.Items[0].ItemCfgID != 2103 || gather.Reward.Items[0].Count != 1 {
		t.Fatalf("reward: %+v", gather.Reward)
	}
	if _, err := svc.Start(ctx, 1, 7, 100, 12, 30, 40); !errors.Is(err, world.ErrGatherBusy) {
		t.Fatalf("second gather: %v", err)
	}
	if _, err := svc.Claim(ctx, 1, 7, gather.GatherID); !errors.Is(err, world.ErrGatherNotClaimed) {
		t.Fatalf("early claim: %v", err)
	}
	now = now.Add(61 * time.Minute)
	claimed, err := svc.Claim(ctx, 1, 7, gather.GatherID)
	if err != nil {
		t.Fatal(err)
	}
	if claimed.Status != 2 {
		t.Fatalf("status: %d", claimed.Status)
	}
	var food int64
	var quantity int64
	if err := pool.QueryRow(ctx, `SELECT food FROM player_wallet WHERE server_id=1 AND player_id=7`).Scan(&food); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE server_id=1 AND player_id=7 AND item_cfg_id=2103`).Scan(&quantity); err != nil {
		t.Fatal(err)
	}
	if food != 5320 || quantity != 1 {
		t.Fatalf("credited food=%d item=%d", food, quantity)
	}
	if _, err := svc.Claim(ctx, 1, 7, gather.GatherID); !errors.Is(err, world.ErrGatherClaimed) {
		t.Fatalf("repeat claim: %v", err)
	}
	list, err := svc.List(ctx, 1, 7, 100, 10)
	if err != nil || len(list) != 1 || list[0].Status != 2 {
		t.Fatalf("list: %+v %v", list, err)
	}
}
