package account

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestFreshActorGuardInvalidInputs(t *testing.T) {
	ctx, p := context.Background(), guardProfile()
	for _, tc := range []struct {
		ctx context.Context
		b   *recruittx.Binding
		a   *recruittx.Access
		p   freshsource.Profile
	}{
		{nil, nil, nil, p}, {ctx, nil, nil, p},
		{ctx, &recruittx.Binding{}, nil, p}, {ctx, nil, &recruittx.Access{}, p},
		{ctx, &recruittx.Binding{}, &recruittx.Access{}, freshsource.Profile{}},
		{ctx, &recruittx.Binding{}, &recruittx.Access{}, p},
	} {
		if g, err := NewActorGuard(tc.ctx, tc.b, tc.a, tc.p); err == nil || g != nil {
			t.Fatal("invalid construction accepted")
		}
	}
	retired := &recruitActorState{binding: &recruittx.Binding{}}
	retired.retired.Store(true)
	g := ActorGuard{guard: &RecruitActorGuard{s: retired}}
	copyGuard := g
	for _, guard := range []*ActorGuard{nil, {}, &g, &copyGuard} {
		if guard.Pin(ctx, &recruittx.Access{}) == nil || guard.LockActor(ctx, &recruittx.Access{}, 1, 10) == nil {
			t.Fatal("nil, zero or retired guard accepted")
		}
	}
}
