package trick

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrTrickUnavailable = errors.New("trick: unavailable")
	ErrNoStrategist     = errors.New("trick: strategist required")
	ErrTrickItem        = errors.New("trick: no talisman")
	ErrTrickTarget      = errors.New("trick: invalid target march")
)

const TalismanItemCfgID int32 = 2004

const (
	TrickRaid    int32 = 1 // 千里奔袭：己方行军提速
	TrickLock    int32 = 2 // 八门金锁：敌方行军延迟 30%
	TrickPin     int32 = 3 // 关门打狗：敌方行军延迟 60%
	TrickFeint   int32 = 4 // 空城计：城池伪装 30 分钟
	feintMinutes       = 30
)

type Result struct {
	CastID      int64
	Success     bool
	Roll        int
	Chance      int
	NewDeadline *time.Time
	FeintUntil  *time.Time
}

type Service struct {
	Pool *pgxpool.Pool
	Now  func() time.Time
}

func New(pool *pgxpool.Pool, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{Pool: pool, Now: now}
}

// Cast resolves one trick. roll is 0..99 from the caller's deterministic
// stream; the strategist's intel raises the chance by half a point per point.
func (s *Service) Cast(ctx context.Context, serverID int32, playerID, cityID int64, trickType int32, targetMarchID int64, roll int) (Result, error) {
	if s == nil || s.Pool == nil || trickType < 1 || trickType > 4 || roll < 0 || roll >= 100 {
		return Result{}, ErrTrickUnavailable
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Result{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var intel int32
	err = tx.QueryRow(ctx, `SELECT h.intel FROM city_office o JOIN player_hero h
		ON h.server_id=o.server_id AND h.hero_id=o.hero_id
		WHERE o.server_id=$1 AND o.city_id=$2 AND o.office=2`, serverID, cityID).Scan(&intel)
	if errors.Is(err, pgx.ErrNoRows) {
		return Result{}, ErrNoStrategist
	}
	if err != nil {
		return Result{}, err
	}
	tag, err := tx.Exec(ctx, `UPDATE player_item SET quantity=quantity-1 WHERE server_id=$1
		AND player_id=$2 AND item_cfg_id=$3 AND quantity > 0`, serverID, playerID, TalismanItemCfgID)
	if err != nil {
		return Result{}, err
	}
	if tag.RowsAffected() != 1 {
		return Result{}, ErrTrickItem
	}
	chance := 50 + int(intel)/2
	if chance > 90 {
		chance = 90
	}
	success := roll < chance
	out := Result{Roll: roll, Chance: chance, Success: success}
	now := s.Now().UTC()
	if success {
		switch trickType {
		case TrickRaid, TrickLock, TrickPin:
			if targetMarchID <= 0 {
				return Result{}, ErrTrickTarget
			}
			var owner int64
			var status int16
			var arrive time.Time
			err := tx.QueryRow(ctx, `SELECT a.owner_player_id,o.status,o.arrive_at
				FROM march_order o JOIN field_army a ON a.server_id=o.server_id AND a.army_id=o.army_id
				WHERE o.server_id=$1 AND o.march_id=$2 FOR UPDATE OF o`, serverID, targetMarchID).
				Scan(&owner, &status, &arrive)
			if err != nil || status != 1 {
				return Result{}, ErrTrickTarget
			}
			if trickType == TrickRaid && owner != playerID || trickType != TrickRaid && owner == playerID {
				return Result{}, ErrTrickTarget
			}
			remaining := arrive.Sub(now)
			if remaining <= 0 {
				return Result{}, ErrTrickTarget
			}
			var deadline time.Time
			switch trickType {
			case TrickRaid:
				deadline = now.Add(remaining * 7 / 10)
			case TrickLock:
				deadline = now.Add(remaining * 13 / 10)
			case TrickPin:
				deadline = now.Add(remaining * 16 / 10)
			}
			if _, err := tx.Exec(ctx, `UPDATE march_order SET arrive_at=$3
				WHERE server_id=$1 AND march_id=$2`, serverID, targetMarchID, deadline); err != nil {
				return Result{}, err
			}
			out.NewDeadline = &deadline
		case TrickFeint:
			until := now.Add(feintMinutes * time.Minute)
			if _, err := tx.Exec(ctx, `INSERT INTO city_trick(server_id,city_id,trick_type,expires_at)
				VALUES($1,$2,$3,$4) ON CONFLICT (server_id,city_id,trick_type) DO UPDATE SET expires_at=EXCLUDED.expires_at`,
				serverID, cityID, TrickFeint, until); err != nil {
				return Result{}, err
			}
			out.FeintUntil = &until
		}
	}
	if err := tx.QueryRow(ctx, `INSERT INTO trick_cast(server_id,player_id,city_id,trick_type,target_march_id,success,roll,chance,item_cfg_id)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING cast_id`, serverID, playerID, cityID, trickType,
		targetMarchID, success, roll, chance, TalismanItemCfgID).Scan(&out.CastID); err != nil {
		return Result{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Result{}, err
	}
	return out, nil
}
