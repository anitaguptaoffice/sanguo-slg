package combat

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
)

func TestPGScoutSinkAndList(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	sink := ScoutSinkPG(pool, 1)
	if err := sink(ctx, ScoutObservation{PlayerID: 95, X: 5, Y: 6, Tier: 3, TargetName: "森林 Lv4",
		Detail: []byte(`{"tier":3,"defender_troops":120}`)}); err != nil {
		t.Fatal(err)
	}
	rows, err := ListScoutReports(ctx, pool, 1, 95, 10)
	if err != nil || len(rows) == 0 {
		t.Fatalf("rows=%d err=%v", len(rows), err)
	}
	if rows[0].Tier != 3 || rows[0].TargetName != "森林 Lv4" || rows[0].X != 5 {
		t.Fatalf("report=%+v", rows[0])
	}
}
