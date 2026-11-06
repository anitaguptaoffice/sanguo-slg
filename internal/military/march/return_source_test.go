package march

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestReturnSourceInvalidAndCauses(t *testing.T) {
	if p, err := NewReturnParticipant(context.Background(), nil, nil, freshsource.Profile{}, nil); p != nil || !errors.Is(err, ErrReturnSource) {
		t.Fatal("invalid constructor", err)
	}
	for _, p := range []*ReturnParticipant{nil, {}, {source: &freshMilitarySource{}}} {
		if !errors.Is(p.Pin(context.Background(), nil), ErrReturnSource) {
			t.Fatal("invalid participant")
		}
	}
	for _, cause := range []error{ErrFreshCitySource, errFreshMilitaryBase, errFreshMilitaryQueue, errFreshMilitaryRetained, errReturnCatalog,
		&pgconn.PgError{Code: "42P01"}, &pgconn.PgError{Code: "3F000"}, &pgconn.PgError{Code: "42809"}, &pgconn.PgError{Code: "42501"},
		context.Canceled, context.DeadlineExceeded, recruittx.ErrBinding, recruittx.ErrInactive, &pgconn.PgError{Code: "40001"}, &pgconn.PgError{Code: "55P03"}} {
		s := &freshMilitarySource{}
		err := returnSourceFailure(s, cause)
		definite := !errors.Is(cause, context.Canceled) && !errors.Is(cause, context.DeadlineExceeded) && cause != recruittx.ErrBinding && cause != recruittx.ErrInactive
		var pg *pgconn.PgError
		if errors.As(cause, &pg) && (pg.Code == "40001" || pg.Code == "55P03") {
			definite = false
		}
		if !errors.Is(err, cause) || s.retired.Load() != definite || errors.Is(err, ErrReturnSource) != definite {
			t.Fatalf("cause lost or retirement wrong: %v", err)
		}
	}
}
