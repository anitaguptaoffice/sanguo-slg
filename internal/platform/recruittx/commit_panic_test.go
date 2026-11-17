package recruittx

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// Faults stay package-private in tests; Begin still accepts only a concrete pool.
type commitFaultTx struct {
	*fakeTx
	commitPanic, cleanupPanic any
	cleanupErr                error
	cancelCommit              context.CancelFunc
	boundedCleanup            bool
}

func (f *commitFaultTx) Commit(context.Context) error {
	f.commits.Add(1)
	if f.cancelCommit != nil {
		f.cancelCommit()
	}
	if f.commitPanic != nil {
		panic(f.commitPanic)
	}
	return f.commitErr
}

func (f *commitFaultTx) Rollback(ctx context.Context) error {
	f.rollbacks.Add(1)
	deadline, ok := ctx.Deadline()
	remaining := time.Until(deadline)
	f.boundedCleanup = ok && ctx.Err() == nil && remaining > 0 && remaining <= 5*time.Second
	if f.cleanupPanic != nil {
		panic(f.cleanupPanic)
	}
	return f.cleanupErr
}

func captureCommit(o *Owner, ctx context.Context) (err error, fault any) {
	defer func() { fault = recover() }()
	err = o.Commit(ctx)
	return
}

func TestOwnerCommitPanicIdentity(t *testing.T) {
	original := errors.New("original commit panic")
	secondary := errors.New("cleanup panic")
	commitErr := errors.New("commit acknowledgement lost")
	cleanupErr := errors.New("cleanup failed")
	for _, tc := range []struct {
		name                      string
		commitPanic, cleanupPanic any
		commitErr, cleanupErr     error
		wantPanic                 any
		wantCleanup               int32
	}{
		{name: "panic_cleanup_ok", commitPanic: original, wantPanic: original, wantCleanup: 1},
		{name: "panic_cleanup_error", commitPanic: original, cleanupErr: cleanupErr, wantPanic: original, wantCleanup: 1},
		{name: "panic_cleanup_closed", commitPanic: original, cleanupErr: pgx.ErrTxClosed, wantPanic: original, wantCleanup: 1},
		{name: "panic_cleanup_panic", commitPanic: original, cleanupPanic: secondary, wantPanic: original, wantCleanup: 1},
		{name: "error_cleanup_ok", commitErr: commitErr, wantCleanup: 1},
		{name: "error_cleanup_error", commitErr: commitErr, cleanupErr: cleanupErr, wantCleanup: 1},
		{name: "error_cleanup_closed", commitErr: commitErr, cleanupErr: pgx.ErrTxClosed, wantCleanup: 1},
		{name: "cleanup_only_panic", commitErr: commitErr, cleanupPanic: secondary, wantPanic: secondary, wantCleanup: 1},
		{name: "success_no_cleanup", cleanupPanic: secondary},
	} {
		t.Run(tc.name, func(t *testing.T) {
			base := &fakeTx{commitErr: tc.commitErr}
			o, ctx := owned(t, base)
			f := &commitFaultTx{fakeTx: base, commitPanic: tc.commitPanic, cleanupPanic: tc.cleanupPanic, cleanupErr: tc.cleanupErr}
			if tc.wantCleanup != 0 {
				f.cancelCommit = o.s.cancel
			}
			o.s.tx = f
			alias, access := *o, *o.Access()
			err, fault := captureCommit(o, ctx)
			if fault != tc.wantPanic {
				t.Errorf("panic identity: got %v (%p), want %v (%p)", fault, fault, tc.wantPanic, tc.wantPanic)
			}
			if tc.wantPanic == nil {
				if tc.commitErr == nil {
					check(t, err == nil, "successful Commit returned error")
				} else {
					check(t, errors.Is(err, ErrOutcomeUnknown) && errors.Is(err, tc.commitErr), "Commit error lost UNKNOWN or cause")
					if tc.cleanupErr != nil && !errors.Is(tc.cleanupErr, pgx.ErrTxClosed) {
						check(t, errors.Is(err, tc.cleanupErr), "cleanup error not joined")
					}
					check(t, !errors.Is(err, pgx.ErrTxClosed), "closed cleanup changed outcome")
				}
			}
			check(t, f.commits.Load() == 1 && f.rollbacks.Load() == tc.wantCleanup, "Commit/cleanup count")
			check(t, tc.wantCleanup == 0 || f.boundedCleanup, "cleanup reused canceled or unbounded context")
			check(t, o.s.ended && o.s.ctx.Err() != nil && len(o.s.gate) == 1, "terminal state, cancel or gate not released")
			fresh, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			_, err = access.Exec(fresh, o.s.binding, "must not execute")
			check(t, errors.Is(err, ErrInactive) || errors.Is(err, context.Canceled), "copied access not terminal")
			err = alias.Commit(fresh)
			check(t, errors.Is(err, ErrInactive) || errors.Is(err, context.Canceled), "copied owner retried Commit")
			check(t, errors.Is(alias.Rollback(fresh), ErrInactive), "copied owner retried Rollback")
			check(t, f.commits.Load() == 1 && f.rollbacks.Load() == tc.wantCleanup && f.executions.Load() == 0, "post-end work executed")
		})
	}
}
