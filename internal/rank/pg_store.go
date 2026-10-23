package rank

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists snapshots in PostgreSQL (spec/db/m3_004_rank.sql).
type PGStore struct {
	Pool *pgxpool.Pool
}

// NewPGStore wraps a pool.
func NewPGStore(p *pgxpool.Pool) *PGStore {
	return &PGStore{Pool: p}
}

func (p *PGStore) WriteSnapshot(ctx context.Context, meta SnapshotMeta, entries []Entry) error {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var batchID int64
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(batch_id), 0) + 1
		FROM rank_snapshot
		WHERE server_id = $1 AND rank_type = $2`, meta.ServerID, meta.RankType,
	).Scan(&batchID)
	if err != nil {
		return err
	}
	refreshed := meta.RefreshedAt
	if refreshed.IsZero() {
		refreshed = time.Now()
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO rank_snapshot (server_id, rank_type, batch_id, refreshed_at, entry_count)
		VALUES ($1,$2,$3,$4,$5)`,
		meta.ServerID, meta.RankType, batchID, refreshed, len(entries),
	)
	if err != nil {
		return err
	}
	for _, e := range entries {
		extra, err := encodeExtra(e.GuildName)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO rank_snapshot_entry (
				server_id, rank_type, batch_id, rank_position, subject_id, score, display_name, extra_json
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			meta.ServerID, meta.RankType, batchID, e.Position, e.SubjectID, e.Score, e.DisplayName, extra,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func encodeExtra(guildName string) ([]byte, error) {
	if guildName == "" {
		return nil, nil
	}
	return json.Marshal(map[string]string{"guild_name": guildName})
}

func decodeExtra(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	var m map[string]string
	if err := json.Unmarshal(raw, &m); err != nil {
		return ""
	}
	return m["guild_name"]
}

func (p *PGStore) LatestSnapshot(ctx context.Context, serverID int32, rankType RankType) (SnapshotMeta, error) {
	var meta SnapshotMeta
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, rank_type, batch_id, refreshed_at, entry_count
		FROM rank_snapshot
		WHERE server_id = $1 AND rank_type = $2
		ORDER BY batch_id DESC
		LIMIT 1`, serverID, rankType,
	).Scan(&meta.ServerID, &meta.RankType, &meta.BatchID, &meta.RefreshedAt, &meta.EntryCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return SnapshotMeta{}, ErrNoSnapshot
	}
	if err != nil {
		return SnapshotMeta{}, err
	}
	return meta, nil
}

func (p *PGStore) ListEntries(ctx context.Context, serverID int32, rankType RankType, batchID int64, offset, limit int) ([]Entry, int32, error) {
	var total int32
	err := p.Pool.QueryRow(ctx, `
		SELECT entry_count FROM rank_snapshot
		WHERE server_id = $1 AND rank_type = $2 AND batch_id = $3`,
		serverID, rankType, batchID,
	).Scan(&total)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, ErrNoSnapshot
	}
	if err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := p.Pool.Query(ctx, `
		SELECT rank_position, subject_id, score, display_name, extra_json
		FROM rank_snapshot_entry
		WHERE server_id = $1 AND rank_type = $2 AND batch_id = $3
		ORDER BY rank_position
		OFFSET $4 LIMIT $5`, serverID, rankType, batchID, offset, limit,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []Entry
	for rows.Next() {
		var e Entry
		var extra []byte
		var name *string
		if err := rows.Scan(&e.Position, &e.SubjectID, &e.Score, &name, &extra); err != nil {
			return nil, 0, err
		}
		if name != nil {
			e.DisplayName = *name
		}
		e.GuildName = decodeExtra(extra)
		out = append(out, e)
	}
	return out, total, rows.Err()
}

func (p *PGStore) LookupSubject(ctx context.Context, serverID int32, rankType RankType, batchID int64, subjectID int64) (int32, int64, bool, error) {
	var pos int32
	var score int64
	err := p.Pool.QueryRow(ctx, `
		SELECT rank_position, score
		FROM rank_snapshot_entry
		WHERE server_id = $1 AND rank_type = $2 AND batch_id = $3 AND subject_id = $4`,
		serverID, rankType, batchID, subjectID,
	).Scan(&pos, &score)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, 0, false, nil
	}
	if err != nil {
		return 0, 0, false, err
	}
	return pos, score, true, nil
}
