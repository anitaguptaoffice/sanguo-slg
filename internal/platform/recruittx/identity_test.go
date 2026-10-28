package recruittx

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestIdentityAliasesAndSubstitution(t *testing.T) {
	f := &fakeTx{}
	o, ctx := owned(t, f)
	a, b := o.Access(), o.s.binding
	snapshot := *a
	for _, alias := range []*Access{a, &snapshot, o.Access()} {
		check(t, snapshot.CheckSameTransaction(ctx, b, alias) == nil, "same state rejected")
	}
	for _, invalid := range []*Access{nil, {}} {
		check(t, invalid.CheckSameTransaction(ctx, b, a) != nil, "invalid receiver")
		check(t, a.CheckSameTransaction(ctx, b, invalid) != nil, "invalid counterpart")
	}
	for _, wrong := range []*Binding{nil, {}, {pool: b.pool}} {
		check(t, a.CheckSameTransaction(ctx, wrong, &snapshot) != nil, "wrong binding")
	}
	other, _ := owned(t, &fakeTx{})
	check(t, a.CheckSameTransaction(ctx, b, other.Access()) != nil, "foreign state")
	other.s.binding = b // another Begin on the same exact Binding
	check(t, a.CheckSameTransaction(ctx, b, other.Access()) != nil, "same binding is not same tx")
	*a = *other.Access() // same address, different opaque state
	check(t, snapshot.CheckSameTransaction(ctx, b, a) != nil, "overwrite rebound private snapshot")
	check(t, snapshot.CheckSameTransaction(ctx, b, o.Access()) == nil, "original state lost")
	check(t, f.executions.Load() == 0 && f.commits.Load() == 0 && f.rollbacks.Load() == 0, "check invoked SQL/lifecycle")
}

func TestIdentityLifetimeAndGate(t *testing.T) {
	f := &fakeTx{}
	o, ctx := owned(t, f)
	a, b := o.Access(), o.s.binding
	check(t, a.CheckSameTransaction(nil, b, a) != nil, "nil context") //nolint:staticcheck // Deliberately verify the API rejects nil context.
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	check(t, errors.Is(a.CheckSameTransaction(canceled, b, a), context.Canceled), "canceled call")
	<-o.s.gate
	short, stop := context.WithTimeout(ctx, 10*time.Millisecond)
	check(t, errors.Is(a.CheckSameTransaction(short, b, a), context.DeadlineExceeded), "gate wait ignored")
	stop()
	// End linearization happens before a waiting identity check is admitted.
	done := make(chan error, 1)
	go func() { done <- a.CheckSameTransaction(ctx, b, a) }()
	o.s.ended = true // protected by the held gate
	o.s.unlock()
	check(t, errors.Is(<-done, ErrInactive), "ended state admitted")
	check(t, f.executions.Load() == 0 && f.commits.Load() == 0 && f.rollbacks.Load() == 0, "check touched SQL")

	o, _ = owned(t, &fakeTx{})
	a, b = o.Access(), o.s.binding
	o.s.cancel()
	check(t, errors.Is(a.CheckSameTransaction(context.Background(), b, a), context.Canceled), "original context ignored")
}

func TestIdentityChecksRaceWithEnd(t *testing.T) {
	f := &fakeTx{}
	o, ctx := owned(t, f)
	a, b := o.Access(), o.s.binding
	var group sync.WaitGroup
	failures := make(chan error, 32)
	for i := 0; i < 32; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			copyAccess := *a
			err := copyAccess.CheckSameTransaction(ctx, b, a)
			if err != nil && !errors.Is(err, ErrInactive) && !errors.Is(err, context.Canceled) {
				failures <- err
			}
		}()
	}
	check(t, o.Commit(ctx) == nil, "commit")
	group.Wait()
	close(failures)
	for err := range failures {
		t.Error(err)
	}
	check(t, a.CheckSameTransaction(ctx, b, a) != nil, "post-end identity")
	check(t, f.executions.Load() == 0 && f.commits.Load() == 1 && f.rollbacks.Load() == 0, "unexpected effect")
}
