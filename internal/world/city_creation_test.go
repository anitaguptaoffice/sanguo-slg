package world

import (
	"context"
	"errors"
	"math"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type creationRow func(...any) error

func (r creationRow) Scan(v ...any) error { return r(v...) }

// Unimplemented lifecycle/Query methods panic: the participant must not use them.
type creationTx struct {
	pgx.Tx
	calls, inserts              int
	maxID                       int64
	terrain                     Terrain
	resource                    int16
	ownerErr, mapErr, insertErr error
}

func (tx *creationTx) Exec(_ context.Context, q string, args ...any) (pgconn.CommandTag, error) {
	tx.calls++
	if strings.HasPrefix(q, "INSERT INTO player_city") {
		tx.inserts++
		return pgconn.NewCommandTag("INSERT 0 1"), tx.insertErr
	}
	if q != "SELECT pg_advisory_xact_lock($1::integer,$2::integer)" || args[0] != cityCreationLockNamespace || args[1] != int32(1) {
		panic("unexpected SQL or advisory namespace")
	}
	return pgconn.NewCommandTag("SELECT 1"), nil
}

func (tx *creationTx) QueryRow(_ context.Context, q string, _ ...any) pgx.Row {
	tx.calls++
	return creationRow(func(v ...any) error {
		switch {
		case strings.Contains(q, "FROM player WHERE"):
			*v[0].(*int64) = 7
			return tx.ownerErr
		case strings.Contains(q, "FROM map_cell"):
			*v[0].(*Terrain), *v[1].(*int16) = tx.terrain, tx.resource
			return tx.mapErr
		case strings.Contains(q, "MAX(city_id)"):
			*v[0].(*int64) = tx.maxID
			return nil
		default:
			panic("unexpected query")
		}
	})
}

func newCityRequest() City {
	return City{ServerID: 1, PlayerID: 7, Name: "new", X: 1, Y: 2, IsCapital: true, WallLevel: 1, Morale: 100}
}

func TestCreateCityInTxUsesSuppliedTxOnly(t *testing.T) {
	request := newCityRequest()
	tx := &creationTx{maxID: 9}
	// A nil pool and nil Loader prove this path cannot depend on either.
	svc := &Service{Store: NewPGStore(nil)}
	got, err := svc.CreateCityInTx(context.Background(), tx, request)
	want := request
	want.CityID = 10
	if err != nil || got != want || request.CityID != 0 || tx.calls != 5 || tx.inserts != 1 {
		t.Fatalf("staging got=%+v err=%v calls=%d inserts=%d", got, err, tx.calls, tx.inserts)
	}
	if _, err := NewService(&memStore{}).CreateCityInTx(context.Background(), tx, request); !errors.Is(err, ErrCityCreationTxUnsupported) {
		t.Fatalf("unsupported store fell back: %v", err)
	}
}

func TestCreateCityInTxRejectsInvalidRequestsBeforeSQL(t *testing.T) {
	for _, mutate := range []func(*City){
		func(c *City) { c.ServerID = 0 }, func(c *City) { c.PlayerID = 0 },
		func(c *City) { c.CityID = 1 }, func(c *City) { c.X = -1 },
		func(c *City) { c.Y = MapSize },
	} {
		request, tx := newCityRequest(), &creationTx{}
		mutate(&request)
		if _, err := NewPGStore(nil).CreateCityInTx(context.Background(), tx, request); err == nil || tx.calls != 0 {
			t.Fatalf("invalid request reached SQL: %+v %v", request, err)
		}
	}
	if _, err := NewPGStore(nil).CreateCityInTx(context.Background(), nil, newCityRequest()); !errors.Is(err, ErrInvalidCity) {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	tx := &creationTx{}
	if _, err := NewPGStore(nil).CreateCityInTx(ctx, tx, newCityRequest()); !errors.Is(err, context.Canceled) || tx.calls != 0 {
		t.Fatal("canceled request reached SQL", err)
	}
}

func TestCreateCityInTxGuardsAndConflictClassification(t *testing.T) {
	unexpected := errors.New("SQL failed")
	for _, test := range []struct {
		name string
		tx   creationTx
		want error
	}{
		{"owner", creationTx{ownerErr: pgx.ErrNoRows}, ErrCityOwnerMissing},
		{"missing map", creationTx{mapErr: pgx.ErrNoRows}, ErrBadTerrain},
		{"water", creationTx{terrain: TerrainWater}, ErrBadTerrain},
		{"resource", creationTx{resource: 1}, ErrBadTerrain},
		{"exhausted", creationTx{maxID: math.MaxInt64}, ErrInvalidCity},
		{"owner SQL", creationTx{ownerErr: unexpected}, unexpected},
		{"map SQL", creationTx{mapErr: unexpected}, unexpected},
		{"insert SQL", creationTx{insertErr: unexpected}, unexpected},
		{"coordinate", creationTx{insertErr: &pgconn.PgError{Code: "23505", ConstraintName: "player_city_server_id_x_y_key"}}, ErrOccupied},
		{"ID", creationTx{insertErr: &pgconn.PgError{Code: "23505", ConstraintName: "player_city_pkey"}}, ErrCityIDConflict},
	} {
		t.Run(test.name, func(t *testing.T) {
			got, err := NewPGStore(nil).CreateCityInTx(context.Background(), &test.tx, newCityRequest())
			if !errors.Is(err, test.want) || got != (City{}) || test.tx.inserts > 1 {
				t.Fatalf("got=%+v err=%v inserts=%d", got, err, test.tx.inserts)
			}
		})
	}
}
