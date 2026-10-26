package content

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists bags and grant idempotency per spec/db/006_content.sql and m4_003_mail_reward.sql.
type PGStore struct{ Pool *pgxpool.Pool }

// NewPGStore wraps a PostgreSQL pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{Pool: pool} }

func (p *PGStore) LoadBag(ctx context.Context, player PlayerRef) ([]Stack, error) {
	rows, err := p.Pool.Query(ctx, `
		SELECT item_cfg_id, quantity
		FROM player_item
		WHERE server_id = $1 AND player_id = $2 AND quantity > 0
		ORDER BY item_cfg_id
	`, player.ServerID, player.PlayerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Stack
	for rows.Next() {
		var st Stack
		if err := rows.Scan(&st.ItemCfgID, &st.Quantity); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}

// SaveStack deliberately rejects online absolute replacements, including deletes.
// Use Grant or conditional debits. Offline maintenance must explicitly stop all
// competing inventory writers and must not reuse this runtime Store method.
func (p *PGStore) SaveStack(context.Context, PlayerRef, int32, int32) error {
	return ErrOfflineStackWrite
}

func (p *PGStore) FindSuccessfulGrant(ctx context.Context, serverID int32, idempotencyKey string) (int64, bool, error) {
	var grantID int64
	err := p.Pool.QueryRow(ctx, `
		SELECT grant_id FROM reward_grant_queue
		WHERE server_id = $1 AND idempotency_key = $2 AND status = $3
	`, serverID, idempotencyKey, GrantStatusSuccess).Scan(&grantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return grantID, true, nil
}

func (p *PGStore) RecordSuccessfulGrant(ctx context.Context, job GrantJob, grantID int64) error {
	raw, err := json.Marshal(job.Rewards)
	if err != nil {
		return err
	}
	sourceType := job.SourceType
	if sourceType == "" {
		sourceType = "grant"
	}
	now := time.Now()
	_, err = p.Pool.Exec(ctx, `
		INSERT INTO reward_grant_queue (
			server_id, grant_id, player_id, source_type, source_ref, rewards,
			status, idempotency_key, completed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, job.ServerID, grantID, job.PlayerID, sourceType, job.SourceRef, raw,
		GrantStatusSuccess, job.IdempotencyKey, now)
	if isUniqueViolation(err) {
		return nil
	}
	return err
}

func (p *PGStore) NextGrantID(ctx context.Context, serverID int32) (int64, error) {
	var id int64
	err := p.Pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(grant_id), 0) + 1 FROM reward_grant_queue WHERE server_id = $1
	`, serverID).Scan(&id)
	return id, err
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
