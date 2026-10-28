package account

import (
	"context"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"testing"
)

func TestFreshActorTablesRejectMissingInputs(t *testing.T) {
	for _, ctx := range []context.Context{nil, context.Background()} {
		if validateFreshActorTables(ctx, nil, nil, freshsource.Profile{}) == nil {
			t.Fatal("nil input accepted")
		}
		if validateFreshActorTables(ctx, &recruittx.Access{}, &recruittx.Binding{}, freshsource.Profile{}) == nil {
			t.Fatal("zero input accepted")
		}
	}
}
