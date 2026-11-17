package rank

import (
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/jackc/pgx/v5/pgxpool"
)

func openRankTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	return pgfixture.OpenFullSpecDB(t)
}

func applyRankSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_ = t
	_ = pool
}