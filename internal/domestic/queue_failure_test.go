package domestic

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func queueUnchanged(t *testing.T, pool *pgxpool.Pool, h *Hub, c, before *CityState, scheduled int) {
	t.Helper()
	if !reflect.DeepEqual(c, before) || len(h.sched.q) != scheduled {
		t.Fatal("failure published cache/scheduler", c, before, len(h.sched.q))
	}
	disk, err := h.store.LoadCity(context.Background(), h.serverID, c.ID, c.PlayerID)
	if err != nil {
		t.Fatal(err)
	}
	if disk.Wallet != before.Wallet || len(disk.BuildJobs) != len(before.BuildJobs) || !disk.LastSettleAt.Equal(before.LastSettleAt) {
		t.Fatal("failure published disk", disk, before)
	}
}

func TestPGQueueSQLAndCommitRollbackLeaveOnlyGaps(t *testing.T) {
	for _, mode := range []string{"sql", "commit", "cancel-after-allocation"} {
		t.Run(mode, func(t *testing.T) {
			pool := productionTestPool(t)
			now := time.Unix(1700000000, 0)
			h, c := queueCity(t, pool, 1, 1, 42, &now)
			before := cloneCity(c)
			cleanup := ""
			switch mode {
			case "sql":
				productionSQL(t, pool, "ALTER TABLE city_building ADD CONSTRAINT reject_queue_save CHECK(level<0) NOT VALID")
				cleanup = "ALTER TABLE city_building DROP CONSTRAINT reject_queue_save"
			case "commit":
				productionSQL(t, pool, `CREATE FUNCTION reject_queue_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture commit rejected'; END $$;
 CREATE CONSTRAINT TRIGGER reject_queue_commit AFTER UPDATE ON city_production_checkpoint DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_queue_commit()`)
				cleanup = "DROP TRIGGER reject_queue_commit ON city_production_checkpoint"
			case "cancel-after-allocation":
				productionSQL(t, pool, `CREATE FUNCTION pause_queue_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1); RETURN NEW; END $$;
 CREATE TRIGGER pause_queue_save BEFORE INSERT ON city_building FOR EACH ROW EXECUTE FUNCTION pause_queue_save()`)
				cleanup = "DROP TRIGGER pause_queue_save ON city_building"
			}
			var result UpgradeResult
			var err error
			if mode == "cancel-after-allocation" {
				ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
				defer cancel()
				var job *BuildJob
				result, job, err = h.store.startBuildingUpgrade(ctx, 1, c, h.cat, now, "lumber", 3)
				if job != nil || !errors.Is(err, context.DeadlineExceeded) {
					t.Fatal("cancellation", job, err)
				}
			} else {
				result, err = h.StartBuildingUpgrade(c.ID, "lumber", 3)
			}
			if err == nil || result != (UpgradeResult{}) {
				t.Fatal("published failed response", result, err)
			}
			queueUnchanged(t, pool, h, c, before, 0)
			var last int64
			var called bool
			if err = pool.QueryRow(context.Background(), "SELECT last_value,is_called FROM work_queue_id_seq").Scan(&last, &called); err != nil || last != 1 || !called {
				t.Fatal("expected reserved gap", last, called, err)
			}
			productionSQL(t, pool, cleanup)
			result, err = h.StartBuildingUpgrade(c.ID, "lumber", 3)
			if err != nil || result.JobID != 2 || c.BuildJobs[0].ID != 2 || len(h.sched.q) != 1 {
				t.Fatal(result, err)
			}
		})
	}
}

func TestPGQueueCanceledWalletWaitDoesNotAllocate(t *testing.T) {
	pool := productionTestPool(t)
	now := time.Unix(1700000000, 0)
	h, c := queueCity(t, pool, 1, 1, 42, &now)
	before := cloneCity(c)
	tx, err := pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(context.Background(), "SELECT 1 FROM player_wallet FOR UPDATE"); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	result, job, err := h.store.startBuildingUpgrade(ctx, 1, c, h.cat, now, "lumber", 3)
	if !errors.Is(err, context.DeadlineExceeded) || result != (UpgradeResult{}) || job != nil {
		t.Fatal(result, job, err)
	}
	if err = tx.Rollback(context.Background()); err != nil {
		t.Fatal(err)
	}
	queueUnchanged(t, pool, h, c, before, 0)
	var called bool
	if err = pool.QueryRow(context.Background(), "SELECT is_called FROM work_queue_id_seq").Scan(&called); err != nil || called {
		t.Fatal(called, err)
	}
}

func TestPGQueueExhaustionRetainsReadsAndCompletion(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	now := time.Unix(1700000000, 0)
	h, c := queueCity(t, pool, 1, 1, 42, &now)
	queueFixtureMaintenance(t, pool, maxQueueID-1)
	last, err := h.StartBuildingUpgrade(c.ID, "lumber", 3)
	if err != nil || last.JobID != maxQueueID {
		t.Fatal(last, err)
	}
	before := cloneCity(c)
	result, err := h.StartBuildingUpgrade(c.ID, "stone", 4)
	if !errors.Is(err, ErrQueueIdentity) || result != (UpgradeResult{}) {
		t.Fatal(result, err)
	}
	queueUnchanged(t, pool, h, c, before, 1)
	fresh := NewHub(func() time.Time { return now })
	fresh.UseStore(NewPGStore(queuePeerPool(t, pool)), 1, 0)
	c, err = fresh.LoadCity(ctx, c.ID, c.PlayerID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = fresh.RefreshWallet(ctx, c.ID); err != nil {
		t.Fatal(err)
	}
	now = last.FinishAt
	if fresh.Tick() != 1 || c.Buildings["lumber"].Level != 1 {
		t.Fatal("exhaustion blocked retained completion")
	}
	result, err = fresh.StartBuildingUpgrade(c.ID, "stone", 4)
	if !errors.Is(err, ErrQueueIdentity) || result != (UpgradeResult{}) {
		t.Fatal(result, err)
	}
}

func TestPGQueueOutOfBandFixtureDoesNotSilentlyRewriteIDs(t *testing.T) {
	pool := productionTestPool(t)
	now := time.Unix(1700000000, 0)
	h, c := queueCity(t, pool, 1, 1, 42, &now)
	before := cloneCity(c)
	productionSQL(t, pool, `INSERT INTO work_queue VALUES(1,1,42,1,3,'{"retained":true}',now(),now(),0)`)
	// Deliberately violate the inventory precondition: the real PK must reject it.
	result, err := h.StartBuildingUpgrade(c.ID, "lumber", 3)
	if err == nil || result != (UpgradeResult{}) {
		t.Fatal("silently rewrote legacy identity", result, err)
	}
	queueUnchanged(t, pool, h, c, before, 0)
	var id int64
	if err = pool.QueryRow(context.Background(), "SELECT queue_id FROM work_queue").Scan(&id); err != nil || id != 1 {
		t.Fatal(id, err)
	}
	// Authorized fixture repair is explicit, forward-only, and not in runtime code.
	queueFixtureMaintenance(t, pool, 1)
	result, err = h.StartBuildingUpgrade(c.ID, "lumber", 3)
	if err != nil || result.JobID != 2 {
		t.Fatal(result, err)
	}
}
