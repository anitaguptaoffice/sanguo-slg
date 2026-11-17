package api

import (
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/jackc/pgx/v5/pgxpool"
)

func walletBoundarySharedPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	return pgfixture.WarmPool(t)
}

// isolateWalletDDL keeps fault-injection DDL out of the process-wide warm schema.
// Call before acquiring any fixture; subtests inherit the setting and each gets
// an owned schema through walletBoundaryPool. Ordinary data-only tests stay warm.
func isolateWalletDDL(t *testing.T) {
	t.Helper()
	t.Setenv(pgfixture.EnvReuseSpec, "0")
}
