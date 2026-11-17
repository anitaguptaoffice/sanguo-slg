package march

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

func TestReturnCatalogInvalidAndConstants(t *testing.T) {
	if validateReturnCatalog(context.Background(), nil, nil, freshsource.Profile{}) == nil {
		t.Fatal("empty source accepted")
	}
	for _, data := range []string{returnColumns, returnChecks, returnIndexes} {
		if !json.Valid([]byte(data)) {
			t.Fatal("invalid fixed metadata JSON")
		}
	}
}
