package runtime

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/jackc/pgx/v5/pgxpool"
)

// The single runtime path must compose its durable military from the live
// catalog: no reviewed profile file, and the same database must compose again
// after a restart with an unchanged cohort.
func TestPGRuntimeMilitaryComposesFromLiveCatalog(t *testing.T) {
	fixture := pgfixture.OpenFullSpecDB(t)
	pool := runtimeSearchPathPool(t, fixture)
	ctx := context.Background()

	first, profiles, err := composeRuntimeMilitary(ctx, pool)
	if err != nil {
		t.Fatalf("compose: %v", err)
	}
	if first == nil || profiles == nil || profiles.catalog == nil || profiles.march == nil || profiles.recruit == nil {
		t.Fatal("durable military handle or profiles missing")
	}
	if got, want := len(profiles.military.Objects), len(march.MilitarySourceObjectNames()); got != want {
		t.Fatalf("military inventory %d, want %d", got, want)
	}
	for name, object := range profiles.military.Objects {
		if object.OID == 0 || object.OwnerOID == 0 {
			t.Fatalf("object %q has no live identity: %+v", name, object)
		}
	}
	if first.Profile().Cohort == [16]byte{} {
		t.Fatal("empty cohort")
	}

	second, again, err := composeRuntimeMilitary(ctx, pool)
	if err != nil {
		t.Fatalf("recompose after restart: %v", err)
	}
	if second.Profile().Cohort != first.Profile().Cohort {
		t.Fatal("cohort changed across restart")
	}
	if again.military.SchemaOID != profiles.military.SchemaOID {
		t.Fatal("schema identity changed across restart")
	}
}

// runtimeSearchPathPool keeps the fixture schema but drops the explicit
// pg_catalog entry: the durable source contract requires the builtin default
// deparse ((current_schemas(true))[1] = pg_catalog), which an explicit
// pg_catalog in search_path defeats.
func runtimeSearchPathPool(t *testing.T, fixture *pgxpool.Pool) *pgxpool.Pool {
	t.Helper()
	var schema string
	if err := fixture.QueryRow(context.Background(), `SELECT current_schema()`).Scan(&schema); err != nil {
		t.Fatal(err)
	}
	cfg := fixture.Config()
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}
