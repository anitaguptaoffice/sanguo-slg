package quest

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists player_quest (spec/db/006_content.sql, m4_001_quest.sql).
type PGStore struct {
	Pool *pgxpool.Pool
}

// NewPGStore wraps a pool.
func NewPGStore(p *pgxpool.Pool) *PGStore {
	return &PGStore{Pool: p}
}

func (p *PGStore) GetPlayerQuest(ctx context.Context, serverID int32, playerID int64, questCfgID int32) (PlayerQuestRow, bool, error) {
	return getPlayerQuest(ctx, p.Pool, serverID, playerID, questCfgID, "")
}

type questDB interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

func getPlayerQuest(ctx context.Context, q questDB, serverID int32, playerID int64, questCfgID int32, lock string) (PlayerQuestRow, bool, error) {
	var row PlayerQuestRow
	var progressRaw []byte
	var accepted, completed, claimed *time.Time
	err := q.QueryRow(ctx, `
		SELECT server_id, player_id, quest_cfg_id, state, progress,
		       accepted_at, completed_at, reward_claimed_at, updated_at
		FROM player_quest
		WHERE server_id=$1 AND player_id=$2 AND quest_cfg_id=$3`+lock,
		serverID, playerID, questCfgID,
	).Scan(
		&row.ServerID, &row.PlayerID, &row.QuestCfgID, &row.State, &progressRaw,
		&accepted, &completed, &claimed, &row.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PlayerQuestRow{}, false, nil
		}
		return PlayerQuestRow{}, false, err
	}
	if err := json.Unmarshal(progressRaw, &row.Progress); err != nil {
		return PlayerQuestRow{}, false, err
	}
	row.AcceptedAt = accepted
	row.CompletedAt = completed
	row.RewardClaimedAt = claimed
	if err := validateProof(row); err != nil {
		return PlayerQuestRow{}, false, err
	}
	return row, true, nil
}

func (p *PGStore) ListPlayerQuests(ctx context.Context, serverID int32, playerID int64) ([]PlayerQuestRow, error) {
	rows, err := p.Pool.Query(ctx, `
		SELECT server_id, player_id, quest_cfg_id, state, progress,
		       accepted_at, completed_at, reward_claimed_at, updated_at
		FROM player_quest
		WHERE server_id=$1 AND player_id=$2`, serverID, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PlayerQuestRow
	for rows.Next() {
		var row PlayerQuestRow
		var progressRaw []byte
		var accepted, completed, claimed *time.Time
		if err := rows.Scan(
			&row.ServerID, &row.PlayerID, &row.QuestCfgID, &row.State, &progressRaw,
			&accepted, &completed, &claimed, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(progressRaw, &row.Progress); err != nil {
			return nil, err
		}
		row.AcceptedAt = accepted
		row.CompletedAt = completed
		row.RewardClaimedAt = claimed
		if err := validateProof(row); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (p *PGStore) UpsertPlayerQuest(ctx context.Context, row PlayerQuestRow) error {
	return p.upsertPlayerQuest(ctx, row, false)
}

func (p *PGStore) verifyLegacyWall(ctx context.Context, actor Actor, now time.Time) error {
	return p.upsertPlayerQuest(ctx, legacyWallProposal(actor, now), true)
}

func (p *PGStore) upsertPlayerQuest(ctx context.Context, row PlayerQuestRow, legacy bool) error {
	if err := validateProof(row); err != nil {
		return err
	}
	if !isTutorialID(row.QuestCfgID) && row.QuestCfgID != 1006 {
		return upsertPlayerQuest(ctx, p.Pool, row)
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	// A provisional unaccepted row serializes concurrent first writes too.
	_, err = tx.Exec(ctx, `INSERT INTO player_quest (server_id,player_id,quest_cfg_id,updated_at)
		VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, row.ServerID, row.PlayerID, row.QuestCfgID, row.UpdatedAt)
	if err != nil {
		return err
	}
	old, _, err := getPlayerQuest(ctx, tx, row.ServerID, row.PlayerID, row.QuestCfgID, " FOR UPDATE")
	if err != nil {
		return err
	}
	if row.QuestCfgID == 1006 {
		row, err = mergeWallRow(old, row, legacy)
	} else {
		row, err = mergeTutorialRow(old, row)
	}
	if err != nil {
		return err
	}
	if err := upsertPlayerQuest(ctx, tx, row); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func upsertPlayerQuest(ctx context.Context, q questDB, row PlayerQuestRow) error {
	progressRaw, err := json.Marshal(row.Progress)
	if err != nil {
		return err
	}
	_, err = q.Exec(ctx, `
		INSERT INTO player_quest (
			server_id, player_id, quest_cfg_id, state, progress,
			accepted_at, completed_at, reward_claimed_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (server_id, player_id, quest_cfg_id) DO UPDATE SET
			state=EXCLUDED.state,
			progress=EXCLUDED.progress,
			accepted_at=EXCLUDED.accepted_at,
			completed_at=EXCLUDED.completed_at,
			reward_claimed_at=EXCLUDED.reward_claimed_at,
			updated_at=EXCLUDED.updated_at`,
		row.ServerID, row.PlayerID, row.QuestCfgID, row.State, progressRaw,
		row.AcceptedAt, row.CompletedAt, row.RewardClaimedAt, row.UpdatedAt,
	)
	return err
}

// PGCatalog loads cfg_quest from PostgreSQL.
type PGCatalog struct {
	Pool *pgxpool.Pool
}

// NewPGCatalog wraps a pool.
func NewPGCatalog(p *pgxpool.Pool) *PGCatalog {
	return &PGCatalog{Pool: p}
}

func (c *PGCatalog) loadAll(ctx context.Context) ([]QuestCfg, error) {
	rows, err := c.Pool.Query(ctx, `
		SELECT quest_cfg_id, code, quest_type,
		       COALESCE(chain_id, 0), COALESCE(prev_quest_cfg_id, 0),
		       sort_in_chain, objectives, rewards, unlock_level, repeatable
		FROM cfg_quest`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var quests []QuestCfg
	for rows.Next() {
		var q QuestCfg
		var chainID *int32
		var prevID *int32
		var objRaw, rewRaw []byte
		if err := rows.Scan(
			&q.QuestCfgID, &q.Code, &q.QuestType,
			&chainID, &prevID,
			&q.SortInChain, &objRaw, &rewRaw, &q.UnlockLevel, &q.Repeatable,
		); err != nil {
			return nil, err
		}
		if chainID != nil {
			q.ChainID = *chainID
		}
		if prevID != nil {
			q.PrevQuestCfgID = *prevID
		}
		if q.QuestCfgID == 1006 {
			// Exact wall identity must not lose unknown raw objective members
			// before the service's value/shape checks see the configuration.
			q.Objectives, err = parseWallObjectivesJSON(objRaw)
		} else {
			q.Objectives, err = ParseObjectivesJSON(objRaw)
		}
		if err != nil {
			return nil, err
		}
		q.Rewards, err = ParseRewardsJSON(rewRaw)
		if err != nil {
			return nil, err
		}
		quests = append(quests, q)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return quests, nil
}

// MemCatalogFromPG loads once and returns a MemCatalog (helper for wiring).
func MemCatalogFromPG(ctx context.Context, p *pgxpool.Pool) (*MemCatalog, error) {
	pg := &PGCatalog{Pool: p}
	all, err := pg.loadAll(ctx)
	if err != nil {
		return nil, err
	}
	return NewMemCatalog(all), nil
}
