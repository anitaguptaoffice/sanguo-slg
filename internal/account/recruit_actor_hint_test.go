package account

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestRecruitActorHintInvalidHandles(t *testing.T) {
	ctx, a := context.Background(), &recruittx.Access{}
	retired := &recruitActorState{binding: &recruittx.Binding{}}
	retired.retired.Store(true)
	original := RecruitActorGuard{s: retired}
	copied := original
	for _, g := range []*RecruitActorGuard{nil, {}, {s: &recruitActorState{}}, &original, &copied} {
		if id, err := g.AccountHint(ctx, a, 10); id != 0 || err == nil {
			t.Fatal("invalid or retired guard returned a hint", id, err)
		}
	}
	g := &RecruitActorGuard{s: &recruitActorState{binding: &recruittx.Binding{}}}
	for _, tc := range []struct {
		ctx context.Context
		a   *recruittx.Access
		id  int64
	}{{nil, a, 10}, {ctx, nil, 10}, {ctx, a, 10}, {ctx, a, 0}, {ctx, a, -1}} {
		if id, err := g.AccountHint(tc.ctx, tc.a, tc.id); id != 0 || err == nil {
			t.Fatal("invalid access, context or player accepted", id, err)
		}
		if g.s.retired.Load() {
			t.Fatal("caller failure retired source")
		}
	}
}
