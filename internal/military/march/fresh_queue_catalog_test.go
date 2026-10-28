package march

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

func TestFreshMilitaryQueueInvalidAndConstants(t *testing.T) {
	if err := validateFreshMilitaryQueue(context.Background(), nil, nil, freshsource.Profile{}); err == nil {
		t.Fatal("empty source")
	}
	for _, text := range []string{freshQueueColumns, freshQueueChecks, freshQueueIndexes} {
		if !json.Valid([]byte(text)) {
			t.Fatal("invalid fixed metadata JSON")
		}
	}
}
