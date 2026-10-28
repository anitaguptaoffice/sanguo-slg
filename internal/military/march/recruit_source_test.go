package march

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

func TestRecruitSourceInvalid(t *testing.T) {
	if got, err := NewRecruitParticipant(context.Background(), nil, nil, freshsource.Profile{}, nil); got != nil || err == nil {
		t.Fatal("invalid constructor")
	}
	for _, p := range []*RecruitParticipant{nil, {}, {source: &freshMilitarySource{}}} {
		if p.Pin(context.Background(), nil) == nil {
			t.Fatal("invalid participant")
		}
	}
}
