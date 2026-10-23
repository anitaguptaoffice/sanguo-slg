package shard

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ServerListRow is one visible game_server entry for the picker UI.
type ServerListRow struct {
	ServerID     int32
	DisplayName  string
	Status       int16
	OpenedAt     *time.Time
	OnlineCount  int32
	HasPlayer    bool
}

// Store reads shard metadata from PostgreSQL (platform scope only).
type Store struct {
	Pool *pgxpool.Pool
}

func (s *Store) ListVisibleServers(ctx context.Context, accountID int64, offset, limit int) ([]ServerListRow, int32, error) {
	var total int32
	err := s.Pool.QueryRow(ctx, `
		SELECT COUNT(1) FROM game_server
		WHERE COALESCE(list_visible, true) = true`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT gs.server_id, gs.display_name, gs.status, gs.opened_at,
		       COALESCE(gs.online_count, 0),
		       EXISTS (
		         SELECT 1 FROM player p
		         WHERE p.server_id = gs.server_id AND p.account_id = $1
		       )
		FROM game_server gs
		WHERE COALESCE(gs.list_visible, true) = true
		ORDER BY COALESCE(gs.sort_weight, 0) DESC, gs.opened_at DESC NULLS LAST, gs.server_id
		OFFSET $2 LIMIT $3`, accountID, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []ServerListRow
	for rows.Next() {
		var row ServerListRow
		if err := rows.Scan(&row.ServerID, &row.DisplayName, &row.Status, &row.OpenedAt, &row.OnlineCount, &row.HasPlayer); err != nil {
			return nil, 0, err
		}
		out = append(out, row)
	}
	return out, total, rows.Err()
}

type GameServerRow struct {
	ServerID    int32
	DisplayName string
	Status      int16
}

func (s *Store) GameServer(ctx context.Context, serverID int32) (GameServerRow, error) {
	var row GameServerRow
	err := s.Pool.QueryRow(ctx, `
		SELECT server_id, display_name, status
		FROM game_server WHERE server_id = $1`, serverID,
	).Scan(&row.ServerID, &row.DisplayName, &row.Status)
	if err != nil {
		return GameServerRow{}, err
	}
	return row, nil
}

type PlayerRow struct {
	ServerID    int32
	PlayerID    int64
	DisplayName string
	Level       int32
	Power       int64
}

func (s *Store) PlayerOnServer(ctx context.Context, serverID int32, accountID int64) (PlayerRow, error) {
	var row PlayerRow
	err := s.Pool.QueryRow(ctx, `
		SELECT server_id, player_id, display_name, level, power
		FROM player WHERE server_id = $1 AND account_id = $2`, serverID, accountID,
	).Scan(&row.ServerID, &row.PlayerID, &row.DisplayName, &row.Level, &row.Power)
	if err != nil {
		return PlayerRow{}, err
	}
	return row, nil
}

type WalletRow struct {
	Food  int64
	Wood  int64
	Iron  int64
	Stone int64
	Gold  int64
}

func (s *Store) Wallet(ctx context.Context, serverID int32, playerID int64) (WalletRow, error) {
	var w WalletRow
	err := s.Pool.QueryRow(ctx, `
		SELECT food, wood, iron, stone, gold
		FROM player_wallet WHERE server_id = $1 AND player_id = $2`, serverID, playerID,
	).Scan(&w.Food, &w.Wood, &w.Iron, &w.Stone, &w.Gold)
	if err != nil && !isNoRows(err) {
		return WalletRow{}, err
	}
	return w, nil
}

func (s *Store) SessionAccount(ctx context.Context, sessionID string) (int64, time.Time, error) {
	var accountID int64
	var expiresAt time.Time
	err := s.Pool.QueryRow(ctx, `
		SELECT account_id, expires_at FROM account_session
		WHERE session_id = $1::uuid`, sessionID,
	).Scan(&accountID, &expiresAt)
	if err != nil {
		return 0, time.Time{}, err
	}
	return accountID, expiresAt, nil
}

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
