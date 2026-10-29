package march

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestRecruitDueInputValidation(t *testing.T) {
	p := &RecruitParticipant{source: &freshMilitarySource{binding: &recruittx.Binding{}, profile: freshsource.Profile{ServerID: 1}}, catalog: &RecruitCatalog{}}
	a, ctx := &recruittx.Access{}, context.Background()
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		p     *RecruitParticipant
		a     *recruittx.Access
		ctx   context.Context
		scope RecruitDueScope
		now   time.Time
		after RecruitDueCursor
		limit int
	}{
		{nil, a, ctx, RecruitDueScope{1}, now, RecruitDueCursor{}, 1},
		{p, nil, ctx, RecruitDueScope{1}, now, RecruitDueCursor{}, 1},
		{p, a, nil, RecruitDueScope{1}, now, RecruitDueCursor{}, 1},
		{p, a, ctx, RecruitDueScope{0}, now, RecruitDueCursor{}, 1},
		{p, a, ctx, RecruitDueScope{2}, now, RecruitDueCursor{}, 1},
		{p, a, ctx, RecruitDueScope{1}, now, RecruitDueCursor{}, 0},
		{p, a, ctx, RecruitDueScope{1}, now, RecruitDueCursor{}, MaxDueRecruits + 1},
		{p, a, ctx, RecruitDueScope{1}, time.Date(0, 1, 1, 0, 0, 0, 0, time.UTC), RecruitDueCursor{}, 1},
		{p, a, ctx, RecruitDueScope{1}, now, RecruitDueCursor{QueueID: -1}, 1},
		{p, a, ctx, RecruitDueScope{1}, now, RecruitDueCursor{QueueID: 9007199254740992}, 1},
		{p, a, ctx, RecruitDueScope{1}, now, RecruitDueCursor{FinishAt: now}, 1},
		{p, a, ctx, RecruitDueScope{1}, now, RecruitDueCursor{FinishAt: now.In(time.FixedZone("x", 3600)), QueueID: 40}, 1},
		{p, a, ctx, RecruitDueScope{1}, now, RecruitDueCursor{FinishAt: now.Add(500 * time.Microsecond), QueueID: 40}, 1},
	} {
		if got, err := tc.p.DueRecruits(tc.ctx, tc.a, tc.scope, tc.now, tc.after, tc.limit); got != nil || !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatalf("%+v = %+v, %v", tc, got, err)
		}
	}
	p.source.retired.Store(true)
	if _, err := p.DueRecruits(ctx, a, RecruitDueScope{1}, now, RecruitDueCursor{}, 1); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatalf("retired = %v", err)
	}
	p.source.retired.Store(false)

	due := []RecruitDueJob{{RecruitCandidate: RecruitCandidate{1, 1, 100, 40}, FinishAt: now}}
	for _, tc := range []struct {
		p   *RecruitParticipant
		a   *recruittx.Access
		due []RecruitDueJob
	}{
		{p, nil, due}, {nil, a, due}, {p, a, make([]RecruitDueJob, MaxDueRecruits+1)},
		{p, a, []RecruitDueJob{{RecruitCandidate{2, 1, 100, 40}, now}}},
		{p, a, []RecruitDueJob{{RecruitCandidate{1, 0, 100, 40}, now}}},
		{p, a, []RecruitDueJob{{RecruitCandidate{1, 1, 0, 40}, now}}},
		{p, a, []RecruitDueJob{{RecruitCandidate{1, 1, 100, 9007199254740992}, now}}},
		{p, a, []RecruitDueJob{{RecruitCandidate{1, 1, 100, 40}, now.In(time.FixedZone("x", 3600))}}},
		{p, a, []RecruitDueJob{{RecruitCandidate{1, 1, 100, 40}, now.Add(500 * time.Microsecond)}}},
		{p, a, []RecruitDueJob{{RecruitCandidate{1, 1, 100, 40}, now}, {RecruitCandidate{1, 1, 101, 41}, now}}},
		{p, a, []RecruitDueJob{{RecruitCandidate{1, 1, 100, 40}, now}, {RecruitCandidate{1, 2, 100, 41}, now}}},
	} {
		if got, err := tc.p.ApplyDueRecruits(ctx, tc.a, tc.due); got != nil || !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatalf("%+v = %+v, %v", tc, got, err)
		}
	}
	if got, err := p.ApplyDueRecruits(ctx, a, nil); err != nil || got == nil || len(got) != 0 {
		t.Fatalf("empty apply = %v, %v", got, err)
	}
}
