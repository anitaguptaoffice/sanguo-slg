// Package meta implements achievements and world progress phases.
package meta

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrAchievementNotFound = errors.New("meta: achievement not found")
	ErrNotReached          = errors.New("meta: achievement not reached")
	ErrAlreadyClaimed      = errors.New("meta: achievement already claimed")
)

// ItemReward is one granted item.
type ItemReward struct {
	ItemCfgID int32 `json:"item_cfg_id"`
	Count     int32 `json:"count"`
}

// Reward is an achievement payout.
type Reward struct {
	Gold     int64        `json:"gold"`
	Prestige int64        `json:"prestige"`
	Items    []ItemReward `json:"items"`
}

// Achievement is one configured milestone.
type Achievement struct {
	ID          int32
	Code        string
	Name        string
	Description string
	Category    int16
	Metric      string
	Threshold   int64
	Reward      Reward
}

// View adds live progress.
type View struct {
	Achievement
	Progress int64
	Claimed  bool
	CanClaim bool
}

// WorldProgress is the current server phase.
type WorldProgress struct {
	Phase       int16
	Name        string
	Next        string
	OwnedCities int64
	Cleared     int64
}

// Service reads achievements and world phase.
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

// List returns achievements with live progress and claim state.
func (s *Service) List(ctx context.Context, serverID int32, playerID int64) ([]View, error) {
	rows, err := s.pool.Query(ctx, `SELECT a.achievement_id,a.code,a.name,a.description,a.category,a.metric,
		a.threshold,a.rewards,(pa.claimed_at IS NOT NULL)
		FROM cfg_achievement a
		LEFT JOIN player_achievement pa ON pa.server_id=$1 AND pa.player_id=$2 AND pa.achievement_id=a.achievement_id
		ORDER BY a.achievement_id`, serverID, playerID)
	if err != nil {
		return nil, err
	}
	var out []View
	for rows.Next() {
		var v View
		var rewardsRaw []byte
		if err := rows.Scan(&v.ID, &v.Code, &v.Name, &v.Description, &v.Category, &v.Metric,
			&v.Threshold, &rewardsRaw, &v.Claimed); err != nil {
			rows.Close()
			return nil, err
		}
		if err := json.Unmarshal(rewardsRaw, &v.Reward); err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, v)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		progress, err := metricValue(ctx, s.pool, serverID, playerID, out[i].Metric)
		if err != nil {
			return nil, err
		}
		out[i].Progress = progress
		out[i].CanClaim = !out[i].Claimed && progress >= out[i].Threshold
	}
	return out, nil
}

// Claim grants one reached achievement.
func (s *Service) Claim(ctx context.Context, serverID int32, playerID int64, achievementID int32) (*View, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var v View
	var rewardsRaw []byte
	err = tx.QueryRow(ctx, `SELECT achievement_id,code,name,description,category,metric,threshold,rewards
		FROM cfg_achievement WHERE achievement_id=$1`, achievementID).
		Scan(&v.ID, &v.Code, &v.Name, &v.Description, &v.Category, &v.Metric, &v.Threshold, &rewardsRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAchievementNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(rewardsRaw, &v.Reward); err != nil {
		return nil, err
	}
	progress, err := metricValue(ctx, tx, serverID, playerID, v.Metric)
	if err != nil {
		return nil, err
	}
	v.Progress = progress
	if progress < v.Threshold {
		return nil, ErrNotReached
	}
	var inserted bool
	err = tx.QueryRow(ctx, `INSERT INTO player_achievement(server_id,player_id,achievement_id,claimed_at)
		VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING true`, serverID, playerID, achievementID, s.now()).Scan(&inserted)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAlreadyClaimed
	}
	if err != nil {
		return nil, err
	}
	for _, item := range v.Reward.Items {
		if _, err := tx.Exec(ctx, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity)
			VALUES($1,$2,$3,$4) ON CONFLICT (server_id,player_id,item_cfg_id)
			DO UPDATE SET quantity=player_item.quantity+EXCLUDED.quantity`,
			serverID, playerID, item.ItemCfgID, item.Count); err != nil {
			return nil, err
		}
	}
	if v.Reward.Gold > 0 {
		if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold+$3 WHERE server_id=$1 AND player_id=$2`,
			serverID, playerID, v.Reward.Gold); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if v.Reward.Prestige > 0 && s.Prestige != nil {
		_ = s.Prestige(ctx, serverID, playerID, v.Reward.Prestige)
	}
	v.Claimed = true
	return &v, nil
}

// CurrentPhase returns the phase and the latest progress signals.
func (s *Service) CurrentPhase(ctx context.Context, serverID int32) (*WorldProgress, error) {
	var phase int16
	if err := s.pool.QueryRow(ctx, `SELECT phase FROM world_phase_state WHERE server_id=$1`, serverID).Scan(&phase); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			phase = 1
		} else {
			return nil, err
		}
	}
	progress := &WorldProgress{Phase: phase}
	_ = s.pool.QueryRow(ctx, `SELECT count(*) FROM player_campaign_progress WHERE server_id=$1 AND cleared_at IS NOT NULL`, serverID).Scan(&progress.Cleared)
	_ = s.pool.QueryRow(ctx, `SELECT count(*) FROM special_city_state WHERE server_id=$1 AND owner_guild_id>0`, serverID).Scan(&progress.OwnedCities)
	switch phase {
	case 1:
		progress.Name = "讨平黄巾"
		progress.Next = "通关 5 个战役关卡或攻占首座名城"
	case 2:
		progress.Name = "群雄割据"
		progress.Next = "占领洛阳"
	default:
		progress.Name = "问鼎洛阳"
		progress.Next = "已开启全服终局"
	}
	return progress, nil
}

// AdvancePhase promotes the world phase when conditions are met.
func (s *Service) AdvancePhase(ctx context.Context, serverID int32) (int16, bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var phase int16
	if err := tx.QueryRow(ctx, `SELECT phase FROM world_phase_state WHERE server_id=$1 FOR UPDATE`, serverID).Scan(&phase); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			phase = 1
			if _, err := tx.Exec(ctx, `INSERT INTO world_phase_state(server_id,phase,updated_at) VALUES($1,$2,$3)
				ON CONFLICT (server_id) DO NOTHING`, serverID, phase, s.now()); err != nil {
				return 0, false, err
			}
		} else {
			return 0, false, err
		}
	}
	target := phase
	if target == 1 {
		var cleared, owned int64
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM player_campaign_progress WHERE server_id=$1 AND cleared_at IS NOT NULL`, serverID).Scan(&cleared); err != nil {
			return 0, false, err
		}
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM special_city_state WHERE server_id=$1 AND owner_guild_id>0`, serverID).Scan(&owned); err != nil {
			return 0, false, err
		}
		if cleared >= 5 || owned >= 1 {
			target = 2
		}
	}
	if target == 2 {
		var luoyang bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM special_city_state WHERE server_id=$1 AND city_cfg_id=8 AND owner_guild_id>0)`, serverID).Scan(&luoyang); err != nil {
			return 0, false, err
		}
		if luoyang {
			target = 3
		}
	}
	changed := target > phase
	if changed {
		if _, err := tx.Exec(ctx, `UPDATE world_phase_state SET phase=$2,updated_at=$3 WHERE server_id=$1`,
			serverID, target, s.now()); err != nil {
			return 0, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, false, err
	}
	return target, changed, nil
}

type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func metricValue(ctx context.Context, q rowQuerier, serverID int32, playerID int64, metric string) (int64, error) {
	var value int64
	var err error
	switch metric {
	case "prestige":
		err = q.QueryRow(ctx, `SELECT COALESCE((SELECT prestige FROM player_rank WHERE server_id=$1 AND player_id=$2),0)`,
			serverID, playerID).Scan(&value)
	case "campaign_cleared":
		err = q.QueryRow(ctx, `SELECT count(*) FROM player_campaign_progress
			WHERE server_id=$1 AND player_id=$2 AND cleared_at IS NOT NULL`, serverID, playerID).Scan(&value)
	case "special_captures":
		err = q.QueryRow(ctx, `SELECT COALESCE((SELECT captures FROM player_special_capture WHERE server_id=$1 AND player_id=$2),0)`,
			serverID, playerID).Scan(&value)
	case "arena_rewards":
		err = q.QueryRow(ctx, `SELECT count(*) FROM player_arena_reward WHERE server_id=$1 AND player_id=$2`,
			serverID, playerID).Scan(&value)
	case "luoyang_owned":
		err = q.QueryRow(ctx, `SELECT CASE WHEN EXISTS(
			SELECT 1 FROM special_city_state st JOIN guild_member m
			ON m.server_id=st.server_id AND m.guild_id=st.owner_guild_id
			WHERE st.server_id=$1 AND st.city_cfg_id=8 AND st.owner_guild_id>0 AND m.player_id=$2) THEN 1 ELSE 0 END`,
			serverID, playerID).Scan(&value)
	case "guild_cities":
		err = q.QueryRow(ctx, `SELECT count(*) FROM special_city_state st JOIN guild_member m
			ON m.server_id=st.server_id AND m.guild_id=st.owner_guild_id
			WHERE st.server_id=$1 AND st.owner_guild_id>0 AND m.player_id=$2`, serverID, playerID).Scan(&value)
	default:
		return 0, nil
	}
	return value, err
}
