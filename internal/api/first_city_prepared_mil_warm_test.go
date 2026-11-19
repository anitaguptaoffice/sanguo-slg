package api

import (
	"context"
	"os"
	"testing"
)

// TestWarmFirstCityPreparedMilDDL is not a product test; run via `make test-pg-warm-mil` once per warm schema.
func TestWarmFirstCityPreparedMilDDL(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL not set")
	}
	pool := walletBoundarySharedPool(t)
	if err := EnsureFirstCityPreparedMilDDL(context.Background(), pool); err != nil {
		t.Fatal(err)
	}
}
