package march

import (
	"context"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"testing"
)

func TestFreshMilitarySourceInvalid(t *testing.T) {
	if p, err := NewFreshCityParticipant(context.Background(), nil, nil, freshsource.Profile{}); err == nil || p != nil {
		t.Fatal("invalid source")
	}
	for _, p := range []*FreshCityParticipant{nil, {}, {state: &freshMilitarySource{}}} {
		if p.Pin(context.Background(), nil) == nil {
			t.Fatal("invalid participant")
		}
	}
}
