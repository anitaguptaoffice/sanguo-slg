// Package campaign implements historical PVE campaign stages.
package campaign

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrStageNotFound = errors.New("campaign: stage not found")
	ErrStageLocked   = errors.New("campaign: stage locked")
	ErrTroops        = errors.New("campaign: invalid loaned troops")
)

// ItemReward is one item grant.
type ItemReward struct {
	ItemCfgID int32 `json:"item_cfg_id"`
	Count     int32 `json:"count"`
}

// Rewards is the first-clear package.
type Rewards struct {
	Gold     int64        `json:"gold"`
	Prestige int64        `json:"prestige"`
	Items    []ItemReward `json:"items"`
}

// Stage is one configured battle.
type Stage struct {
	ID               int32
	Code             string
	Name             string
	Chapter          int16
	Order            int16
	PrevStageID      int32
	TroopCap         int32
	Defender         []march.TroopStack
	DefenderHeroName string
	DefenderLevel    int
	DefenderForce    int32
	DefenderIntel    int32
	WallLevel        int32
	WallTower        int32
	Rewards          Rewards
}

// View adds player progress.
type View struct {
	Stage
	Unlocked bool
	Cleared  bool
	Stars    int16
}

// Progress is the result of a finished stage.
type Progress struct {
	Stars      int16
	FirstClear bool
	Rewards    Rewards
}

// ArenaOpponent is a sandbox duel target.
type ArenaOpponent struct {
	ID               int32
	Name             string
	TroopCap         int32
	Defender         []march.TroopStack
	DefenderHeroName string
	DefenderLevel    int
	DefenderForce    int32
	DefenderIntel    int32
	WallLevel        int32
	WallTower        int32
	RewardGold       int64
	RewardPrestige   int64
	RewardItemCfgID  int32
	RewardItemCount  int32
}

// ArenaResult reports a duel result and its once-per-day reward.
type ArenaResult struct {
	FirstWin  bool
	Gold      int64
	Prestige  int64
	ItemCfgID int32
	ItemCount int32
}

// ListArena returns configured duel opponents.
func (s *Service) ListArena(ctx context.Context) ([]ArenaOpponent, error) {
	rows, err := s.pool.Query(ctx, `SELECT opponent_id,name,troop_cap,defender,defender_hero_name,defender_level,
		defender_force,defender_intel,wall_level,wall_tower,reward_gold,reward_prestige,
		COALESCE(reward_item_cfg_id,0),reward_item_count FROM cfg_arena_opponent ORDER BY opponent_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ArenaOpponent
	for rows.Next() {
		var a ArenaOpponent
		var defenderRaw []byte
		if err := rows.Scan(&a.ID, &a.Name, &a.TroopCap, &defenderRaw, &a.DefenderHeroName, &a.DefenderLevel,
			&a.DefenderForce, &a.DefenderIntel, &a.WallLevel, &a.WallTower, &a.RewardGold, &a.RewardPrestige,
			&a.RewardItemCfgID, &a.RewardItemCount); err != nil {
			return nil, err
		}
		if a.Defender, err = decodeStacks(defenderRaw); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// LoadArena returns one opponent.
func (s *Service) LoadArena(ctx context.Context, opponentID int32) (*ArenaOpponent, error) {
	list, err := s.ListArena(ctx)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if list[i].ID == opponentID {
			return &list[i], nil
		}
	}
	return nil, ErrStageNotFound
}

// CompleteArena grants the daily first-win reward.
func (s *Service) CompleteArena(ctx context.Context, serverID int32, playerID int64, opponentID int32) (*ArenaResult, error) {
	opponent, err := s.LoadArena(ctx, opponentID)
	if err != nil {
		return nil, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var inserted bool
	err = tx.QueryRow(ctx, `INSERT INTO player_arena_reward(server_id,player_id,opponent_id,claim_date)
		VALUES($1,$2,$3,$4::date) ON CONFLICT DO NOTHING RETURNING true`,
		serverID, playerID, opponentID, s.now().UTC().Format("2006-01-02")).Scan(&inserted)
	if errors.Is(err, pgx.ErrNoRows) {
		inserted = false
		err = nil
	}
	if err != nil {
		return nil, err
	}
	out := &ArenaResult{FirstWin: inserted}
	if !inserted {
		return out, nil
	}
	out.Gold, out.Prestige = opponent.RewardGold, opponent.RewardPrestige
	out.ItemCfgID, out.ItemCount = opponent.RewardItemCfgID, opponent.RewardItemCount
	if opponent.RewardGold > 0 {
		if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold+$3 WHERE server_id=$1 AND player_id=$2`,
			serverID, playerID, opponent.RewardGold); err != nil {
			return nil, err
		}
	}
	if opponent.RewardItemCfgID > 0 && opponent.RewardItemCount > 0 {
		if _, err := tx.Exec(ctx, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity)
			VALUES($1,$2,$3,$4) ON CONFLICT (server_id,player_id,item_cfg_id)
			DO UPDATE SET quantity=player_item.quantity+EXCLUDED.quantity`,
			serverID, playerID, opponent.RewardItemCfgID, opponent.RewardItemCount); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if opponent.RewardPrestige > 0 && s.Prestige != nil {
		_ = s.Prestige(ctx, serverID, playerID, opponent.RewardPrestige)
	}
	return out, nil
}

// Service loads stages and records clears.
type Service struct {
	pool     *pgxpool.Pool
	now      func() time.Time
	Prestige func(ctx context.Context, serverID int32, playerID, amount int64) error
}

// New builds a service; now defaults to time.Now.
func New(pool *pgxpool.Pool, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{pool: pool, now: now}
}

// List returns stages with unlocked/cleared state.
func (s *Service) List(ctx context.Context, serverID int32, playerID int64) ([]View, error) {
	stages, err := s.loadAll(ctx)
	if err != nil {
		return nil, err
	}
	progress, err := s.progressMap(ctx, serverID, playerID)
	if err != nil {
		return nil, err
	}
	out := make([]View, 0, len(stages))
	for _, st := range stages {
		p := progress[st.ID]
		unlocked := st.PrevStageID == 0 || progress[st.PrevStageID].Cleared
		out = append(out, View{Stage: st, Unlocked: unlocked, Cleared: p.Cleared, Stars: p.Stars})
	}
	return out, nil
}

// Load returns one stage.
func (s *Service) Load(ctx context.Context, stageID int32) (*Stage, error) {
	var st Stage
	var defenderRaw, rewardsRaw []byte
	err := s.pool.QueryRow(ctx, `SELECT stage_id,code,name,chapter,stage_order,COALESCE(prev_stage_id,0),troop_cap,
		defender,defender_hero_name,defender_level,defender_force,defender_intel,wall_level,wall_tower,rewards
		FROM cfg_campaign_stage WHERE stage_id=$1`, stageID).
		Scan(&st.ID, &st.Code, &st.Name, &st.Chapter, &st.Order, &st.PrevStageID, &st.TroopCap, &defenderRaw,
			&st.DefenderHeroName, &st.DefenderLevel, &st.DefenderForce, &st.DefenderIntel, &st.WallLevel,
			&st.WallTower, &rewardsRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrStageNotFound
	}
	if err != nil {
		return nil, err
	}
	if st.Defender, err = decodeStacks(defenderRaw); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(rewardsRaw, &st.Rewards); err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *Service) loadAll(ctx context.Context) ([]Stage, error) {
	rows, err := s.pool.Query(ctx, `SELECT stage_id,code,name,chapter,stage_order,COALESCE(prev_stage_id,0),troop_cap,
		defender,defender_hero_name,defender_level,defender_force,defender_intel,wall_level,wall_tower,rewards
		FROM cfg_campaign_stage ORDER BY chapter,stage_order`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Stage
	for rows.Next() {
		var st Stage
		var defenderRaw, rewardsRaw []byte
		if err := rows.Scan(&st.ID, &st.Code, &st.Name, &st.Chapter, &st.Order, &st.PrevStageID, &st.TroopCap,
			&defenderRaw, &st.DefenderHeroName, &st.DefenderLevel, &st.DefenderForce, &st.DefenderIntel,
			&st.WallLevel, &st.WallTower, &rewardsRaw); err != nil {
			return nil, err
		}
		if st.Defender, err = decodeStacks(defenderRaw); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(rewardsRaw, &st.Rewards); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}

type progressRow struct {
	Stars   int16
	Cleared bool
}

func (s *Service) progressMap(ctx context.Context, serverID int32, playerID int64) (map[int32]progressRow, error) {
	rows, err := s.pool.Query(ctx, `SELECT stage_id,stars,cleared_at IS NOT NULL
		FROM player_campaign_progress WHERE server_id=$1 AND player_id=$2`, serverID, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[int32]progressRow)
	for rows.Next() {
		var id int32
		var p progressRow
		if err := rows.Scan(&id, &p.Stars, &p.Cleared); err != nil {
			return nil, err
		}
		out[id] = p
	}
	return out, rows.Err()
}

// Complete records a win and grants first-clear rewards once.
func (s *Service) Complete(ctx context.Context, serverID int32, playerID int64, stageID int32, stars int16) (*Progress, error) {
	stage, err := s.Load(ctx, stageID)
	if err != nil {
		return nil, err
	}
	if stars < 1 {
		stars = 1
	}
	if stars > 3 {
		stars = 3
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `INSERT INTO player_campaign_progress(server_id,player_id,stage_id,stars,cleared_at,best_at)
		VALUES($1,$2,$3,$4,$5,$5) ON CONFLICT (server_id,player_id,stage_id) DO UPDATE SET
			stars=GREATEST(player_campaign_progress.stars,EXCLUDED.stars),
			cleared_at=COALESCE(player_campaign_progress.cleared_at,EXCLUDED.cleared_at),
			best_at=EXCLUDED.best_at`,
		serverID, playerID, stageID, stars, s.now()); err != nil {
		return nil, err
	}
	var firstClear bool
	err = tx.QueryRow(ctx, `INSERT INTO player_campaign_reward(server_id,player_id,stage_id,claimed_at)
		VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING true`, serverID, playerID, stageID, s.now()).Scan(&firstClear)
	if errors.Is(err, pgx.ErrNoRows) {
		firstClear = false
		err = nil
	}
	if err != nil {
		return nil, err
	}
	out := &Progress{Stars: stars, FirstClear: firstClear}
	if firstClear {
		out.Rewards = stage.Rewards
		for _, item := range stage.Rewards.Items {
			if _, err := tx.Exec(ctx, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity)
				VALUES($1,$2,$3,$4) ON CONFLICT (server_id,player_id,item_cfg_id)
				DO UPDATE SET quantity=player_item.quantity+EXCLUDED.quantity`,
				serverID, playerID, item.ItemCfgID, item.Count); err != nil {
				return nil, err
			}
		}
		if stage.Rewards.Gold > 0 {
			if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold+$3 WHERE server_id=$1 AND player_id=$2`,
				serverID, playerID, stage.Rewards.Gold); err != nil {
				return nil, err
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if firstClear && stage.Rewards.Prestige > 0 && s.Prestige != nil {
		_ = s.Prestige(ctx, serverID, playerID, stage.Rewards.Prestige)
	}
	return out, nil
}

func decodeStacks(raw []byte) ([]march.TroopStack, error) {
	var m map[string]int32
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	out := make([]march.TroopStack, 0, len(m))
	for key, count := range m {
		var id int32
		if _, err := fmt.Sscanf(key, "%d", &id); err != nil {
			return nil, err
		}
		if count > 0 {
			out = append(out, march.TroopStack{UnitCfgID: id, Count: count})
		}
	}
	return out, nil
}
