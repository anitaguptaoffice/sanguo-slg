package march

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

func TestFreshMilitaryRetainedInvalidAndConstants(t *testing.T) {
	if err := validateFreshMilitaryRetained(context.Background(), nil, nil, freshsource.Profile{}); err == nil {
		t.Fatal("empty source")
	}
	for _, text := range []string{freshRetainedColumns, freshRetainedChecks, freshRetainedIndexes} {
		if !json.Valid([]byte(text)) {
			t.Fatal("invalid fixed metadata JSON")
		}
	}
}
