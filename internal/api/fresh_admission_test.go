package api

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func admissionForTest(t *testing.T) *freshAdmission {
	t.Helper()
	// A real startup binding requires a pool; this test exercises identity and
	// synchronization only, not validity, SQL, or server termination.
	binding, err := recruittx.NewBinding(&pgxpool.Pool{})
	if err != nil {
		t.Fatal(err)
	}
	a, err := newFreshAdmission(binding)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func TestFreshAdmissionCloseAndCopies(t *testing.T) {
	a := admissionForTest(t)
	alias := *a
	first, err := a.acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	second, err := alias.acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if first.s.generation != second.s.generation || first.s.generation.binding != a.s.binding {
		t.Fatal("generation/binding not captured")
	}
	other := admissionForTest(t)
	if other.s == a.s {
		t.Fatal("generations aliased")
	}
	if err := alias.close(); err != nil {
		t.Fatal(err)
	}
	if _, err := a.acquire(context.Background()); err == nil {
		t.Fatal("acquired after close")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	if !errors.Is(a.waitDrained(ctx), context.DeadlineExceeded) {
		t.Fatal("close falsely drained active work")
	}
	copyFirst := first
	if err := first.ended(); err != nil {
		t.Fatal(err)
	}
	if err := copyFirst.ended(); err == nil {
		t.Fatal("copy finished twice")
	}
	if err := copyFirst.unknown(); err == nil {
		t.Fatal("copy changed outcome")
	}
	if err := second.ended(); err != nil {
		t.Fatal(err)
	}
	if err := a.waitDrained(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := a.close(); err != nil {
		t.Fatal(err)
	}
}

func TestFreshAdmissionUnknownNeverDrains(t *testing.T) {
	a := admissionForTest(t)
	unknown, _ := a.acquire(context.Background())
	known, _ := a.acquire(context.Background())
	if err := unknown.unknown(); err != nil {
		t.Fatal(err)
	}
	if _, err := a.acquire(context.Background()); err == nil {
		t.Fatal("unknown did not close admission")
	}
	if err := known.ended(); err != nil {
		t.Fatal(err)
	}
	if err := unknown.ended(); err == nil {
		t.Fatal("unknown was cleared")
	}
	if err := a.close(); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	if !errors.Is(a.waitDrained(ctx), context.DeadlineExceeded) {
		t.Fatal("unknown falsely drained")
	}
}

func TestFreshAdmissionCloseAcquireRace(t *testing.T) {
	for i := 0; i < 200; i++ {
		a := admissionForTest(t)
		start := make(chan struct{})
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			<-start
			if l, err := a.acquire(context.Background()); err == nil {
				if err := l.ended(); err != nil {
					t.Error(err)
				}
			}
		}()
		go func() {
			defer wg.Done()
			<-start
			if err := a.close(); err != nil {
				t.Error(err)
			}
		}()
		close(start)
		wg.Wait()
		if err := a.waitDrained(context.Background()); err != nil {
			t.Fatal(err)
		}
		if _, err := a.acquire(context.Background()); err == nil {
			t.Fatal("admission reopened")
		}
	}
}

func TestFreshAdmissionConcurrentOneShot(t *testing.T) {
	a := admissionForTest(t)
	l, _ := a.acquire(context.Background())
	_ = a.close()
	var wg sync.WaitGroup
	results := make(chan error, 32)
	for i := 0; i < cap(results); i++ {
		wg.Add(1)
		go func(copy freshLease) { defer wg.Done(); results <- copy.ended() }(l)
	}
	wg.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		}
	}
	if success != 1 {
		t.Fatalf("completion successes: %d", success)
	}
	if err := a.waitDrained(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestFreshAdmissionInvalidAndCancellation(t *testing.T) {
	if _, err := newFreshAdmission(&recruittx.Binding{}); err == nil {
		t.Fatal("zero binding")
	}
	if _, err := newFreshAdmission(nil); err == nil {
		t.Fatal("nil binding")
	}
	for _, a := range []*freshAdmission{nil, {}} {
		if _, err := a.acquire(context.Background()); err == nil {
			t.Fatal("invalid admission")
		}
		if err := a.close(); err == nil {
			t.Fatal("invalid close")
		}
		if err := a.waitDrained(context.Background()); err == nil {
			t.Fatal("invalid wait")
		}
	}
	var l freshLease
	if l.ended() == nil || l.unknown() == nil {
		t.Fatal("zero lease")
	}
	a := admissionForTest(t)
	//nolint:staticcheck // Exercise invalid input.
	if _, err := a.acquire(nil); err == nil {
		t.Fatal("nil context")
	}
	//nolint:staticcheck // Exercise invalid input.
	if err := a.waitDrained(nil); err == nil {
		t.Fatal("nil wait context")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := a.acquire(ctx); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if err := a.waitDrained(ctx); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if err := a.close(); err != nil {
		t.Fatal(err)
	}
	if err := a.waitDrained(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestFreshAdmissionCancelWaitLeavesLeasePending(t *testing.T) {
	a := admissionForTest(t)
	lease, err := a.acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := a.close(); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- a.waitDrained(ctx) }()
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	timeout, stop := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer stop()
	if err := a.waitDrained(timeout); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal("cancellation resolved work", err)
	}
	if err := lease.ended(); err != nil {
		t.Fatal(err)
	}
	if err := a.waitDrained(context.Background()); err != nil {
		t.Fatal(err)
	}
}
