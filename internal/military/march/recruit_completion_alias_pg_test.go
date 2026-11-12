package march

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type recruitAliasTrace struct {
	completionTrace
	world, origin sync.Once
	onWorld       func()
	onOrigin      func()
}

func (t *recruitAliasTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	t.completionTrace.TraceQueryStart(ctx, conn, d)
	switch {
	case strings.Contains(d.SQL, "player_city") && strings.Contains(d.SQL, "FOR UPDATE"):
		t.world.Do(func() {
			if t.onWorld != nil {
				t.onWorld()
			}
		})
	case strings.Contains(d.SQL, "mil_city_origin") && strings.Contains(d.SQL, "FOR UPDATE"):
		t.origin.Do(func() {
			if t.onOrigin != nil {
				t.onOrigin()
			}
		})
	}
	return ctx
}

func completionTracedPG(t *testing.T, trace *recruitAliasTrace, rows ...historyRow) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile, *recruitAliasTrace) {
	t.Helper()
	pool, _, p := completionPG(t, rows...)
	cfg := pool.Config()
	cfg.ConnConfig.Tracer = trace
	observed, err := pgxpool.NewWithConfig(context.Background(), cfg)
	baseOK(t, err)
	t.Cleanup(observed.Close)
	b, err := recruittx.NewBinding(observed)
	baseOK(t, err)
	return observed, b, p, trace
}

func recruitAliasOtherJob(t *testing.T, catalog *RecruitCatalog, active historyRow) historyRow {
	t.Helper()
	evidence, err := catalog.evidence(string(active.version), 1)
	baseOK(t, err)
	payload, err := encodeRecruitPayload(evidence, RecruitRequest{CityID: 101, UnitCfgID: 1, Count: 2})
	baseOK(t, err)
	other := active
	other.queueID, other.command, other.qCity, other.payload, other.player = 43, RecruitCommandID{5}, 101, payload, 2
	return other
}

// Caller due-slice mutation at the WORLD wait must not substitute another city's validated batch.
func TestPGApplyDueCallerDueAlias(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	other := recruitAliasOtherJob(t, catalog, active)
	trace := &recruitAliasTrace{}
	pool, b, p, trace := completionTracedPG(t, trace, active, waiting, other)
	dueWorld(t, pool, 100, 1)
	dueWorld(t, pool, 101, 2)
	dueCity(t, pool, p, 101)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	before := completionState(t, pool)
	due := dueOf(active)
	trace.onWorld = func() { due[0] = dueOf(other)[0] }
	effects, err := participant.ApplyDueRecruits(ctx, a, due)
	baseOK(t, err)
	if len(effects) != 1 || effects[0].DoneID != active.queueID || effects[0].CityID != 100 {
		t.Fatalf("effects = %+v", effects)
	}
	baseOK(t, o.Commit(ctx))
	var stock100, stock101, status40, status43 int
	baseOK(t, pool.QueryRow(context.Background(), `SELECT count FROM city_troop WHERE city_id=100 AND unit_cfg_id=1`).Scan(&stock100))
	baseOK(t, pool.QueryRow(context.Background(), `SELECT count FROM city_troop WHERE city_id=101 AND unit_cfg_id=1`).Scan(&stock101))
	baseOK(t, pool.QueryRow(context.Background(), `SELECT status FROM work_queue WHERE queue_id=40`).Scan(&status40))
	baseOK(t, pool.QueryRow(context.Background(), `SELECT status FROM work_queue WHERE queue_id=43`).Scan(&status43))
	if stock100 != 7 || status40 != 2 || stock101 != 5 || status43 != 1 {
		t.Fatalf("validated city stock=%d queue=%d foreign stock=%d queue=%d", stock100, status40, stock101, status43)
	}
	if completionState(t, pool) == before {
		t.Fatal("expected durable completion for the originally validated city")
	}
}

func TestPGApplyDueAccessAlias(t *testing.T) {
	for _, mode := range []struct {
		name          string
		commitFirst   bool
		expectDurable bool
	}{
		{"commit original rollback replacement", true, true},
		{"rollback original commit replacement", false, false},
	} {
		t.Run(mode.name, func(t *testing.T) {
			catalog, active, waiting, _ := completionRows(t)
			trace := &recruitAliasTrace{}
			pool, b, p, trace := completionTracedPG(t, trace, active, waiting)
			dueWorld(t, pool, 100, 1)
			o1, a1, ctx1, participant := completionParticipant(t, b, p, catalog)
			o2, a2, ctx2 := baseOwner(t, b)
			participant2, err := NewRecruitParticipant(ctx2, b, a2, p, catalog)
			baseOK(t, err)
			baseOK(t, participant2.Pin(ctx2, a2))
			var pid1, pid2 int
			baseOK(t, a1.Scan(ctx1, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid1))
			baseOK(t, a2.Scan(ctx2, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid2))
			if pid1 == pid2 {
				t.Fatal("transactions share a backend")
			}
			t.Logf("owner_pid=%d replacement_pid=%d", pid1, pid2)
			before := completionState(t, pool)
			type result struct {
				effects []RecruitDueEffect
				err     error
			}
			done := make(chan result, 1)
			trace.onWorld = func() { *a1 = *a2 }
			go func() {
				effects, err := participant.ApplyDueRecruits(ctx1, a1, dueOf(active))
				done <- result{effects, err}
			}()
			res := <-done
			baseOK(t, res.err)
			if len(res.effects) != 1 || res.effects[0].DoneID != active.queueID {
				t.Fatalf("apply = %+v", res.effects)
			}
			if mode.commitFirst {
				baseOK(t, o1.Commit(ctx1))
				baseOK(t, o2.Rollback(ctx2))
			} else {
				baseOK(t, o1.Rollback(ctx1))
				baseOK(t, o2.Commit(ctx2))
			}
			after := completionState(t, pool)
			if mode.expectDurable && after == before {
				t.Fatal("original commit did not durably credit")
			}
			if !mode.expectDurable && after != before {
				t.Fatal("rolled-back original leaked writes via replacement")
			}
		})
	}
}

func TestPGCompleteAccessAlias(t *testing.T) {
	for _, mode := range []struct {
		name          string
		commitFirst   bool
		expectDurable bool
	}{
		{"commit original rollback replacement", true, true},
		{"rollback original commit replacement", false, false},
	} {
		t.Run(mode.name, func(t *testing.T) {
			catalog, active, waiting, _ := completionRows(t)
			trace := &recruitAliasTrace{}
			pool, b, p, trace := completionTracedPG(t, trace, active, waiting)
			dueWorld(t, pool, 100, 1)
			o1, a1, ctx1, participant := completionParticipant(t, b, p, catalog)
			o2, a2, ctx2 := baseOwner(t, b)
			second, err := NewRecruitParticipant(ctx2, b, a2, p, catalog)
			baseOK(t, err)
			baseOK(t, second.Pin(ctx2, a2))
			var pid1, pid2 int
			baseOK(t, a1.Scan(ctx1, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid1))
			baseOK(t, a2.Scan(ctx2, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid2))
			if pid1 == pid2 {
				t.Fatal("transactions share a backend")
			}
			t.Logf("owner_pid=%d replacement_pid=%d", pid1, pid2)
			before := completionState(t, pool)
			type result struct {
				got RecruitCompletion
				err error
			}
			done := make(chan result, 1)
			trace.onOrigin = func() { *a1 = *a2 }
			go func() {
				got, err := participant.Complete(ctx1, a1, completionCandidate(active))
				done <- result{got, err}
			}()
			res := <-done
			completionWant(t, res.got, res.err, RecruitCompleted)
			if mode.commitFirst {
				baseOK(t, o1.Commit(ctx1))
				baseOK(t, o2.Rollback(ctx2))
			} else {
				baseOK(t, o1.Rollback(ctx1))
				baseOK(t, o2.Commit(ctx2))
			}
			after := completionState(t, pool)
			if mode.expectDurable && after == before {
				t.Fatal("original commit did not durably credit")
			}
			if !mode.expectDurable && after != before {
				t.Fatal("rolled-back original leaked writes via replacement")
			}
		})
	}
}

func TestPGRecruitCompletionAliasInvalidAccess(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	pool, b, p := completionPG(t, active, waiting)
	dueWorld(t, pool, 100, 1)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	check := func(ctx context.Context, access *recruittx.Access, cause error) {
		t.Helper()
		got, err := participant.Complete(ctx, access, completionCandidate(active))
		if (!errors.Is(err, cause) && !(cause == recruittx.ErrInactive && errors.Is(err, context.Canceled))) || got != 0 {
			t.Fatal("invalid access completed", got, err)
		}
		effects, err := participant.ApplyDueRecruits(ctx, access, dueOf(active))
		if effects != nil || (!errors.Is(err, cause) && !(cause == recruittx.ErrInactive && errors.Is(err, context.Canceled))) {
			t.Fatal("invalid access applied", effects, err)
		}
	}
	check(ctx, nil, ErrRecruitUnavailable)
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	wo, wa, wctx := baseOwner(t, wrong)
	check(wctx, wa, recruittx.ErrBinding)
	baseOK(t, wo.Rollback(wctx))
	copyAccess := *a
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	check(cancelled, a, context.Canceled)
	*a = *wa // Replacing caller storage must not rebind a previously captured Access.
	got, err := participant.Complete(ctx, &copyAccess, completionCandidate(active))
	completionWant(t, got, err, RecruitCompleted)
	*a = copyAccess
	baseOK(t, o.Rollback(ctx))
	check(context.Background(), &copyAccess, recruittx.ErrInactive)
}
