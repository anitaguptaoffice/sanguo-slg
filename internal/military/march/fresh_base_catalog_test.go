package march

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

func TestFreshMilitaryBaseInvalidAndConstants(t *testing.T) {
	if err := validateFreshMilitaryBase(context.Background(), nil, nil, freshsource.Profile{}); err == nil {
		t.Fatal("empty source")
	}
	for _, text := range []string{freshBaseColumns, freshBaseChecks, freshBaseIndexes} {
		if !json.Valid([]byte(text)) {
			t.Fatal("invalid fixed metadata JSON")
		}
	}
}
