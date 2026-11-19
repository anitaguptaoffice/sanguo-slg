package api

import (
	"context"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// firstCityPreparedTxnPath sets transaction-local search_path for WORLD fresh validation.
func firstCityPreparedTxnPath(ctx context.Context, access *recruittx.Access, binding *recruittx.Binding, schema string) error {
	if access == nil || binding == nil || schema == "" {
		return fmt.Errorf("prepared txn path")
	}
	_, err := access.Exec(ctx, binding, "SELECT pg_catalog.set_config('search_path', $1, true)",
		fmt.Sprintf("pg_catalog,%s", schema))
	return err
}
