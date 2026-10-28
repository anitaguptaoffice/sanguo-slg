package account

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestFreshActorFKRejectsMissingInputs(t *testing.T) {
	for _, ctx := range []context.Context{nil, context.Background()} {
		if validateFreshActorFK(ctx, nil, nil, freshsource.Profile{}) == nil {
			t.Fatal("nil input")
		}
		if validateFreshActorFK(ctx, &recruittx.Access{}, &recruittx.Binding{}, freshsource.Profile{}) == nil {
			t.Fatal("zero input")
		}
	}
}
