package api

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestPGRecruitCompletionReturnRows(t *testing.T) {
	var observed *recruitReturnObservedTrace
	f := newRecruitCompleteReturnPG(t, func(base *recruitPromotionTrace) pgx.QueryTracer {
		observed = &recruitReturnObservedTrace{inner: base}
		return observed
	})
	state := recruitReturnRowsPaid(t, f, observed)
	queries := recruitReturnRowQueries(f.profile.SchemaName)
	probeAll := func(locked bool) {
		t.Helper()
		// Observation has 8s; a final independent rollback may take another 3s.
		ctx, cancel := context.WithTimeout(f.ctx, 8*time.Second)
		defer cancel()
		for _, query := range queries {
			returnPGOK(t, recruitReturnRowProbe(ctx, f.observer, query, locked))
		}
	}
	probeAll(false)
	if err := recruitReturnRowProbe(f.ctx, f.observer, queries[0], true); err == nil {
		t.Fatal("unlocked real target was accepted as locked")
	}
	missing := "SELECT 1 FROM " + pgx.Identifier{f.profile.SchemaName, "player_wallet"}.Sanitize() + " WHERE player_id=999 FOR UPDATE NOWAIT"
	if err := recruitReturnRowProbe(f.ctx, f.observer, missing, false); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatal("missing real target did not retain ErrNoRows", err)
	}
	for _, tc := range []struct{ query, code string }{
		{missing, ""}, {"SELECT 2", ""}, {"SELECT no_such_probe_column", "42703"}, {"SELECT 1 FROM pg_catalog.pg_sleep(1)", "57014"},
	} {
		query := tc.query
		err := recruitReturnRowProbe(f.ctx, f.observer, query, true)
		if err == nil {
			t.Fatal("missing/wrong-marker/error/timeout probe became a lock witness", query)
		}
		if tc.code != "" {
			var pg *pgconn.PgError
			if !errors.As(err, &pg) || pg.Code != tc.code {
				t.Fatal("real PostgreSQL error/statement timeout was not observed", query, err)
			}
		}
	}
	if err := recruitReturnRowProbe(f.ctx, f.observer, "SELECT 2", false); err == nil {
		t.Fatal("incorrect real row marker was accepted")
	}
	probeAll(false) // The actual timeout/error transactions were rolled back.
	if !reflect.DeepEqual(state.paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("owned probe controls changed paid values, MVCC or allocators")
	}
	var call *recruitNoeffectCall
	t.Cleanup(func() {
		if call != nil {
			f.owned.cleanup(t, f.returnAttemptPG, call.done)
		}
	}) // Registered before starter: its cancel/release/join runs first by LIFO.
	selected, _ := observed.snapshot()
	full := len(f.trace.events())
	var lower, upper time.Time
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&lower))
	call = startRecruitNoeffect(t, f.recruit, &f.trace.recruitNoeffectTrace, state.candidate)
	pid := returnLifetimeReached(t, call.clock)
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&upper))
	call.clock.release()
	if pid == 0 || pid == f.observer.PgConn().PID() || returnLifetimeReached(t, call.commit) != pid {
		t.Fatal("near-capacity real clock/Commit backend changed")
	}
	select {
	case <-call.done:
		t.Fatal("completion returned before actual Commit")
	default:
	}
	if !reflect.DeepEqual(state.paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("near-capacity provisional effects were visible")
	}
	probeAll(true)
	var conflict *pgconn.PgError
	if err := recruitReturnRowProbe(f.ctx, f.observer, queries[0], false); !errors.As(err, &conflict) || conflict.Code != "55P03" {
		t.Fatal("held target did not reject the unlocked expectation", err)
	}
	call.commit.release()
	if !returnBackendJoin(call.done, 8*time.Second) {
		t.Fatal("near-capacity actual caller did not join")
	}
	if call.fault != nil {
		t.Fatal("near-capacity actual caller panicked", call.fault)
	}
	recruitAttemptPGConfirmed(t, call.result)
	if call.result.completion != march.RecruitCompleted || call.result.confirmed != (march.RecruitAcceptance{}) {
		t.Fatal("near-capacity disposition or fabricated acceptance", call.result)
	}
	returnPGOK(t, recruitPromotionRecorded(f.trace.events()[full:], f.observer.PgConn().PID(), f.profileR))
	observed.check(t, f, len(selected), full, nil)
	after := recruitReturnRowsCheckpoint(t, f, state, lower, upper)
	probeAll(false)
	returnAttemptClean(t, f.returnAttemptPG)
	f.recruit.s.mu.Lock()
	closed, attempts := f.recruit.s.closed, len(f.recruit.s.attempts)
	f.recruit.s.mu.Unlock()
	f.recruit.s.admission.s.mu.Lock()
	pending := f.recruit.s.admission.s.pending
	f.recruit.s.admission.s.mu.Unlock()
	if closed || attempts != 0 || pending != 0 {
		t.Fatal("near-capacity Recruit retained attempts or leases")
	}
	returnPGOK(t, f.recruit.close())
	returnPGOK(t, f.generation.close())
	returnPGOK(t, f.recruit.s.admission.waitDrained(f.ctx))
	returnPGOK(t, f.generation.s.admission.waitDrained(f.ctx))
	returnPGReleased(t, f.ctx, f.observer, f.profile)
	recruitReturnPoolReusable(t, f.ctx, f.pool, f.observer.PgConn().PID())
	if f.pool.Stat().AcquiredConns() != 0 || !reflect.DeepEqual(after, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("near-capacity probes/cleanup/reuse changed durable state or retained a slot")
	}
}
