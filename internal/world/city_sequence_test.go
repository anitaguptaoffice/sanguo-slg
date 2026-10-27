package world

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestCitySequenceInvalidHandles(t *testing.T) {
	ctx := context.Background()
	a := &recruittx.Access{}
	b := &recruittx.Binding{}
	for _, schema := range []string{"", "pg_catalog", "pg_temp_1", "information_schema"} {
		if got, err := captureCitySequence(ctx, a, b, schema); !errors.Is(err, errCitySequence) || got != nil {
			t.Fatal("invalid schema", got, err)
		}
	}
	for _, input := range []struct {
		ctx context.Context
		a   *recruittx.Access
		b   *recruittx.Binding
	}{{nil, a, b}, {ctx, nil, b}, {ctx, a, nil}} {
		if got, err := captureCitySequence(input.ctx, input.a, input.b, "safe"); err == nil || got != nil {
			t.Fatal("invalid input")
		}
	}
	if got, err := captureCitySequence(ctx, a, b, "safe"); err == nil || got != nil {
		t.Fatal("zero access")
	}
	for _, s := range []*citySequence{nil, {}} {
		if id, err := s.next(ctx, a); !errors.Is(err, errCitySequence) || id != 0 {
			t.Fatal("zero binding")
		}
	}
	s := &citySequence{binding: b, schema: "safe"}
	s.retired.Store(true)
	if id, err := s.next(ctx, a); !errors.Is(err, errCitySequence) || id != 0 {
		t.Fatal("retired binding")
	}
}
