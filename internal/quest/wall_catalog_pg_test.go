package quest

import (
	"context"
	"testing"
)

func TestPGWallCatalogRejectsUnknownObjectiveMembers(t *testing.T) {
	pool, _, _ := claimPGFixture(t)
	ctx := context.Background()
	canonical := `[{"type":"build_level","building_cfg_id":7,"level":1}]`
	t.Cleanup(func() {
		if _, err := pool.Exec(ctx, `UPDATE cfg_quest SET objectives=$1 WHERE quest_cfg_id=1006`, canonical); err != nil {
			t.Error(err)
		}
	})
	for _, raw := range []string{
		`[{"type":"build_level","building_cfg_id":7,"level":1,"unknown":1}]`,
		`[{"type":"build_level","building_cfg_id":7,"level":1,"unknown":0}]`,
	} {
		if _, err := pool.Exec(ctx, `UPDATE cfg_quest SET objectives=$1 WHERE quest_cfg_id=1006`, raw); err != nil {
			t.Fatal(err)
		}
		if _, err := MemCatalogFromPG(ctx, pool); err == nil {
			t.Fatalf("silently discarded wall objective: %s", raw)
		}
	}
	if _, err := pool.Exec(ctx, `UPDATE cfg_quest SET objectives=$1 WHERE quest_cfg_id=1006`, canonical); err != nil {
		t.Fatal(err)
	}
	cat, err := MemCatalogFromPG(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	wall, _ := cat.Get(1006)
	if err := wallConfig(wall); err != nil {
		t.Fatal(err)
	}
	// Parsing policy for unrelated existing objectives is deliberately unchanged.
	if _, err := ParseObjectivesJSON([]byte(`[{"type":"train_troops","count":50,"legacy_extra":true}]`)); err != nil {
		t.Fatal(err)
	}
}
