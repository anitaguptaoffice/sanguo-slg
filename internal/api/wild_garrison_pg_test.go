package api

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

func TestPGWildGarrisonPersistenceAndRecovery(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	store := world.NewPGStore(pool)
	svc := world.NewService(store)
	wild, err := world.LoadWildConfig("../../spec/data/generated/world_wild.json")
	if err != nil {
		t.Fatal(err)
	}
	svc.Wild = wild
	if _, err := pool.Exec(ctx, `INSERT INTO map_cell(server_id,x,y,terrain,level,max_level,province_id)
		VALUES(1, 30, 30, 3, 4, 10, 1)`); err != nil {
		t.Fatal(err)
	}
	g := NewWorldGarrisons(svc, 1)

	full := g.Get(ctx, 30, 30)
	if full == nil || len(full.Troops) == 0 || full.Name == "" || full.HeroForce <= 0 {
		t.Fatalf("full garrison: %+v", full)
	}
	if full.Loot.Food <= 0 || full.Loot.HeroExp <= 0 {
		t.Fatalf("garrison loot profile: %+v", full.Loot)
	}

	g.ApplyRemaining(ctx, 30, 30, []march.TroopStack{{UnitCfgID: 1, Count: 7}})
	var raw []byte
	var recoverAt time.Time
	if err := pool.QueryRow(ctx, `SELECT garrison_json, recover_at FROM map_cell WHERE server_id=1 AND x=30 AND y=30`).
		Scan(&raw, &recoverAt); err != nil {
		t.Fatal(err)
	}
	var stored []march.TroopStack
	if err := json.Unmarshal(raw, &stored); err != nil || len(stored) != 1 || stored[0].Count != 7 {
		t.Fatalf("persisted remnant: %s %v", raw, err)
	}
	if !recoverAt.After(time.Now()) {
		t.Fatalf("recover_at not in the future: %v", recoverAt)
	}
	remnant := g.Get(ctx, 30, 30)
	if remnant == nil || len(remnant.Troops) != 1 || remnant.Troops[0].Count != 7 {
		t.Fatalf("remnant read: %+v", remnant)
	}

	if _, err := pool.Exec(ctx, `UPDATE map_cell SET recover_at = now() - interval '1 minute' WHERE server_id=1 AND x=30 AND y=30`); err != nil {
		t.Fatal(err)
	}
	recovered := g.Get(ctx, 30, 30)
	if recovered == nil || len(recovered.Troops) != len(full.Troops) {
		t.Fatalf("garrison did not recover: %+v", recovered)
	}
}
