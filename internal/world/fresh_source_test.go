package world

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestFreshSourceInvalidHandles(t *testing.T) {
	if got, err := NewFreshCityParticipant(context.Background(), nil, nil, freshsource.Profile{}); err == nil || got != nil {
		t.Fatal("zero construction")
	}
	for _, p := range []*FreshCityParticipant{nil, {}} {
		if err := p.Pin(context.Background(), &recruittx.Access{}); err == nil {
			t.Fatal("zero pin")
		}
	}
}
