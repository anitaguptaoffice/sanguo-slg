package domestic

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func queuePublicFixture(t *testing.T) *pgxpool.Pool {
	t.Helper()
	admin := openDomesticTestDB(t)
	name := fmt.Sprintf("queue_public_%d", time.Now().UnixNano())
	productionSQL(t, admin, "CREATE DATABASE "+name)
	cfg := admin.Config()
	cfg.ConnConfig.Database = name
	delete(cfg.ConnConfig.RuntimeParams, "search_path")
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Close(); productionSQL(t, admin, "DROP DATABASE "+name); admin.Close() })
	applyDomesticSchema(t, pool)
	return pool
}

func TestPGQueueDatabaseOwnerAliasIsOnlyPublicSchemaException(t *testing.T) {
	for _, mode := range []string{"custom-alias-objects", "custom-direct-objects", "public-alias-objects", "public-direct-objects"} {
		t.Run(mode, func(t *testing.T) {
			var pool *pgxpool.Pool
			if mode == "public-alias-objects" || mode == "public-direct-objects" {
				pool = queuePublicFixture(t)
			} else {
				pool = productionTestPool(t)
			}
			now := time.Unix(1700000000, 0)
			h, c := queueCity(t, pool, 1, 1, 42, &now)
			before := cloneCity(c)
			var schema string
			if err := pool.QueryRow(context.Background(), "SELECT current_schema()").Scan(&schema); err != nil {
				t.Fatal(err)
			}
			productionSQL(t, pool, "ALTER SCHEMA "+pgx.Identifier{schema}.Sanitize()+" OWNER TO pg_database_owner")
			if mode == "custom-alias-objects" || mode == "public-alias-objects" {
				productionSQL(t, pool, "ALTER TABLE work_queue OWNER TO pg_database_owner; ALTER SEQUENCE work_queue_id_seq OWNER TO pg_database_owner")
			}
			// A fresh startup and an already-bound store must reject alias-owned objects.
			fresh := NewPGStore(pool)
			_, bindErr := fresh.bindQueueIdentity(context.Background(), 1)
			result, err := h.StartBuildingUpgrade(c.ID, "lumber", 3)
			if mode == "public-direct-objects" {
				if bindErr != nil || err != nil || result.JobID != 1 {
					t.Fatal("valid default public rejected", bindErr, result, err)
				}
				return
			}
			if !errors.Is(bindErr, ErrQueueIdentity) || !errors.Is(err, ErrQueueIdentity) || result != (UpgradeResult{}) {
				t.Fatal("alias ownership accepted", bindErr, result, err)
			}
			queueUnchanged(t, pool, h, c, before, 0)
			var called bool
			if err = pool.QueryRow(context.Background(), "SELECT is_called FROM work_queue_id_seq").Scan(&called); err != nil || called {
				t.Fatal("invalid provenance advanced allocator", called, err)
			}
		})
	}
}

func TestPGQueueInvalidStartupCannotRebindSameStore(t *testing.T) {
	pool := productionTestPool(t)
	for _, mode := range []string{"nil-pool", "zero-shard", "negative-shard"} {
		t.Run(mode, func(t *testing.T) {
			store := NewPGStore(pool)
			sid := int32(1)
			switch mode {
			case "nil-pool":
				store.Pool = nil
			case "zero-shard":
				sid = 0
			case "negative-shard":
				sid = -1
			}
			h := NewHub(nil)
			h.UseStore(store, sid, 0)
			store.Pool = pool
			h.UseStore(store, 1, 0)
			if _, err := store.bindQueueIdentity(context.Background(), 1); !errors.Is(err, ErrQueueIdentity) {
				t.Fatal("invalid startup rebound", err)
			}
			replacement := NewPGStore(pool)
			if _, err := replacement.bindQueueIdentity(context.Background(), 1); err != nil {
				t.Fatal("fresh valid wiring", err)
			}
		})
	}
}
