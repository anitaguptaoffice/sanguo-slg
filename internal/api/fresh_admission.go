package api

import (
	"context"
	"errors"
	"sync"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

var errFreshAdmission = errors.New("fresh source admission unavailable")

// freshAdmission is a handle to one generation, not a source validation or
// server-termination certificate. Copies share all state. It is deliberately
// private and has no reopen, rebind or unknown-resolution operation.
type freshAdmission struct{ s *freshAdmissionState }

type freshAdmissionState struct {
	mu      sync.Mutex
	binding *recruittx.Binding
	closed  bool
	pending uint64
	drained chan struct{}
}

// freshLease copies share a one-shot completion state and the exact generation.
type freshLease struct{ s *freshLeaseState }

type freshLeaseState struct {
	generation *freshAdmissionState
	finished   bool // guarded by generation.mu
}

func newFreshAdmission(binding *recruittx.Binding) (*freshAdmission, error) {
	if binding == nil || *binding == (recruittx.Binding{}) {
		return nil, errFreshAdmission
	}
	return &freshAdmission{s: &freshAdmissionState{binding: binding, drained: make(chan struct{})}}, nil
}

// acquire linearizes with close and unknown under the same lock. A context
// canceled before the lock is obtained is rejected; cancellation after admission
// does not resolve the lease or establish a server transaction outcome.
func (a *freshAdmission) acquire(ctx context.Context) (freshLease, error) {
	if a == nil || a.s == nil || ctx == nil {
		return freshLease{}, errFreshAdmission
	}
	s := a.s
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return freshLease{}, err
	}
	if s.closed || s.pending == ^uint64(0) {
		return freshLease{}, errFreshAdmission
	}
	s.pending++
	return freshLease{s: &freshLeaseState{generation: s}}, nil
}

// close stops admission immediately; it does not wait for work or imply drain.
func (a *freshAdmission) close() error {
	if a == nil || a.s == nil {
		return errFreshAdmission
	}
	s := a.s
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.closed {
		s.closed = true
		if s.pending == 0 {
			close(s.drained)
		}
	}
	return nil
}

// waitDrained succeeds only after close and every admitted item was classified
// known ended. Cancellation never mutates the generation. An unknown item keeps
// this wait unresolved permanently, including after all other items finish.
func (a *freshAdmission) waitDrained(ctx context.Context) error {
	if a == nil || a.s == nil || ctx == nil {
		return errFreshAdmission
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	select {
	case <-a.s.drained:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// ended is bookkeeping only. The future fixed coordinator must call it only
// after confirmed commit/rollback or failure before actual Begin, and after
// bounded cleanup. It cannot itself prove server termination.
func (l freshLease) ended() error { return l.finish(false) }

// unknown irreversibly closes admission and retains the unresolved item. The
// caller must choose this for every uncertain transaction ending.
func (l freshLease) unknown() error { return l.finish(true) }

func (l freshLease) finish(unknown bool) error {
	if l.s == nil || l.s.generation == nil {
		return errFreshAdmission
	}
	g := l.s.generation
	g.mu.Lock()
	defer g.mu.Unlock()
	if l.s.finished {
		return errFreshAdmission
	}
	l.s.finished = true
	if unknown {
		g.closed = true
		return nil // deliberately retain this unresolved work
	}
	g.pending--
	if g.closed && g.pending == 0 {
		close(g.drained)
	}
	return nil
}
