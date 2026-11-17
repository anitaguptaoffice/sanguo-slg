package api

import (
	"context"
	"errors"
	"sync"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

var errMilitaryGeneration = errors.New("military source group unavailable")

// This private pair is local validation, not enrollment or the complete future
// FreshCity source. Copies of the group and children retain one closed lifetime.
type militaryGeneration struct{ s *militaryGenerationState }
type militarySourcePair struct {
	recruit *recruitGeneration
	returns *returnGeneration
}
type militaryGenerationState struct {
	mu                sync.Mutex
	attempted, closed bool
	children          militarySourcePair
	admission         *freshAdmission
	pair              *militarySourcePair
}

func newMilitaryGeneration(binding *recruittx.Binding, expected freshsource.Profile, catalog *march.RecruitCatalog) (*militaryGeneration, error) {
	returns, err := newReturnGeneration(binding, expected, catalog)
	if err != nil {
		return nil, errors.Join(errMilitaryGeneration, err)
	}
	var names []string
	for _, inventory := range recruitSourceInventories() {
		names = append(names, inventory...)
	}
	recruit, err := newRecruitGeneration(returns.s.binding,
		recruitSourceProjection(returns.s.profile, names), &returns.s.catalog)
	if err != nil {
		_ = returns.close()
		return nil, errors.Join(errMilitaryGeneration, err)
	}
	// Both children are uninitialized and private. Wire pointer identity as well
	// as admission before publication: recruittx validates the Binding address.
	recruit.s.binding, recruit.s.admission = returns.s.binding, returns.s.admission
	return &militaryGeneration{s: &militaryGenerationState{
		children: militarySourcePair{recruit: recruit, returns: returns}, admission: returns.s.admission,
	}}, nil
}

func (g *militaryGeneration) close() error {
	if g == nil || g.s == nil {
		return errMilitaryGeneration
	}
	s := g.s
	s.mu.Lock()
	s.closed, s.pair = true, nil
	// Stop common admission before either child is invalidated. No SQL or drain
	// wait runs under this mutex; unknown leases remain permanently pending.
	err := s.admission.close()
	s.mu.Unlock()
	return errors.Join(err, s.children.recruit.close(), s.children.returns.close())
}

func (g *militaryGeneration) waitDrained(ctx context.Context) error {
	if g == nil || g.s == nil {
		return errMilitaryGeneration
	}
	return g.s.admission.waitDrained(ctx)
}

// initialize is one-shot, including invalid contexts and failure of either
// child. Only both real initializers' confirmed rollbacks publish a pair.
func (g *militaryGeneration) initialize(ctx context.Context) (pair *militarySourcePair, err error) {
	if g == nil || g.s == nil {
		return nil, errMilitaryGeneration
	}
	s := g.s
	s.mu.Lock()
	if s.attempted || s.closed {
		s.mu.Unlock()
		return nil, errMilitaryGeneration
	}
	s.attempted = true
	s.mu.Unlock()
	defer func() {
		fault := recover()
		if err != nil || fault != nil {
			_ = g.close()
			pair = nil
		}
		if fault != nil {
			panic(fault)
		}
	}()
	if err = s.children.recruit.initialize(ctx); err != nil {
		return nil, err
	}
	if err = s.children.returns.initialize(ctx); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, errMilitaryGeneration
	}
	s.pair = &militarySourcePair{recruit: s.children.recruit, returns: s.children.returns}
	return s.pair, nil
}
