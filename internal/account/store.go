package account

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store persists accounts, sessions, and per-shard players.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore wraps a PostgreSQL pool.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

type AccountRow struct {
	ID           int64
	LoginName    string
	PasswordHash string
	Status       int16
}

type GameServerRow struct {
	ServerID    int32
	DisplayName string
	Status      int16
}

type PlayerRow struct {
	ServerID    int32
	PlayerID    int64
	AccountID   int64
	DisplayName string
	Level       int32
	Power       int64
}

type WalletRow struct {
	Food  int64
	Wood  int64
	Iron  int64
	Stone int64
	Gold  int64
}

var ErrLoginNameTaken = errors.New("login name taken")

func (s *Store) InsertAccount(ctx context.Context, loginName, passwordHash string) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO account (login_name, password_hash, status)
		VALUES ($1, $2, 1)
		RETURNING account_id`,
		loginName, passwordHash,
	).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			return 0, ErrLoginNameTaken
		}
		return 0, err
	}
	return id, nil
}

func (s *Store) AccountByLoginName(ctx context.Context, loginName string) (AccountRow, error) {
	var row AccountRow
	err := s.pool.QueryRow(ctx, `
		SELECT account_id, login_name, password_hash, status
		FROM account WHERE login_name = $1`, loginName,
	).Scan(&row.ID, &row.LoginName, &row.PasswordHash, &row.Status)
	if err != nil {
		return AccountRow{}, err
	}
	return row, nil
}

func (s *Store) GameServer(ctx context.Context, serverID int32) (GameServerRow, error) {
	var row GameServerRow
	err := s.pool.QueryRow(ctx, `
		SELECT server_id, display_name, status
		FROM game_server WHERE server_id = $1`, serverID,
	).Scan(&row.ServerID, &row.DisplayName, &row.Status)
	if err != nil {
		return GameServerRow{}, err
	}
	return row, nil
}

func (s *Store) PlayerOnServer(ctx context.Context, serverID int32, accountID int64) (PlayerRow, error) {
	var row PlayerRow
	err := s.pool.QueryRow(ctx, `
		SELECT server_id, player_id, account_id, display_name, level, power
		FROM player WHERE server_id = $1 AND account_id = $2`, serverID, accountID,
	).Scan(&row.ServerID, &row.PlayerID, &row.AccountID, &row.DisplayName, &row.Level, &row.Power)
	if err != nil {
		return PlayerRow{}, err
	}
	return row, nil
}

func (s *Store) Wallet(ctx context.Context, serverID int32, playerID int64) (WalletRow, error) {
	var w WalletRow
	err := s.pool.QueryRow(ctx, `
		SELECT food, wood, iron, stone, gold
		FROM player_wallet WHERE server_id = $1 AND player_id = $2`, serverID, playerID,
	).Scan(&w.Food, &w.Wood, &w.Iron, &w.Stone, &w.Gold)
	if errors.Is(err, pgx.ErrNoRows) {
		return WalletRow{}, nil
	}
	return w, err
}

func (s *Store) CreateSession(ctx context.Context, accountID int64, expiresAt time.Time) (string, error) {
	var sessionID string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO account_session (account_id, expires_at)
		VALUES ($1, $2)
		RETURNING session_id::text`, accountID, expiresAt,
	).Scan(&sessionID)
	return sessionID, err
}

func (s *Store) SessionValid(ctx context.Context, sessionID string, now time.Time) (bool, int64, error) {
	var accountID int64
	var expiresAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT account_id, expires_at FROM account_session
		WHERE session_id = $1::uuid`, sessionID,
	).Scan(&accountID, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, 0, nil
	}
	if err != nil {
		return false, 0, err
	}
	if !expiresAt.After(now) {
		return false, 0, nil
	}
	return true, accountID, nil
}

func (s *Store) RefreshSession(ctx context.Context, sessionID string, newExpires time.Time, now time.Time) (time.Time, error) {
	var expiresAt time.Time
	err := s.pool.QueryRow(ctx, `
		UPDATE account_session
		SET expires_at = $2
		WHERE session_id = $1::uuid AND expires_at > $3
		RETURNING expires_at`, sessionID, newExpires, now,
	).Scan(&expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, pgx.ErrNoRows
	}
	return expiresAt, err
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
