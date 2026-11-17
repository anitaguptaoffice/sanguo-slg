package api

import (
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/jackc/pgx/v5/pgxpool"
)

func pgReuseSpecEnabled() bool {
	return pgfixture.ReuseEnabled()
}

func walletBoundarySharedPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	return pgfixture.WarmPool(t)
}