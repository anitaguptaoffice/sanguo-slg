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
)

func TestPGReturnAtomicSerialization(t *testing.T) {
	for _, mode := range []string{"complete commit", "readback commit", "readback rollback"} {
		t.Run(mode, func(t *testing.T) {
			pool, b, profile, trace := returnAtomicFixture(t)
			before := returnAtomicState(t, pool, false)
			first, a, ctx, p := returnAtomicParticipant(t, b, profile)
			second, other, run, q := returnAtomicParticipant(t, b, profile)
			var firstPID, secondPID int32
			baseOK(t, a.Scan(ctx, b, "SELECT pg_backend_pid()", nil, &firstPID))
			baseOK(t, other.Scan(run, b, "SELECT pg_backend_pid()", nil, &secondPID))
			if firstPID == secondPID {
				t.Fatal("transactions share a backend")
			}
			t.Logf("writer_pid=%d waiter_pid=%d", firstPID, secondPID)
			got, err := p.Complete(ctx, a, returnAtomicCandidate, returnAtomicOrigin)
			baseOK(t, err)
			if got.Disposition != ReturnApplied {
				t.Fatal(got)
			}
			call := q.Readback
			if mode == "complete commit" {
				call = q.Complete
			}
			type result struct {
				observation ReturnObservation
				err         error
			}
			done, finished := make(chan result, 1), make(chan struct{})
			run, cancel := context.WithCancel(run)
			trace.locks.Store(0)
			go func() {
				defer close(finished)
				v, e := call(run, other, returnAtomicCandidate, returnAtomicOrigin)
				done <- result{v, e}
			}()
			t.Cleanup(func() {
				cancel()
				select {
				case <-finished:
				case <-time.After(5 * time.Second):
					t.Error("blocked operation did not stop")
				}
			})
			waitPrepareBlocked(t, pool, secondPID, firstPID)
			if trace.locks.Load() == 0 { // Atomic tracer observation also orders the Access replacement for -race.
				t.Fatal("missing blocked-query witness")
			}
			*other = *a // Public operation must keep its own captured Access after this barrier.
			if returnAtomicState(t, pool, false) != before {
				t.Fatal("uncommitted credit visible")
			}
			want := ReturnCreditedTerminal
			if mode == "readback rollback" {
				want = ReturnStillReturning
				baseOK(t, first.Rollback(ctx))
			} else {
				baseOK(t, first.Commit(ctx))
			}
			var res result
			select {
			case res = <-done:
			case <-run.Done():
				t.Fatal(run.Err())
			}
			baseOK(t, res.err)
			if res.observation.Candidate != returnAtomicCandidate || res.observation.Disposition != want {
				t.Fatal("serialized classification", res.observation)
			}
			resolved := returnAtomicState(t, pool, false)
			baseOK(t, second.Commit(run))
			if returnAtomicState(t, pool, false) != resolved || mode == "readback rollback" && resolved != before {
				t.Fatal("duplicate/readback wrote")
			}
			var counts []int32
			baseOK(t, pool.QueryRow(ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop").Scan(&counts))
			expected := []int32{12, 8, 6, 9}
			if mode == "readback rollback" {
				expected = []int32{5, 0, 0, 0}
			}
			if !reflect.DeepEqual(counts, expected) {
				t.Fatal("credit count", counts)
			}
		})
	}
}

func TestPGReturnAtomicOuterAbort(t *testing.T) {
	for _, abort := range []bool{false, true} {
		pool, b, profile, _ := returnAtomicFixture(t)
		before := returnAtomicState(t, pool, false)
		o, a, ctx, p := returnAtomicParticipant(t, b, profile)
		got, err := p.Complete(ctx, a, returnAtomicCandidate, returnAtomicOrigin)
		baseOK(t, err)
		if got.Disposition != ReturnApplied {
			t.Fatal(got)
		}
		if abort {
			_, err = a.Exec(ctx, b, "SELECT 1/0") // Real outer SQL failure, not an invented participant callback.
			var pg *pgconn.PgError
			if !errors.As(err, &pg) || pg.Code != "22012" {
				t.Fatal(err)
			}
			if err = o.Commit(ctx); !errors.Is(err, pgx.ErrTxCommitRollback) {
				t.Fatal("aborted transaction committed", err)
			}
		} else {
			baseOK(t, o.Rollback(ctx))
		}
		if returnAtomicState(t, pool, false) != before {
			t.Fatal("outer rollback leaked provisional writes")
		}
	}
}

func TestPGReturnAtomicHelperZeroRows(t *testing.T) {
	pool, b, profile, _ := returnAtomicFixture(t)
	before := returnAtomicState(t, pool, false)
	o, a, ctx, p := returnAtomicParticipant(t, b, profile)
	st, err := p.returnLocked(ctx, a, returnAtomicCandidate, returnAtomicOrigin)
	baseOK(t, err)
	ready, err := returnCapacity(recruitScope{1, 1, 100}, st.pending, st.units, st.counts, p.catalog)
	baseOK(t, err)
	baseOK(t, validateRecruitPendingEvidence(ctx, a, p.source, RecruitScope{ServerID: 1, PlayerID: 1}, 100, st.pending.ids))
	st.pending.stock[3].ready++ // Helper-only stale expected value, unreachable after correct public locking.
	if err = p.returnApply(ctx, a, returnAtomicCandidate, returnAtomicOrigin, st, ready); !errors.Is(err, ErrReturnUnavailable) {
		t.Fatal(err)
	}
	var counts []int32
	baseOK(t, a.Scan(ctx, b, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop", nil, &counts))
	if !reflect.DeepEqual(counts, []int32{12, 8, 6, 0}) {
		t.Fatal("did not reach real fourth UPDATE 0 rows", counts)
	}
	baseOK(t, o.Rollback(ctx)) // Mandatory caller cleanup, not a claim that helper errors poison SQL.
	if returnAtomicState(t, pool, false) != before {
		t.Fatal("helper rollback leaked earlier writes")
	}
}

func TestPGReturnAtomicAccessAndDrift(t *testing.T) {
	pool, b, profile, _ := returnAtomicFixture(t)
	before := returnAtomicState(t, pool, false)
	o, a, ctx, p := returnAtomicParticipant(t, b, profile)
	copyAccess, copySource := *a, *p
	baseOK(t, o.Rollback(ctx))
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	wo, wa, wctx := baseOwner(t, wrong)
	o, a, ctx = baseOwner(t, b)
	baseOK(t, p.Pin(ctx, a))
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	check := func(ctx context.Context, access *recruittx.Access, cause error) {
		t.Helper()
		for _, call := range []func(context.Context, *recruittx.Access, ReturnCandidate, ReturnOrigin) (ReturnObservation, error){p.Complete, copySource.Readback} {
			got, err := call(ctx, access, returnAtomicCandidate, returnAtomicOrigin)
			if (!errors.Is(err, cause) && !(cause == recruittx.ErrInactive && errors.Is(err, context.Canceled))) || got != (ReturnObservation{}) {
				t.Fatal("usable invalid-access observation", got, err)
			}
		}
	}
	check(ctx, nil, ErrReturnSource)
	check(wctx, wa, recruittx.ErrBinding)
	check(ctx, &copyAccess, recruittx.ErrInactive)
	check(cancelled, a, context.Canceled)
	execPrep(t, ctx, a, b, "ALTER TABLE army_troop ENABLE ROW LEVEL SECURITY")
	check(ctx, a, ErrReturnSource)
	baseOK(t, o.Rollback(ctx))
	baseOK(t, wo.Rollback(wctx))
	o, a, ctx = baseOwner(t, b)
	check(ctx, a, ErrReturnSource) // Repair by rollback must not resurrect shared retirement.
	baseOK(t, o.Rollback(ctx))
	if returnAtomicState(t, pool, false) != before {
		t.Fatal("access/source rejection wrote")
	}
}
