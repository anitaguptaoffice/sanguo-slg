package world

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func rejectReturnOrigin(t *testing.T, l *RecruitCityLocker, ctx context.Context, a *recruittx.Access, player, city int64, want error) {
	t.Helper()
	got, err := l.LockReturnOrigin(ctx, a, player, city)
	if got != (ReturnOrigin{}) || err == nil || (want != nil && !errors.Is(err, want)) {
		t.Fatalf("origin=%+v error=%v want zero/%v", got, err, want)
	}
}

func TestReturnOriginInvalidHandles(t *testing.T) {
	ctx, a := context.Background(), &recruittx.Access{}
	l := &RecruitCityLocker{source: &FreshCityParticipant{binding: &recruittx.Binding{}, sequence: &citySequence{}, profile: freshsource.Profile{ServerID: 1}}}
	for _, invalid := range []*RecruitCityLocker{nil, {}, {source: &FreshCityParticipant{}}} {
		rejectReturnOrigin(t, invalid, ctx, a, 7, 10, ErrRecruitCity)
	}
	for _, ids := range [][2]int64{{0, 10}, {-1, 10}, {7, 0}, {7, -1}} {
		rejectReturnOrigin(t, l, ctx, a, ids[0], ids[1], ErrRecruitCity)
	}
	rejectReturnOrigin(t, l, nil, a, 7, 10, ErrRecruitCity)
	rejectReturnOrigin(t, l, ctx, nil, 7, 10, ErrRecruitCity)
	rejectReturnOrigin(t, l, ctx, a, 7, 10, recruittx.ErrBinding)
	l.source.profile.ServerID = 0
	rejectReturnOrigin(t, l, ctx, a, 7, 10, ErrRecruitCity)
	l.source.profile.ServerID = -1
	rejectReturnOrigin(t, l, ctx, a, 7, 10, ErrRecruitCity)
	l.source.profile.ServerID = 1
	copyLocker := *l
	l.source.sequence.retired.Store(true)
	rejectReturnOrigin(t, &copyLocker, ctx, a, 7, 10, ErrRecruitCity)
}
