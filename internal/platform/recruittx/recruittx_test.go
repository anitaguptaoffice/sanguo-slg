package recruittx

import (
	"context"
	"errors"
	"reflect"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type rowFunc func(...any) error

func (f rowFunc) Scan(d ...any) error { return f(d...) }

type fakeTx struct {
	pgx.Tx
	commits, rollbacks, executions atomic.Int32
	commitErr                      error
	panicCommit                    bool
	row                            func(context.Context) pgx.Row
}

func (f *fakeTx) Exec(ctx context.Context, _ string, _ ...any) (pgconn.CommandTag, error) {
	f.executions.Add(1)
	return pgconn.NewCommandTag("INSERT 0 1"), ctx.Err()
}
func (f *fakeTx) QueryRow(ctx context.Context, _ string, _ ...any) pgx.Row { return f.row(ctx) }
func (f *fakeTx) Commit(context.Context) error {
	f.commits.Add(1)
	if f.panicCommit {
		panic("commit fault")
	}
	return f.commitErr
}
func (f *fakeTx) Rollback(ctx context.Context) error { f.rollbacks.Add(1); return ctx.Err() }
func owned(t *testing.T, f *fakeTx) (*Owner, context.Context) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	t.Cleanup(cancel)
	s := &state{binding: &Binding{pool: &pgxpool.Pool{}}, tx: f, ctx: ctx, cancel: cancel, gate: make(chan struct{}, 1)}
	s.gate <- struct{}{}
	return &Owner{s: s}, ctx
}
func rollback(o *Owner) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	return o.Rollback(ctx)
}
func check(t *testing.T, ok bool, message string) {
	t.Helper()
	if !ok {
		t.Fatal(message)
	}
}

func TestBindingAndEndedAccess(t *testing.T) {
	_, err := NewBinding(nil)
	check(t, errors.Is(err, ErrBinding) && (*Owner)(nil).Access() == nil, "nil pool/owner")
	b, _ := NewBinding(&pgxpool.Pool{})
	_, err = b.Begin(context.Background())
	check(t, errors.Is(err, ErrDeadline), "unbounded Begin")
	f := &fakeTx{}
	o, ctx := owned(t, f)
	_, err = (&Binding{}).Begin(ctx)
	check(t, errors.Is(err, ErrBinding), "zero binding")
	a := o.Access()
	copied := *a
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	_, err = b.Begin(canceled)
	check(t, errors.Is(err, context.Canceled), "canceled Begin")
	for _, wrong := range []*Binding{nil, {}, {pool: o.s.binding.pool}, b} {
		_, err = a.Exec(ctx, wrong, "test")
		check(t, errors.Is(err, ErrBinding), "binding substitution")
	}
	for _, invalid := range []*Access{nil, {}} {
		_, err = invalid.Exec(ctx, b, "test")
		check(t, err != nil, "invalid access")
	}
	_, err = a.Exec(ctx, o.s.binding, "test")
	check(t, err == nil, "live access")
	check(t, o.Commit(ctx) == nil, "commit")
	for _, old := range []*Access{a, &copied} {
		_, err = old.Exec(ctx, o.s.binding, "test")
		check(t, err != nil, "ended access")
	}
	check(t, o.Commit(ctx) != nil && o.Rollback(ctx) != nil, "repeated end")
	check(t, f.commits.Load() == 1 && f.executions.Load() == 1, "replayed SQL")
	check(t, reflect.TypeOf(a).NumMethod() == 3, "access exposes extra methods")
}

func TestCommitFailureAndPanicCleanup(t *testing.T) {
	for _, panics := range []bool{false, true} {
		f := &fakeTx{commitErr: errors.New("transport uncertainty"), panicCommit: panics}
		o, ctx := owned(t, f)
		var err error
		var recovered any
		func() { defer func() { recovered = recover() }(); err = o.Commit(ctx) }()
		check(t, (panics && recovered != nil) || (!panics && errors.Is(err, ErrOutcomeUnknown)), "outcome lost")
		check(t, f.commits.Load() == 1 && f.rollbacks.Load() == 1, "cleanup or retry")
		check(t, o.Commit(ctx) != nil, "repeated uncertain commit")
	}
	f := &fakeTx{}
	o, ctx := owned(t, f)
	o.s.cancel()
	check(t, o.Rollback(ctx) != nil && f.rollbacks.Load() == 0, "canceled end sent SQL")
	check(t, rollback(o) == nil && f.rollbacks.Load() == 1, "independent cleanup")
}

func TestScanGateAndOriginalContext(t *testing.T) {
	f := &fakeTx{}
	o, ctx := owned(t, f)
	entered, release, done := make(chan struct{}), make(chan struct{}), make(chan error, 1)
	f.row = func(c context.Context) pgx.Row {
		return rowFunc(func(...any) error {
			close(entered)
			select {
			case <-release:
				return nil
			case <-c.Done():
				return c.Err()
			}
		})
	}
	go func() { done <- o.Access().Scan(context.Background(), o.s.binding, "test", nil) }()
	<-entered
	short, cancel := context.WithTimeout(ctx, 10*time.Millisecond)
	defer cancel()
	check(t, errors.Is(o.Commit(short), context.DeadlineExceeded) && f.commits.Load() == 0, "commit raced Scan")
	rollbackWait, stopWait := context.WithTimeout(ctx, 10*time.Millisecond)
	defer stopWait()
	check(t, errors.Is(o.Rollback(rollbackWait), context.DeadlineExceeded) && f.rollbacks.Load() == 0, "rollback raced Scan")
	close(release)
	check(t, <-done == nil && o.Commit(ctx) == nil, "gate did not release")
	f = &fakeTx{}
	o, _ = owned(t, f)
	deadline, stop := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer stop()
	o.s.ctx = deadline
	f.row = func(c context.Context) pgx.Row { return rowFunc(func(...any) error { <-c.Done(); return c.Err() }) }
	check(t, o.Access().Scan(context.Background(), o.s.binding, "test", nil) != nil, "original deadline ignored")
	check(t, rollback(o) == nil, "deadline cleanup")
}
