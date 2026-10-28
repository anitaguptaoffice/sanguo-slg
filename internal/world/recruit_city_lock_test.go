package world

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestRecruitCityInvalidHandles(t *testing.T) {
	if l, err := NewRecruitCityLocker(context.Background(), nil, nil, freshsource.Profile{}); err == nil || l != nil {
		t.Fatal("zero construction accepted")
	}
	for _, l := range []*RecruitCityLocker{nil, {}} {
		if l.Pin(context.Background(), &recruittx.Access{}) == nil || l.Lock(context.Background(), &recruittx.Access{}, 1, 1) == nil {
			t.Fatal("zero handle accepted")
		}
	}
}
