package hero

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func identityStore(t *testing.T) *PGStore {
	t.Helper()
	ctx := context.Background()
	admin := openHeroTestDB(t)
	schema := fmt.Sprintf("hero_identity_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(ctx, "DROP SCHEMA "+quoted+" CASCADE"); err != nil {
			t.Error(err)
		}
	})
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	applyHeroSchema(t, pool)
	return NewPGStore(pool)
}

func TestPGCreateHeroCallerOwnsTransaction(t *testing.T) {
	ctx := context.Background()
	store := identityStore(t)
	tx, err := store.Pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	h := &Hero{ServerID: 1, PlayerID: 1, Level: 1, Loyalty: 70, Status: StatusComing}
	// An empty PGStore proves the shared port cannot depend on its Pool.
	if err := (&PGStore{}).CreateHeroInTx(ctx, tx, h); err != nil || h.HeroID <= 0 {
		t.Fatalf("create: %+v %v", h, err)
	}
	var n int
	if err := store.Pool.QueryRow(ctx, "SELECT count(*) FROM player_hero").Scan(&n); err != nil || n != 0 {
		t.Fatalf("uncommitted row visible: %d %v", n, err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	next := &Hero{ServerID: 2, PlayerID: 1, Level: 1, Loyalty: 70, Status: StatusIdle}
	if err := store.CreateHero(ctx, next); err != nil || next.HeroID <= h.HeroID {
		t.Fatalf("rollback ID reused: %+v %v", next, err)
	}
	if err := store.Pool.QueryRow(ctx, "SELECT count(*) FROM player_hero").Scan(&n); err != nil || n != 1 {
		t.Fatalf("rows after rollback/create: %d %v", n, err)
	}
	if err := store.DeleteHero(ctx, next.ServerID, next.HeroID); err != nil {
		t.Fatal(err)
	}
	afterDelete := &Hero{ServerID: 1, PlayerID: 1}
	if err := store.CreateHero(ctx, afterDelete); err != nil || afterDelete.HeroID <= next.HeroID {
		t.Fatalf("deleted ID reused: %+v %v", afterDelete, err)
	}
}
