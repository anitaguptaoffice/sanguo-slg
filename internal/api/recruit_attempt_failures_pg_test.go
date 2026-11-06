package api

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestPGRecruitAttemptBusinessFailures(t *testing.T) {
	for _, funds := range []bool{false, true} {
		name := "unsupported_version"
		if funds {
			name = "insufficient_funds"
		}
		t.Run(name, func(t *testing.T) {
			f := newRecruitFailurePG(t)
			want := march.ErrRecruitUnsupportedVersion
			if funds {
				want = domestic.ErrRecruitWalletFunds
				returnPGExec(t, f.ctx, f.observer, "UPDATE player_wallet SET food=11")
			} else {
				f.intent.Version = 65537 // Never narrowed to the supported smallint 1.
			}
			before := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			r := f.g.admit(f.ctx, 1, f.scope, f.intent)
			if r.cause != want || r.outcome != recruitKnownEnded || r.cleanup != nil ||
				r.diagnostic != nil || r.confirmed != (march.RecruitAcceptance{}) {
				t.Fatal("business rejection lost its exact clean sentinel", r)
			}
			f.recorded(t, "", nil, funds)
			f.unchanged(t, before, funds)
			recruitPGReleased(t, f.ctx, f.observer, f.profile)
			recruitLifetimeState(t, f.g, 0, false, true)
			f.g.s.mu.Lock()
			count := len(f.g.s.attempts)
			f.g.s.mu.Unlock()
			if count != 0 {
				t.Fatal("business failure retained a diagnostic attempt", count)
			}
			// A new deliberate command may use valid input; never mutate a key's intent.
			returnPGExec(t, f.ctx, f.observer, "UPDATE player_wallet SET food=100")
			retryScope, retryIntent := f.scope, f.intent
			retryScope.CommandID[0]++
			retryIntent.Version = 1
			alias := *f.g
			retry := alias.admit(f.ctx, 1, retryScope, retryIntent)
			recruitAttemptPGConfirmed(t, retry)
			queue := int64(100)
			if funds {
				queue++ // The rolled-back Prepare consumed queue 100 permanently.
			}
			if retry.confirmed.QueueID != queue {
				t.Fatal("same generation failed to admit or reused a rolled-back allocation", retry)
			}
			returnPGOK(t, alias.close())
			returnPGOK(t, alias.s.admission.waitDrained(f.ctx))
			recruitPGReleased(t, f.ctx, f.observer, f.profile)
		})
	}
}

func TestPGRecruitAttemptWriteSQLFailure(t *testing.T) {
	f := newRecruitFailurePG(t)
	before := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
	f.trace.stage = "job"
	f.trace.hook = func(ctx context.Context, conn *pgx.Conn) error {
		var wallet []int64
		if err := conn.QueryRow(ctx, "SELECT ARRAY[food,wood,iron,stone,gold] FROM player_wallet WHERE server_id=1 AND player_id=1").Scan(&wallet); err != nil {
			return err
		}
		if !reflect.DeepEqual(wallet, []int64{88, 182, 270, 358, 500}) {
			return errors.New("actual Write boundary did not follow the full provisional debit")
		}
		f.unchanged(t, before, true) // Other connection cannot see provisional debit.
		_, err := conn.Exec(ctx, `INSERT INTO work_queue(server_id,queue_id,player_id,city_id,queue_type,start_at,finish_at)
VALUES(1,100,1,1,1,'2026-01-01','2026-01-02')`)
		return err // Actual next Write INSERT, not this injection, must fail.
	}
	r := f.g.admit(f.ctx, 1, f.scope, f.intent)
	returnPGOK(t, f.trace.hookErr)
	var pgerr *pgconn.PgError
	if f.trace.hook != nil || r.outcome != recruitKnownEnded || !errors.Is(r.cause, march.ErrRecruitUnavailable) ||
		errors.Is(r.cause, recruittx.ErrOutcomeUnknown) || !errors.As(r.cause, &pgerr) || pgerr.Code != "23505" ||
		pgerr.SchemaName != f.profile.SchemaName || pgerr.TableName != "work_queue" || pgerr.ConstraintName != "work_queue_pkey" {
		t.Fatal("actual Write unique violation was not witnessed", r)
	}
	f.recorded(t, "job", pgerr, true)
	f.unchanged(t, before, true)
	f.closed(t, r, "write", 0, false)
}

func TestPGRecruitAttemptDeferredCommitFailure(t *testing.T) {
	f := newRecruitFailurePG(t)
	returnPGExec(t, f.ctx, f.observer, `CREATE TABLE recruit_failure_deferred (id integer,
CONSTRAINT recruit_failure_unique UNIQUE(id) DEFERRABLE INITIALLY DEFERRED)`)
	before := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
	f.trace.stage = "commit"
	f.trace.hook = func(ctx context.Context, conn *pgx.Conn) error {
		// This is still provisional. Reuse the independent, complete paid-field oracle.
		_ = recruitAttemptPGObserved(t, ctx, conn)
		f.unchanged(t, before, true)
		_, err := conn.Exec(ctx, "INSERT INTO recruit_failure_deferred VALUES(1),(1)")
		return err
	}
	r := f.g.admit(f.ctx, 1, f.scope, f.intent)
	returnPGOK(t, f.trace.hookErr)
	var pgerr *pgconn.PgError
	if f.trace.hook != nil || r.outcome != recruitUnknown || !errors.Is(r.cause, recruittx.ErrOutcomeUnknown) ||
		!errors.As(r.cause, &pgerr) || pgerr.Code != "23505" || pgerr.SchemaName != f.profile.SchemaName ||
		pgerr.TableName != "recruit_failure_deferred" || pgerr.ConstraintName != "recruit_failure_unique" ||
		!errors.Is(r.cleanup, recruittx.ErrInactive) {
		t.Fatal("actual COMMIT rejection lost its caller-unknown classification", r)
	}
	f.recorded(t, "commit", pgerr, true)
	f.unchanged(t, before, true)
	// Independent server rollback knowledge cannot resolve or clear this caller lease.
	f.closed(t, r, "commit", 100, true)
}
