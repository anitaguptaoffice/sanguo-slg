package hero

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGListPlayerHeroesInTxIsolation(t *testing.T) {
	store := identityStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cfg := store.Pool.Config()
	cfg.MaxConns = 1
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	for _, h := range []*Hero{
		{ServerID: 1, PlayerID: 9, TemplateCfgID: 1001},
		{ServerID: 1, PlayerID: 8, TemplateCfgID: 1001},
		{ServerID: 2, PlayerID: 9, TemplateCfgID: 1001},
		{ServerID: 1, PlayerID: 9, TemplateCfgID: 1002},
	} {
		if err := store.CreateHeroInTx(ctx, tx, h); err != nil {
			t.Fatal(err)
		}
	}
	// A one-connection pool is occupied by tx. A pool lookup would time out.
	reader := NewPGStore(pool)
	rows, err := reader.ListPlayerHeroesInTx(ctx, tx, 1, 9)
	if err != nil || len(rows) != 2 || rows[0].TemplateCfgID != 1001 || rows[1].TemplateCfgID != 1002 {
		t.Fatalf("transaction rows: %+v %v", rows, err)
	}
	// No optional columns existed; the reader must not create them.
	var added int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM information_schema.columns
		WHERE table_schema=current_schema() AND table_name='player_hero' AND column_name='force_add'`).Scan(&added); err != nil || added != 0 {
		t.Fatalf("reader ran schema setup: %d %v", added, err)
	}
	var visible int
	if err := store.Pool.QueryRow(ctx, "SELECT count(*) FROM player_hero").Scan(&visible); err != nil || visible != 0 {
		t.Fatalf("reader committed uncommitted heroes: %d %v", visible, err)
	}
	if _, err := tx.Exec(ctx, heroPointAddColumnsDDL); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE player_hero SET force_add=7 WHERE server_id=1 AND player_id=9`); err != nil {
		t.Fatal(err)
	}
	// A nil pool also works, and optional existing values are not discarded.
	rows, err = (&PGStore{}).ListPlayerHeroesInTx(ctx, tx, 1, 9)
	if err != nil || len(rows) != 2 || rows[0].ForceAdd != 7 {
		t.Fatalf("existing points: %+v %v", rows, err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := reader.ListPlayerHeroesInTx(ctx, tx, 1, 9); !errors.Is(err, pgx.ErrTxClosed) {
		t.Fatalf("closed tx: %v", err)
	}
	if _, err := reader.ListPlayerHeroesInTx(ctx, nil, 1, 9); !errors.Is(err, ErrRecruitTransactionRequired) {
		t.Fatalf("nil tx: %v", err)
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM player_hero").Scan(&visible); err != nil || visible != 0 {
		t.Fatalf("rollback: %d %v", visible, err)
	}
}
