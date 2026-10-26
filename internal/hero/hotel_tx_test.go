package hero

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// Embedding nil ensures any SQL/lifecycle call panics instead of hiding it.
type hotelNoSQL struct{ pgx.Tx }

func TestHotelTxInvalidDependenciesAndScopes(t *testing.T) {
	port, ctx := &PGHotelStore{}, context.Background()
	for _, tc := range []struct {
		name   string
		tx     pgx.Tx
		server int32
		city   int64
		want   error
	}{
		{"nil tx", nil, 1, 77, ErrHotelTransactionRequired},
		{"bad shard", hotelNoSQL{}, 0, 77, ErrInvalidHotelState},
		{"bad city", hotelNoSQL{}, 1, 0, ErrInvalidHotelState},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, list := port.ListCandidatesInTx(ctx, tc.tx, tc.server, tc.city)
			_, tick := port.LastPoolTickInTx(ctx, tc.tx, tc.server, tc.city)
			_, id := port.NextCandidateIDInTx(ctx, tc.tx, tc.server, tc.city)
			replace := port.ReplaceCandidatesInTx(ctx, tc.tx, tc.server, tc.city, nil)
			save := port.SetLastPoolTickInTx(ctx, tc.tx, tc.server, tc.city, time.Time{})
			consume := port.ConsumeCandidateInTx(ctx, tc.tx, tc.server, tc.city, 1)
			for _, err := range []error{list, tick, id, replace, save, consume} {
				if !errors.Is(err, tc.want) {
					t.Fatalf("error=%v want=%v", err, tc.want)
				}
			}
		})
	}
	for _, mutate := range []func(*HotelCandidate){
		func(c *HotelCandidate) { c.CandidateID = 0 },
		func(c *HotelCandidate) { c.ServerID = 0 },
		func(c *HotelCandidate) { c.ServerID = 2 },
		func(c *HotelCandidate) { c.CityID++ },
		func(c *HotelCandidate) { c.GoldCost = -1 },
	} {
		c := txHotelCandidate(1, time.Now())
		mutate(c)
		if err := port.ReplaceCandidatesInTx(ctx, hotelNoSQL{}, 1, 77, []*HotelCandidate{c}); !errors.Is(err, ErrInvalidHotelState) {
			t.Fatalf("invalid replacement: %v", err)
		}
	}
	c := txHotelCandidate(1, time.Now())
	for _, rows := range [][]*HotelCandidate{{nil}, {c, c}} {
		if err := port.ReplaceCandidatesInTx(ctx, hotelNoSQL{}, 1, 77, rows); !errors.Is(err, ErrInvalidHotelState) {
			t.Fatalf("nil/duplicate replacement: %v", err)
		}
	}
	if err := port.ConsumeCandidateInTx(ctx, hotelNoSQL{}, 1, 77, 0); !errors.Is(err, ErrInvalidHotelState) {
		t.Fatalf("invalid consume: %v", err)
	}
}
