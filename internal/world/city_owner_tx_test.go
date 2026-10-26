package world

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
)

// Every method other than QueryRow panics, including mutation and lifecycle.
type ownerOnlyTx struct {
	pgx.Tx
	owner int64
	err   error
	calls int
}

func (tx *ownerOnlyTx) QueryRow(_ context.Context, sql string, args ...any) pgx.Row {
	if sql != `SELECT player_id FROM player_city WHERE server_id=$1 AND city_id=$2 FOR UPDATE` ||
		len(args) != 2 || args[0] != int32(1) || args[1] != int64(10) {
		panic("unexpected ownership query")
	}
	tx.calls++
	return creationRow(func(v ...any) error { *v[0].(*int64) = tx.owner; return tx.err })
}

func TestCityOwnerInTxUsesOnlySuppliedTransaction(t *testing.T) {
	svc := &Service{Store: NewPGStore(nil)} // No Pool or Loader connectivity.
	for _, tc := range []struct {
		owner       int64
		dbErr, want error
	}{
		{7, nil, nil}, {8, nil, ErrCityNotOwned},
		{0, pgx.ErrNoRows, ErrCityNotOwned},
		{0, errors.New("private database diagnostic"), ErrCityOwnershipUnavailable},
	} {
		tx := &ownerOnlyTx{owner: tc.owner, err: tc.dbErr}
		if err := svc.LockCityOwnerInTx(context.Background(), tx, 1, 10, 7); !errors.Is(err, tc.want) || tx.calls != 1 {
			t.Fatalf("ownership error=%v want=%v calls=%d", err, tc.want, tx.calls)
		}
	}
}

func TestCityOwnerInTxRejectsBeforeSQL(t *testing.T) {
	store := NewPGStore(nil)
	for _, ids := range [][3]int64{{0, 10, 7}, {-1, 10, 7}, {1, 0, 7}, {1, -1, 7}, {1, 10, 0}, {1, 10, -1}} {
		tx := &ownerOnlyTx{}
		if err := store.LockCityOwnerInTx(context.Background(), tx, int32(ids[0]), ids[1], ids[2]); err != ErrInvalidCityOwnership || tx.calls != 0 {
			t.Fatal("invalid request reached SQL", ids, err)
		}
	}
	if err := store.LockCityOwnerInTx(context.Background(), nil, 1, 10, 7); err != ErrInvalidCityOwnership {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	tx := &ownerOnlyTx{}
	if err := store.LockCityOwnerInTx(ctx, tx, 1, 10, 7); err != context.Canceled || tx.calls != 0 {
		t.Fatal(err)
	}
	for _, svc := range []*Service{nil, {}, {Store: &memStore{}}, {Store: (*PGStore)(nil)}} {
		if err := svc.LockCityOwnerInTx(context.Background(), tx, 1, 10, 7); err != ErrCityOwnershipUnavailable || tx.calls != 0 {
			t.Fatal(err)
		}
	}
}
