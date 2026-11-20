package world

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Field gather errors.
var (
	ErrFieldNotOwned    = errors.New("world: field not owned by city")
	ErrGatherBusy       = errors.New("world: field gather already active")
	ErrGatherNotFound   = errors.New("world: field gather not found")
	ErrGatherNotClaimed = errors.New("world: field gather not finished")
	ErrGatherClaimed    = errors.New("world: field gather already claimed")
)

// GatherItem is one treasure granted by a field gather.
type GatherItem struct {
	ItemCfgID int32 `json:"item_cfg_id"`
	Count     int64 `json:"count"`
}

// GatherReward is the stored output of one gather.
type GatherReward struct {
	Food  int64        `json:"food"`
	Wood  int64        `json:"wood"`
	Stone int64        `json:"stone"`
	Iron  int64        `json:"iron"`
	Gold  int64        `json:"gold"`
	Items []GatherItem `json:"items"`
}

// FieldGather is one active or claimed gather.
type FieldGather struct {
	GatherID int64
	PlayerID int64
	CityID   int64
	HeroID   int64
	X, Y     int
	Terrain  Terrain
	Level    int16
	StartAt  time.Time
	FinishAt time.Time
	Status   int16
	Reward   GatherReward
}

// GatherService owns the field_gather table. It keeps no in-memory state.
type GatherService struct {
	Pool     *pgxpool.Pool
	Wild     *WildConfig
	Duration time.Duration
	Now      func() time.Time
}

// NewGatherService builds the field gather store.
func NewGatherService(pool *pgxpool.Pool, wild *WildConfig) *GatherService {
	return &GatherService{Pool: pool, Wild: wild, Duration: time.Hour, Now: time.Now}
}

// GatherRewardFor derives the deterministic reward of a terrain+level pair.
func GatherRewardFor(wild *WildConfig, terrain Terrain, level int16) GatherReward {
	var out GatherReward
	if wild == nil {
		return out
	}
	var loot WildLoot
	if profile := wild.Terrain(terrain); profile != nil {
		if lv := profile.Level(level); lv != nil {
			loot = lv.Loot
		}
	} else if camp := wild.Camps[1]; camp != nil {
		if lv := camp.Level(level); lv != nil {
			loot = lv.Loot
		}
	}
	out.Food = loot.Food
	out.Wood = loot.Wood
	out.Stone = loot.Stone
	out.Iron = loot.Iron
	out.Gold = loot.Gold
	treasure := int32(2100) + int32(terrain)
	if terrain < TerrainPlain || terrain > TerrainSwamp {
		treasure = 2101
	}
	out.Items = []GatherItem{{ItemCfgID: treasure, Count: 1 + int64(level)/5}}
	return out
}

// Start opens a gather on a tile owned by the city. Only one active gather per
// city tile and per hero is allowed.
func (g *GatherService) Start(ctx context.Context, sid int32, playerID, cityID, heroID int64, x, y int) (*FieldGather, error) {
	if g == nil || g.Pool == nil || heroID <= 0 {
		return nil, ErrGatherNotFound
	}
	now := g.Now()
	tx, err := g.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()
	var terrain int16
	var level int16
	var owner *int64
	err = tx.QueryRow(ctx, `SELECT terrain, level, owner_city_id FROM map_cell
		WHERE server_id = $1 AND x = $2 AND y = $3 FOR UPDATE`, sid, x, y).Scan(&terrain, &level, &owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrFieldNotOwned
	}
	if err != nil {
		return nil, err
	}
	if owner == nil || *owner != cityID {
		return nil, ErrFieldNotOwned
	}
	var busy bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM field_gather
		WHERE server_id = $1 AND status = 1 AND ((x = $2 AND y = $3) OR hero_id = $4))`,
		sid, x, y, heroID).Scan(&busy); err != nil {
		return nil, err
	}
	if busy {
		return nil, ErrGatherBusy
	}
	computed := GatherRewardFor(g.Wild, Terrain(terrain), level)
	reward, err := json.Marshal(computed)
	if err != nil {
		return nil, err
	}
	row := &FieldGather{GatherID: 0, PlayerID: playerID, CityID: cityID, HeroID: heroID, X: x, Y: y,
		Terrain: Terrain(terrain), Level: level, StartAt: now, FinishAt: now.Add(g.Duration), Status: 1,
		Reward: computed}
	if err = tx.QueryRow(ctx, `INSERT INTO field_gather(server_id,gather_id,player_id,city_id,hero_id,x,y,terrain,level,start_at,finish_at,status,reward)
		VALUES($1,nextval('field_gather_id_seq'),$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11)
		RETURNING gather_id`,
		sid, playerID, cityID, heroID, x, y, terrain, level, row.StartAt, row.FinishAt, reward).Scan(&row.GatherID); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return row, nil
}

// List returns the player's gathers newest first.
func (g *GatherService) List(ctx context.Context, sid int32, playerID int64, cityID int64, limit int) ([]FieldGather, error) {
	if g == nil || g.Pool == nil {
		return nil, ErrGatherNotFound
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	query := `SELECT gather_id,player_id,city_id,hero_id,x,y,terrain,level,start_at,finish_at,status,reward
		FROM field_gather WHERE server_id = $1 AND player_id = $2`
	args := []any{sid, playerID}
	if cityID > 0 {
		query += ` AND city_id = $3`
		args = append(args, cityID)
	}
	query += ` ORDER BY gather_id DESC LIMIT ` + strconv.Itoa(limit)
	rows, err := g.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []FieldGather
	for rows.Next() {
		var row FieldGather
		var raw []byte
		if err = rows.Scan(&row.GatherID, &row.PlayerID, &row.CityID, &row.HeroID, &row.X, &row.Y,
			&row.Terrain, &row.Level, &row.StartAt, &row.FinishAt, &row.Status, &raw); err != nil {
			return nil, err
		}
		if len(raw) > 0 {
			if err = json.Unmarshal(raw, &row.Reward); err != nil {
				return nil, err
			}
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// Claim credits the stored reward once the timer has elapsed.
func (g *GatherService) Claim(ctx context.Context, sid int32, playerID, gatherID int64) (*FieldGather, error) {
	if g == nil || g.Pool == nil {
		return nil, ErrGatherNotFound
	}
	now := g.Now()
	tx, err := g.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()
	var row FieldGather
	var raw []byte
	err = tx.QueryRow(ctx, `SELECT gather_id,player_id,city_id,hero_id,x,y,terrain,level,start_at,finish_at,status,reward
		FROM field_gather WHERE server_id = $1 AND gather_id = $2 FOR UPDATE`, sid, gatherID).
		Scan(&row.GatherID, &row.PlayerID, &row.CityID, &row.HeroID, &row.X, &row.Y,
			&row.Terrain, &row.Level, &row.StartAt, &row.FinishAt, &row.Status, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrGatherNotFound
	}
	if err != nil {
		return nil, err
	}
	if row.PlayerID != playerID {
		return nil, ErrGatherNotFound
	}
	if row.Status != 1 {
		return nil, ErrGatherClaimed
	}
	if now.Before(row.FinishAt) {
		return nil, ErrGatherNotClaimed
	}
	if len(raw) > 0 {
		if err = json.Unmarshal(raw, &row.Reward); err != nil {
			return nil, err
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE player_wallet SET food = food + $3, wood = wood + $4,
		stone = stone + $5, iron = iron + $6, gold = gold + $7
		WHERE server_id = $1 AND player_id = $2`,
		sid, playerID, row.Reward.Food, row.Reward.Wood, row.Reward.Stone, row.Reward.Iron, row.Reward.Gold); err != nil {
		return nil, err
	}
	for _, item := range row.Reward.Items {
		if item.ItemCfgID <= 0 || item.Count <= 0 {
			continue
		}
		if _, err = tx.Exec(ctx, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity)
			VALUES($1,$2,$3,$4)
			ON CONFLICT (server_id,player_id,item_cfg_id) DO UPDATE
			SET quantity = player_item.quantity + EXCLUDED.quantity`,
			sid, playerID, item.ItemCfgID, item.Count); err != nil {
			return nil, err
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE field_gather SET status = 2
		WHERE server_id = $1 AND gather_id = $2`, sid, gatherID); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	row.Status = 2
	return &row, nil
}
