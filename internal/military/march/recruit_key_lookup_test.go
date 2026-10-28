package march

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func keyLookupParticipant() *RecruitParticipant {
	return &RecruitParticipant{
		source:  &freshMilitarySource{binding: &recruittx.Binding{}, profile: freshsource.Profile{ServerID: 1}},
		catalog: &RecruitCatalog{},
	}
}

func TestRecruitKeyLookupValidation(t *testing.T) {
	ctx := context.Background()
	var noCtx context.Context
	empty := &recruittx.Access{}
	good := RecruitScope{ServerID: 1, PlayerID: 7, CommandID: RecruitCommandID{1}}
	p := keyLookupParticipant()
	// An empty access is rejected before any statement and is never a proven absence.
	if _, _, err := p.Find(ctx, empty, good); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("empty access", err)
	}
	if _, err := p.ReverseAbsent(ctx, empty, good); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("empty access reverse", err)
	}
	for i, q := range []*RecruitParticipant{nil, {}, {source: &freshMilitarySource{}}, {source: p.source}} {
		if _, _, err := q.Find(ctx, empty, good); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatalf("participant %d", i)
		}
		if _, err := q.ReverseAbsent(ctx, empty, good); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatalf("participant reverse %d", i)
		}
	}
	for _, scope := range []RecruitScope{
		{ServerID: 0, PlayerID: 7, CommandID: good.CommandID},
		{ServerID: -1, PlayerID: 7, CommandID: good.CommandID},
		{ServerID: 2, PlayerID: 7, CommandID: good.CommandID},
		{ServerID: 1, PlayerID: 0, CommandID: good.CommandID},
		{ServerID: 1, PlayerID: -1, CommandID: good.CommandID},
		{ServerID: 1, PlayerID: 7},
	} {
		if _, _, err := p.Find(ctx, empty, scope); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("scope", scope, err)
		}
		if _, err := p.ReverseAbsent(ctx, empty, scope); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("scope reverse", scope, err)
		}
	}
	for _, call := range []func() error{
		func() error { _, _, err := p.Find(noCtx, empty, good); return err },
		func() error { _, err := p.ReverseAbsent(noCtx, empty, good); return err },
		func() error { _, _, err := p.Find(ctx, nil, good); return err },
		func() error { _, err := p.ReverseAbsent(ctx, nil, good); return err },
	} {
		if err := call(); !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal("nil input", err)
		}
	}
	retired := keyLookupParticipant()
	retired.source.retired.Store(true)
	if _, _, err := retired.Find(ctx, empty, good); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("retired", err)
	}
	if errors.Is(ErrRecruitConflict, ErrRecruitUnavailable) || ErrRecruitConflict == nil {
		t.Fatal("sentinels")
	}
	// The full uint32 version and both zero-edge command bytes survive copying.
	intent := RecruitIntent{Version: 65537, CityID: 1, UnitCfgID: 4, Count: 9}
	copied := intent
	if copied != intent || copied.Version != 65537 {
		t.Fatal("intent copy")
	}
	intent.Version = ^uint32(0)
	if intent.Version != 4294967295 || copied.Version != 65537 {
		t.Fatal("version narrowed")
	}
	leading, trailing := RecruitCommandID{1}, RecruitCommandID{}
	trailing[15] = 1
	if leading == trailing || len(leading) != 16 || len(trailing) != 16 {
		t.Fatal("command bytes")
	}
}
