package combat

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGTacticsLoader(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO city_tactic(server_id,city_id,troop_type,target_type,hold)
		VALUES(1,71,1,2,true),(1,71,3,-1,false)
		ON CONFLICT (server_id,city_id,troop_type) DO UPDATE SET target_type=EXCLUDED.target_type,hold=EXCLUDED.hold`); err != nil {
		t.Fatal(err)
	}
	load := TacticsPG(pool)
	got, err := load(ctx, 1, 71)
	if err != nil {
		t.Fatal(err)
	}
	if got[battle.TroopCavalry] != (battle.Tactic{Target: battle.TroopArcher, Hold: true}) {
		t.Fatalf("cavalry tactic = %+v", got[battle.TroopCavalry])
	}
	if got[battle.TroopSiege] != (battle.Tactic{}) {
		t.Fatalf("siege tactic = %+v", got[battle.TroopSiege])
	}
	if _, err := load(ctx, 1, 999); err != nil {
		t.Fatalf("missing city: %v", err)
	}
}
