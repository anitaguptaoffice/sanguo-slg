package rank

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrPrestigeUnavailable = errors.New("rank: prestige unavailable")
	ErrRankPrestige        = errors.New("rank: insufficient prestige")
	ErrRankHall            = errors.New("rank: hall level too low")
	ErrRankGold            = errors.New("rank: insufficient gold")
	ErrRankItem            = errors.New("rank: insufficient jewel")
	ErrRankMax             = errors.New("rank: already at max rank")
	ErrRankCity            = errors.New("rank: city not owned")
)

var prestigeThresholds = [...]int64{0, 100, 300, 800, 1500, 3000}

const (
	rankJewelItem int32 = 2001
	maxRankLevel  int16 = 5
)

type PrestigeView struct {
	Prestige     int64
	RankLevel    int16
	CityCap      int32
	NextPrestige int64
	NextCap      int32
}

type PrestigeService struct {
	Pool *pgxpool.Pool
	Now  func() time.Time
}

func NewPrestigeService(pool *pgxpool.Pool, now func() time.Time) *PrestigeService {
	if now == nil {
		now = time.Now
	}
	return &PrestigeService{Pool: pool, Now: now}
}

func viewFor(prestige int64, level int16) PrestigeView {
	if level > maxRankLevel {
		level = maxRankLevel
	}
	if level < 0 {
		level = 0
	}
	v := PrestigeView{Prestige: prestige, RankLevel: level, CityCap: int32(level) + 1}
	if int(level)+1 < len(prestigeThresholds) {
		v.NextPrestige = prestigeThresholds[level+1]
		v.NextCap = int32(level) + 2
	}
	return v
}

func (s *PrestigeService) Get(ctx context.Context, serverID int32, playerID int64) (PrestigeView, error) {
	if s == nil || s.Pool == nil || playerID <= 0 {
		return PrestigeView{}, ErrPrestigeUnavailable
	}
	var prestige int64
	var level int16
	err := s.Pool.QueryRow(ctx, `SELECT prestige,rank_level FROM player_rank WHERE server_id=$1 AND player_id=$2`,
		serverID, playerID).Scan(&prestige, &level)
	if errors.Is(err, pgx.ErrNoRows) {
		return viewFor(0, 0), nil
	}
	if err != nil {
		return PrestigeView{}, err
	}
	return viewFor(prestige, level), nil
}

func (s *PrestigeService) Add(ctx context.Context, serverID int32, playerID, amount int64) error {
	if s == nil || s.Pool == nil || playerID <= 0 || amount <= 0 {
		return nil
	}
	_, err := s.Pool.Exec(ctx, `INSERT INTO player_rank(server_id,player_id,prestige,rank_level,updated_at)
		VALUES($1,$2,$3,0,$4)
		ON CONFLICT (server_id,player_id) DO UPDATE SET prestige=player_rank.prestige+EXCLUDED.prestige,updated_at=EXCLUDED.updated_at`,
		serverID, playerID, amount, s.Now())
	return err
}

func (s *PrestigeService) Promote(ctx context.Context, serverID int32, playerID, cityID int64) (PrestigeView, error) {
	if s == nil || s.Pool == nil || playerID <= 0 || cityID <= 0 {
		return PrestigeView{}, ErrPrestigeUnavailable
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return PrestigeView{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var owner int64
	if err := tx.QueryRow(ctx, `SELECT player_id FROM player_city WHERE server_id=$1 AND city_id=$2`,
		serverID, cityID).Scan(&owner); err != nil || owner != playerID {
		return PrestigeView{}, ErrRankCity
	}
	var prestige int64
	var level int16
	err = tx.QueryRow(ctx, `SELECT prestige,rank_level FROM player_rank WHERE server_id=$1 AND player_id=$2 FOR UPDATE`,
		serverID, playerID).Scan(&prestige, &level)
	if errors.Is(err, pgx.ErrNoRows) {
		prestige, level = 0, 0
	} else if err != nil {
		return PrestigeView{}, err
	}
	if level >= maxRankLevel {
		return PrestigeView{}, ErrRankMax
	}
	next := level + 1
	if prestige < prestigeThresholds[next] {
		return PrestigeView{}, ErrRankPrestige
	}
	var hall int32
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=1`, serverID, cityID).Scan(&hall); err != nil {
		return PrestigeView{}, err
	}
	if hall < int32(next)+1 {
		return PrestigeView{}, ErrRankHall
	}
	cost := int64(next) * 1000
	var gold int64
	if err := tx.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`,
		serverID, playerID).Scan(&gold); err != nil {
		return PrestigeView{}, err
	}
	if gold < cost {
		return PrestigeView{}, ErrRankGold
	}
	tag, err := tx.Exec(ctx, `UPDATE player_item SET quantity=quantity-$4 WHERE server_id=$1 AND player_id=$2
		AND item_cfg_id=$3 AND quantity >= $4`, serverID, playerID, rankJewelItem, int32(next))
	if err != nil {
		return PrestigeView{}, err
	}
	if tag.RowsAffected() != 1 {
		return PrestigeView{}, ErrRankItem
	}
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold-$3 WHERE server_id=$1 AND player_id=$2`,
		serverID, playerID, cost); err != nil {
		return PrestigeView{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO player_rank(server_id,player_id,prestige,rank_level,updated_at)
		VALUES($1,$2,$3,$4,$5)
		ON CONFLICT (server_id,player_id) DO UPDATE SET rank_level=EXCLUDED.rank_level,updated_at=EXCLUDED.updated_at`,
		serverID, playerID, prestige, next, s.Now()); err != nil {
		return PrestigeView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return PrestigeView{}, err
	}
	return viewFor(prestige, next), nil
}
