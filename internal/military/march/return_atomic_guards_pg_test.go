package march

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// A separate pool cannot reuse the Owner's physical connection after it ends.
func returnAtomicGuardObserver(t *testing.T, pool *pgxpool.Pool) *pgxpool.Pool {
	t.Helper()
	cfg := pool.Config()
	cfg.MaxConns, cfg.MinConns = 1, 0
	observer, err := pgxpool.NewWithConfig(context.Background(), cfg)
	baseOK(t, err)
	t.Cleanup(observer.Close)
	return observer
}

func returnAtomicGuardPIDs(t *testing.T, ctx context.Context, a *recruittx.Access, b *recruittx.Binding, observer *pgxpool.Pool) {
	t.Helper()
	var writerPID, observerPID int32
	baseOK(t, a.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &writerPID))
	baseOK(t, observer.QueryRow(ctx, "SELECT pg_catalog.pg_backend_pid()").Scan(&observerPID))
	if writerPID == observerPID {
		t.Fatal("observer shares the live Owner backend")
	}
	t.Logf("owner_pid=%d observer_pid=%d", writerPID, observerPID)
}

func TestPGReturnAtomicPublicRejectedBranches(t *testing.T) {
	type fault struct{ name, sql string }
	common := []fault{
		{"missing_stock", "DELETE FROM city_troop WHERE unit_cfg_id=4"},
		{"extra_stock", "INSERT INTO city_troop VALUES(1,100,5,0,0)"},
		{"unknown_stock_unit", "UPDATE city_troop SET unit_cfg_id=5 WHERE unit_cfg_id=4"},
		{"army_status", "UPDATE field_army SET status=3"},
		{"army_position", "UPDATE field_army SET x=99"},
		{"empty_heroes", "UPDATE field_army SET hero_ids='{}'"},
		{"missing_origin", "UPDATE march_order SET origin_city_id=NULL"},
	}
	for _, branch := range []struct {
		name, sql string
		phase     ReturnDisposition
		read      bool
	}{
		{"complete_early", "UPDATE march_order SET return_finish_at='2999-01-02 03:05:05.123456+00'", ReturnEarly, false},
		{"complete_credited", "UPDATE march_order SET status=4; UPDATE field_army SET status=1,x=0,y=0", ReturnCreditedTerminal, false},
		{"complete_annihilated", "UPDATE march_order SET status=4,return_finish_at=NULL; UPDATE field_army SET status=1; DELETE FROM army_troop", ReturnAnnihilatedTerminal, false},
		{"readback_still", "SELECT 1", ReturnStillReturning, true},
		{"readback_early", "UPDATE march_order SET return_finish_at='2999-01-02 03:05:05.123456+00'", ReturnEarly, true},
		{"readback_credited", "UPDATE march_order SET status=4; UPDATE field_army SET status=1,x=0,y=0", ReturnCreditedTerminal, true},
		{"readback_annihilated", "UPDATE march_order SET status=4,return_finish_at=NULL; UPDATE field_army SET status=1; DELETE FROM army_troop", ReturnAnnihilatedTerminal, true},
	} {
		t.Run(branch.name, func(t *testing.T) {
			pool, b, profile, _ := returnAtomicFixture(t)
			baseSQL(t, pool, branch.sql)
			observer := returnAtomicGuardObserver(t, pool)
			before := returnAtomicState(t, observer, false)
			faults := append([]fault{}, common...)
			if branch.phase == ReturnAnnihilatedTerminal {
				faults = append(faults,
					fault{"unexpected_survivors", "INSERT INTO army_troop VALUES(1,1,1,7)"},
					fault{"unexpected_deadline", "UPDATE march_order SET return_finish_at='2026-01-02 03:05:05.123456+00'"},
					fault{"false_returning", "UPDATE march_order SET status=3; UPDATE field_army SET status=2"})
			} else {
				faults = append(faults,
					fault{"missing_survivors", "DELETE FROM army_troop"},
					fault{"missing_deadline", "UPDATE march_order SET return_finish_at=NULL"},
					fault{"invalid_deadline", "UPDATE march_order SET return_finish_at=arrive_at"},
					fault{"unknown_survivor", "UPDATE army_troop SET unit_cfg_id=5 WHERE unit_cfg_id=4"},
					fault{"zero_survivor", "UPDATE army_troop SET count=0 WHERE unit_cfg_id=1"})
			}
			for _, bad := range faults {
				t.Run(bad.name, func(t *testing.T) {
					o, a, ctx, p := returnAtomicParticipant(t, b, profile)
					returnAtomicGuardPIDs(t, ctx, a, b, observer)
					// Test-owned corruption is rolled back along with any participant work.
					// No catalog constraint or production hook is changed.
					execPrep(t, ctx, a, b, bad.sql)
					call := p.Complete
					if branch.read {
						call = p.Readback
					}
					got, err := call(ctx, a, returnAtomicCandidate, returnAtomicOrigin)
					if !errors.Is(err, ErrReturnUnavailable) || got != (ReturnObservation{}) {
						t.Fatal("public branch accepted malformed evidence", got, err)
					}
					baseOK(t, o.Rollback(ctx))
					if returnAtomicState(t, observer, false) != before {
						t.Fatal("rejection rollback changed stock, graph, evidence or sequence")
					}
				})
			}
		})
	}
}

func TestPGReturnAtomicDeferredCommitFailure(t *testing.T) {
	pool, b, profile, _ := returnAtomicFixture(t)
	observer := returnAtomicGuardObserver(t, pool)
	const tableName, constraintName = "return_atomic_commit_guard", "return_atomic_commit_unique"
	table := pgx.Identifier{profile.SchemaName, tableName}.Sanitize()
	// This auxiliary relation is outside the unchanged 23-object inventory.
	// It has no references, triggers or constraints on the certified MIL tables.
	baseSQL(t, pool, "CREATE TABLE "+table+" (value integer NOT NULL, CONSTRAINT "+constraintName+" UNIQUE(value) DEFERRABLE INITIALLY DEFERRED); INSERT INTO "+table+" VALUES(1)")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var deferred, deferrable bool
	baseOK(t, observer.QueryRow(ctx, "SELECT condeferrable,condeferred FROM pg_catalog.pg_constraint WHERE conrelid=$1::regclass AND conname=$2", table, constraintName).Scan(&deferrable, &deferred))
	if !deferrable || !deferred || len(profile.Objects) != 23 {
		t.Fatal("invalid deferred guard or altered source inventory")
	}
	auxState := func() string {
		t.Helper()
		var out string
		baseOK(t, observer.QueryRow(ctx, "SELECT jsonb_agg(jsonb_build_array(t.value,t.xmin::text,t.ctid::text) ORDER BY t.ctid)::text FROM "+table+" t").Scan(&out))
		return out
	}
	before, auxBefore := returnAtomicState(t, observer, false), auxState()
	o, a, run, p := returnAtomicParticipant(t, b, profile)
	returnAtomicGuardPIDs(t, run, a, b, observer)
	// The test Owner queues a real violation; this statement must succeed.
	tag, err := a.Exec(run, b, "INSERT INTO "+table+" VALUES(1)")
	baseOK(t, err)
	if tag.RowsAffected() != 1 {
		t.Fatal("deferred conflict was not queued")
	}
	got, err := p.Complete(run, a, returnAtomicCandidate, returnAtomicOrigin)
	baseOK(t, err)
	due := time.Date(2026, 1, 2, 3, 5, 5, 123456000, time.UTC)
	if got != (ReturnObservation{returnAtomicCandidate, ReturnApplied, due}) {
		t.Fatal("expected provisional Applied before outer COMMIT", got)
	}
	var counts []int32
	var march, army, x, y, conflicts int32
	baseOK(t, a.Scan(run, b, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop", nil, &counts))
	baseOK(t, a.Scan(run, b, "SELECT m.status,a.status,a.x,a.y FROM march_order m,field_army a", nil, &march, &army, &x, &y))
	baseOK(t, a.Scan(run, b, "SELECT count(*) FROM "+table, nil, &conflicts))
	if !reflect.DeepEqual(counts, []int32{12, 8, 6, 9}) || march != 4 || army != 1 || x != 0 || y != 0 || conflicts != 2 {
		t.Fatal("missing provisional credit, terminal graph or deferred conflict", counts, march, army, x, y, conflicts)
	}
	if returnAtomicState(t, observer, false) != before || auxState() != auxBefore {
		t.Fatal("provisional writes visible to independent observer")
	}
	err = o.Commit(run) // No explicit rollback or failing statement before this call.
	var pg *pgconn.PgError
	if !errors.Is(err, recruittx.ErrOutcomeUnknown) || !errors.As(err, &pg) || pg.Code != "23505" || pg.ConstraintName != constraintName || pg.TableName != tableName || pg.SchemaName != profile.SchemaName {
		t.Fatal("expected actual deferred UNIQUE failure from outer COMMIT", err)
	}
	// Owner conservatively wraps all commit errors as unknown. These independent
	// database observations establish this fixture's rollback, not lost-ack recovery.
	if returnAtomicState(t, observer, false) != before || auxState() != auxBefore {
		t.Fatal("failed COMMIT leaked stock, terminal graph or auxiliary writes")
	}
	var unused int
	if err = a.Scan(run, b, "SELECT 1", nil, &unused); !errors.Is(err, recruittx.ErrInactive) && !errors.Is(err, context.Canceled) {
		t.Fatal("Access remained usable after failed COMMIT", err)
	}
	t.Logf("outer_commit_sqlstate=%s constraint=%s rollback_snapshot_unchanged=true", pg.Code, pg.ConstraintName)
}
