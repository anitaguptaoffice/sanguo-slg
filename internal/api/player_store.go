package api

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// playerCreationLockNamespace separates the per-shard MAX+1 allocator from other locks.
const playerCreationLockNamespace int32 = 0x504c4159 // PLAY

// PlayerStore creates shard characters and wallets (integration layer only).
type PlayerStore struct {
	Pool *pgxpool.Pool
}

func (s *PlayerStore) EnsurePlayer(ctx context.Context, serverID int32, accountID int64, displayName string) (int64, error) {
	var playerID int64
	err := s.Pool.QueryRow(ctx, `
		SELECT player_id FROM player WHERE server_id = $1 AND account_id = $2`,
		serverID, accountID).Scan(&playerID)
	if err == nil {
		return playerID, nil
	}
	if !isNoRows(err) {
		return 0, err
	}
	// Keep existing players (including legacy missing wallets) unchanged. New
	// characters and their initial wallets become visible in one commit.
	tx, err := s.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1::integer,$2::integer)`, playerCreationLockNamespace, serverID); err != nil {
		return 0, err
	}
	// Read again after the lock: another creator may have committed meanwhile.
	err = tx.QueryRow(ctx, `SELECT player_id FROM player WHERE server_id = $1 AND account_id = $2`, serverID, accountID).Scan(&playerID)
	if err == nil {
		return playerID, nil
	}
	if !isNoRows(err) {
		return 0, err
	}
	err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(player_id), 1000) + 1 FROM player WHERE server_id = $1`, serverID).Scan(&playerID)
	if err != nil {
		return 0, err
	}
	if displayName == "" {
		displayName = fmt.Sprintf("Lord-%d", playerID)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO player (server_id, player_id, account_id, display_name)
		VALUES ($1, $2, $3, $4)`,
		serverID, playerID, accountID, displayName)
	if err != nil {
		return 0, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO player_wallet (server_id, player_id, food, wood, iron, stone, gold)
		VALUES ($1, $2, 8000, 8000, 5000, 5000, 0)
		ON CONFLICT (server_id, player_id) DO NOTHING`,
		serverID, playerID)
	if err != nil {
		return 0, err
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, err
	}
	return playerID, nil
}

func (s *PlayerStore) AccountIDByCredentials(ctx context.Context, loginName, password string) (int64, error) {
	loginName = strings.TrimSpace(loginName)
	var id int64
	var hash string
	err := s.Pool.QueryRow(ctx, `
		SELECT account_id, password_hash FROM account WHERE login_name = $1`, loginName).
		Scan(&id, &hash)
	if err != nil {
		return 0, err
	}
	if !account.CheckPassword(hash, password) {
		return 0, account.ErrLoginFailed
	}
	return id, nil
}

func (s *PlayerStore) AccountIDForSession(ctx context.Context, sessionID string) (int64, error) {
	var accountID int64
	err := s.Pool.QueryRow(ctx, `
		SELECT account_id FROM account_session WHERE session_id = $1::uuid`, sessionID).
		Scan(&accountID)
	return accountID, err
}

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
