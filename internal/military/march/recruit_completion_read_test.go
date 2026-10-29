package march

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestRecruitCompletionReadInvalidHandles(t *testing.T) {
	check := func(name string, err error) {
		t.Helper()
		if !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal(name, err)
		}
	}
	c := RecruitCandidate{1, 1, 100, 40}
	var nilParticipant *RecruitParticipant
	_, err := nilParticipant.CompletionHint(context.Background(), nil, c)
	check("nil hint", err)
	check("nil done", nilParticipant.DoneHistory(context.Background(), nil, c))
	p := &RecruitParticipant{source: &freshMilitarySource{binding: &recruittx.Binding{}, profile: freshsource.Profile{ServerID: 1}}, catalog: &RecruitCatalog{}}
	for _, bad := range []RecruitCandidate{{0, 1, 100, 40}, {2, 1, 100, 40}, {1, 0, 100, 40}, {1, 1, 0, 40}, {1, 1, 100, 0}, {1, 1, 100, 9007199254740992}} {
		_, err := p.CompletionHint(context.Background(), &recruittx.Access{}, bad)
		check("shape", err)
	}
	_, err = p.CompletionHint(context.Background(), nil, c)
	check("nil access", err)
	p.source.retired.Store(true)
	copied := *p
	for _, handle := range []*RecruitParticipant{p, &copied} {
		_, err := handle.CompletionHint(context.Background(), &recruittx.Access{}, c)
		check("retired hint", err)
		check("retired done", handle.DoneHistory(context.Background(), &recruittx.Access{}, c))
	}
	command := RecruitCommandID{1}
	if recruitCandidateCommand(make([]byte, 16)) || recruitCandidateCommand(make([]byte, 15)) || !recruitCandidateCommand(command[:]) {
		t.Fatal("command")
	}
}
