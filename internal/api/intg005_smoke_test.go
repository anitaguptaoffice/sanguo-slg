package api_test

import (
	"testing"
)

// TestINTG005Wave7SmokePath remains as a backward-compatible alias for INTG-006 (DATA-002 seeds).
func TestINTG005Wave7SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-005 wave7 smoke skipped in -short mode (prefer TestINTG006Data002SmokePath; see tools/smoke/README.md)")
	}
	runINTGData002Smoke(t)
}
