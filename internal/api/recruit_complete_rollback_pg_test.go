package api

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type recruitCompletionRollbackTrace struct {
	*recruitPromotionTrace
	inject       func(context.Context, *pgx.Conn) error
	injected     bool
	injectionErr error
}

func (r *recruitCompletionRollbackTrace) TraceQueryStart(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	ctx = r.recruitPromotionTrace.TraceQueryStart(ctx, c, d)
	if d.SQL == r.promotion && r.inject != nil {
		hook := r.inject
		r.inject = nil // Nested diagnostic/fixture SQL must not inject recursively.
		r.injected = true
		r.injectionErr = hook(ctx, c)
	}
	return ctx
}

// Advance only this fixture's two actual paid jobs and their matching receipts.
// Both stored schedules move together; production clock and durations stay real.
func advanceRecruitCompletionPair(t *testing.T, f *recruitCompleteReturnPG) {
	t.Helper()
	immutable := func() string {
		var value string
		returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(q)-'start_at'-'finish_at' ORDER BY queue_id) FROM work_queue q),
 (SELECT jsonb_agg(to_jsonb(r)-'accepted_at'-'initial_start_at'-'initial_finish_at' ORDER BY queue_id) FROM mil_recruit_receipt r))::text`).Scan(&value))
		return value
	}
	before := immutable()
	tx, err := f.observer.Begin(f.ctx)
	returnPGOK(t, err)
	defer func() { _ = tx.Rollback(f.ctx) }()
	for _, query := range []string{
		`UPDATE work_queue SET start_at=start_at-interval '1 hour',finish_at=finish_at-interval '1 hour'
 WHERE server_id=1 AND player_id=1 AND city_id=1 AND queue_type=3 AND ((queue_id=100 AND status=1) OR (queue_id=101 AND status=0))`,
		`UPDATE mil_recruit_receipt SET accepted_at=accepted_at-interval '1 hour',initial_start_at=initial_start_at-interval '1 hour',initial_finish_at=initial_finish_at-interval '1 hour'
 WHERE server_id=1 AND city_id=1 AND queue_id IN(100,101)
 AND EXISTS(SELECT FROM mil_recruit_origin o WHERE o.server_id=mil_recruit_receipt.server_id AND o.queue_id=mil_recruit_receipt.queue_id AND o.player_id=1)`,
	} {
		tag, err := tx.Exec(f.ctx, query)
		returnPGOK(t, err)
		if tag.RowsAffected() != 2 {
			t.Fatal("controlled time fixture did not update exactly its two paid rows", tag)
		}
	}
	returnPGOK(t, tx.Commit(f.ctx))
	if before != immutable() {
		t.Fatal("time fixture changed non-time fields")
	}
	var valid bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT count(*)=2 AND bool_and(
 q.start_at=r.initial_start_at AND q.finish_at=r.initial_finish_at AND r.accepted_at<=q.start_at
 AND q.finish_at=q.start_at+r.duration_sec*interval '1 second' AND q.finish_at<clock_timestamp())
 FROM work_queue q JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id IN(100,101)`).Scan(&valid))
	if !valid {
		t.Fatal("advanced paid schedules do not preserve exact duration/receipt identity")
	}
}

func TestPGRecruitCompletionPromotionRollback(t *testing.T) {
	for _, fail := range []bool{false, true} {
		name := "successful_control"
		if fail {
			name = "promotion_sql_failure"
		}
		t.Run(name, func(t *testing.T) {
			var trace *recruitCompletionRollbackTrace
			f := newRecruitCompleteReturnPG(t, func(base *recruitPromotionTrace) pgx.QueryTracer {
				trace = &recruitCompletionRollbackTrace{recruitPromotionTrace: base}
				return trace
			})
			_, candidate := f.paid(t, 0)
			f.paid(t, 1)
			paid := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
			early := f.recruit.complete(f.ctx, candidate)
			recruitAttemptPGConfirmed(t, early)
			if early.completion != march.RecruitEarly || early.confirmed != (march.RecruitAcceptance{}) || !reflect.DeepEqual(paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
				t.Fatal("pre-advance completion was not a real no-effect early result", early)
			}
			recruitLifetimeState(t, f.recruit, 0, false, true)
			advanceRecruitCompletionPair(t, f)
			before := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
			var original int64
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1").Scan(&original))
			if fail {
				trace.inject = func(ctx context.Context, c *pgx.Conn) error {
					var credited int64
					var statuses []int16
					if err := c.QueryRow(ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1").Scan(&credited); err != nil {
						return err
					}
					if err := c.QueryRow(ctx, "SELECT array_agg(status ORDER BY queue_id) FROM work_queue WHERE queue_id IN(100,101)").Scan(&statuses); err != nil {
						return err
					}
					if credited != original+2 || !reflect.DeepEqual(statuses, []int16{2, 0}) {
						return fmt.Errorf("missing provisional credit/done: %d %v", credited, statuses)
					}
					if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
						return errors.New("observer saw uncommitted completion")
					}
					// Arm a transaction-local failure only after source pins and provisional
					// credit/done. The real production promotion UPDATE must fire this trigger.
					_, err := c.Exec(ctx, `CREATE FUNCTION pg_temp.reject_completion_promotion() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='owned completion promotion failure'; END $$;
 CREATE TRIGGER reject_completion_promotion BEFORE UPDATE ON work_queue FOR EACH ROW
 WHEN (OLD.queue_id=101 AND OLD.status=0 AND NEW.status=1)
 EXECUTE FUNCTION pg_temp.reject_completion_promotion()`)
					return err
				}
			}
			start := len(trace.events())
			result := f.recruit.complete(f.ctx, candidate)
			returnPGOK(t, trace.injectionErr)
			if !fail {
				recruitAttemptPGConfirmed(t, result)
				if result.completion != march.RecruitCompleted || result.confirmed != (march.RecruitAcceptance{}) {
					t.Fatal("accelerated control did not complete", result)
				}
				var ready int64
				var states []int16
				returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1").Scan(&ready))
				returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(status ORDER BY queue_id) FROM work_queue WHERE queue_id IN(100,101)").Scan(&states))
				if ready != original+2 || !reflect.DeepEqual(states, []int16{2, 1}) {
					t.Fatal("successful control missing durable credit/promotion", ready, states)
				}
				return
			}
			var pgerr *pgconn.PgError
			if !trace.injected || result.outcome != recruitKnownEnded || result.completion != 0 || result.confirmed != (march.RecruitAcceptance{}) || result.cleanup != nil || result.diagnostic != nil ||
				!errors.Is(result.cause, march.ErrRecruitUnavailable) || errors.Is(result.cause, recruittx.ErrOutcomeUnknown) || !errors.As(result.cause, &pgerr) || pgerr.Code != "23514" || pgerr.Message != "owned completion promotion failure" {
				t.Fatal("actual promotion failure did not end cleanly without an effect", result)
			}
			witnessed, rolledBack := false, false
			for _, event := range trace.events()[start:] {
				if event.sql == trace.promotion && event.err != nil {
					var e *pgconn.PgError
					witnessed = errors.As(event.err, &e) && e.Code == "23514"
				}
				if event.sql == "rollback" && event.err == nil {
					rolledBack = true
				}
				if event.sql == "commit" {
					t.Fatal("failed promotion reached commit")
				}
			}
			if !witnessed || !rolledBack || !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
				t.Fatal("missing actual promotion rollback or durable state changed")
			}
			f.recruit.s.mu.Lock()
			count := len(f.recruit.s.attempts)
			var retained recruitAttempt
			for a := range f.recruit.s.attempts {
				retained = *a
			}
			f.recruit.s.mu.Unlock()
			if count != 1 || !retained.isCompletion || retained.candidate != candidate || retained.accountID != 1 || retained.queueID != candidate.QueueID || retained.phase != "military complete" || retained.result != result || retained.fault != nil || retained.cleanupFault != nil {
				t.Fatal("completion diagnostic identity lost", retained)
			}
			recruitLifetimeState(t, f.recruit, 0, true, false)
			returnPGOK(t, f.recruit.s.admission.waitDrained(f.ctx))
			queries := len(trace.events())
			alias := *f.recruit
			again := alias.complete(f.ctx, candidate)
			if again.outcome != recruitNotStarted || again.cause != errRecruitGeneration || len(trace.events()) != queries {
				t.Fatal("closed completion generation opened another transaction")
			}
			recruitReturnPoolReusable(t, f.ctx, f.pool, f.observer.PgConn().PID())
		})
	}
}
