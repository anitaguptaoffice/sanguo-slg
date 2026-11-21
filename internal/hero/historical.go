package hero

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrHistoricalUnavailable = errors.New("hero: historical hero unavailable")
	ErrHistoricalNotFound    = errors.New("hero: historical hero not found")
	ErrHistoricalState       = errors.New("hero: historical hero not recruitable")
	ErrHistoricalRumor       = errors.New("hero: historical hero rumor not found")
	ErrHistoricalItem        = errors.New("hero: historical recruitment item missing")
)

const (
	HistoricalStateWild     int16 = 0
	HistoricalStateCaptive  int16 = 1
	HistoricalStateOwned    int16 = 2
	HistoricalStateDefected int16 = 3

	HistoricalSearchGold   int64 = 500
	HistoricalPersuadeGold int64 = 5000
	HistoricalJewelItem    int32 = 2001
	HistoricalJewelQty     int32 = 1
	historicalInnCfgID     int32 = 10
)

type HistoricalHero struct {
	NpcCfgID                        int32
	TemplateCfgID                   int32
	DisplayName                     string
	Level                           int32
	Force, Intel, Politics, Command int32
	X, Y                            int32
	State                           int16
	OwnerPlayerID                   int64
	CityID                          int64
	Friend                          int32
	Discovered                      bool
}

type HistoricalService struct {
	Pool  *pgxpool.Pool
	Store *PGStore
	Now   func() time.Time
}

func NewHistorical(pool *pgxpool.Pool, store *PGStore, now func() time.Time) *HistoricalService {
	if now == nil {
		now = time.Now
	}
	if store == nil {
		store = NewPGStore(pool)
	}
	return &HistoricalService{Pool: pool, Store: store, Now: now}
}

func scanHistorical(row pgx.Row) (HistoricalHero, error) {
	var h HistoricalHero
	var owner, city *int64
	err := row.Scan(&h.NpcCfgID, &h.TemplateCfgID, &h.DisplayName, &h.Level, &h.Force, &h.Intel,
		&h.Politics, &h.Command, &h.X, &h.Y, &h.State, &owner, &city, &h.Friend, &h.Discovered)
	if owner != nil {
		h.OwnerPlayerID = *owner
	}
	if city != nil {
		h.CityID = *city
	}
	return h, err
}

const historicalSelect = `SELECT h.npc_cfg_id,h.template_cfg_id,h.display_name,h.level,h.force,h.intel,h.politics,h.command,
	h.x,h.y,h.state,h.owner_player_id,h.city_id,h.friend,(r.npc_cfg_id IS NOT NULL)
	FROM historical_hero h LEFT JOIN player_hero_rumor r
	ON r.server_id=h.server_id AND r.player_id=$2 AND r.npc_cfg_id=h.npc_cfg_id`

func (s *HistoricalService) List(ctx context.Context, serverID int32, playerID int64) ([]HistoricalHero, error) {
	if s == nil || s.Pool == nil {
		return nil, ErrHistoricalUnavailable
	}
	rows, err := s.Pool.Query(ctx, historicalSelect+` WHERE h.server_id=$1 ORDER BY h.npc_cfg_id`, serverID, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []HistoricalHero
	for rows.Next() {
		h, err := scanHistorical(rows)
		if err != nil {
			return nil, err
		}
		if !h.Discovered && h.State == HistoricalStateWild {
			h.X, h.Y = -1, -1
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (s *HistoricalService) Search(ctx context.Context, serverID int32, playerID, cityID int64, npcCfgID int32) (HistoricalHero, int64, error) {
	if s == nil || s.Pool == nil {
		return HistoricalHero{}, 0, ErrHistoricalUnavailable
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return HistoricalHero{}, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var inn int32
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=$3`, serverID, cityID, historicalInnCfgID).Scan(&inn); err != nil {
		return HistoricalHero{}, 0, err
	}
	if inn < 1 {
		return HistoricalHero{}, 0, ErrHotelNotBuilt
	}
	h, err := scanHistorical(tx.QueryRow(ctx, historicalSelect+` WHERE h.server_id=$1 AND h.npc_cfg_id=$3`, serverID, playerID, npcCfgID))
	if err != nil {
		return HistoricalHero{}, 0, ErrHistoricalNotFound
	}
	if h.State != HistoricalStateWild {
		return HistoricalHero{}, 0, ErrHistoricalState
	}
	if h.Discovered {
		var gold int64
		if err := tx.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=$1 AND player_id=$2`,
			serverID, playerID).Scan(&gold); err != nil {
			return HistoricalHero{}, 0, err
		}
		return h, gold, tx.Commit(ctx)
	}
	var gold int64
	if err := tx.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`,
		serverID, playerID).Scan(&gold); err != nil {
		return HistoricalHero{}, 0, err
	}
	if gold < HistoricalSearchGold {
		return HistoricalHero{}, 0, ErrInsufficientGold
	}
	gold -= HistoricalSearchGold
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=$3 WHERE server_id=$1 AND player_id=$2`,
		serverID, playerID, gold); err != nil {
		return HistoricalHero{}, 0, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO player_hero_rumor(server_id,player_id,npc_cfg_id) VALUES($1,$2,$3)
		ON CONFLICT DO NOTHING`, serverID, playerID, npcCfgID); err != nil {
		return HistoricalHero{}, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return HistoricalHero{}, 0, err
	}
	h.Discovered = true
	return h, gold, nil
}

// Capture rolls a battlefield capture. roll is 0..99 from the deterministic
// battle stream; friendship raises the chance by five percent per point.
func (s *HistoricalService) Capture(ctx context.Context, serverID int32, playerID, cityID int64, x, y int32, roll int) (*Hero, error) {
	if s == nil || s.Pool == nil {
		return nil, ErrHistoricalUnavailable
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	h, err := scanHistorical(tx.QueryRow(ctx, `SELECT npc_cfg_id,template_cfg_id,display_name,level,force,intel,politics,command,
		x,y,state,owner_player_id,city_id,friend,true FROM historical_hero
		WHERE server_id=$1 AND state=0 AND x=$2 AND y=$3 FOR UPDATE`, serverID, x, y))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	chance := 25 + int(h.Friend)*5
	if chance > 80 {
		chance = 80
	}
	if roll < 0 || roll >= 100 || roll >= chance {
		return nil, nil
	}
	hero := &Hero{
		ServerID: serverID, PlayerID: playerID, TemplateCfgID: h.TemplateCfgID, DisplayName: h.DisplayName,
		Level: h.Level, Loyalty: 50, Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command,
		Status: StatusCaptive, CreatedAt: s.Now(),
	}
	if err := s.Store.CreateHeroInTx(ctx, tx, hero); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO player_hero_captive(server_id,hero_id,city_id,summon_item_cfg_id,summon_item_qty)
		SELECT $1::int,$2::bigint,$3::bigint,$4::int,$5::int WHERE to_regclass('player_hero_captive') IS NOT NULL`,
		serverID, hero.HeroID, cityID, CaptiveSummonItemCfgID, 1); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE historical_hero SET state=1,owner_player_id=$3,city_id=$4,captured_at=$5,updated_at=$5,hero_id=$6
		WHERE server_id=$1 AND npc_cfg_id=$2`, serverID, h.NpcCfgID, playerID, cityID, s.Now(), hero.HeroID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return hero, nil
}

func (s *HistoricalService) Persuade(ctx context.Context, serverID int32, playerID, cityID int64, npcCfgID int32) (*Hero, int64, error) {
	if s == nil || s.Pool == nil {
		return nil, 0, ErrHistoricalUnavailable
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var heroID, owner int64
	var template int32
	err = tx.QueryRow(ctx, `SELECT hero_id,owner_player_id,template_cfg_id FROM historical_hero
		WHERE server_id=$1 AND npc_cfg_id=$2 AND state=1 FOR UPDATE`, serverID, npcCfgID).Scan(&heroID, &owner, &template)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, ErrHistoricalState
	}
	if err != nil {
		return nil, 0, err
	}
	if owner != playerID {
		return nil, 0, ErrHistoricalState
	}
	var office int32
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=1`, serverID, cityID).Scan(&office); err != nil {
		return nil, 0, err
	}
	var owned int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM player_hero WHERE server_id=$1 AND player_id=$2
		AND status NOT IN ($3,$4) AND template_cfg_id<>$5`, serverID, playerID, StatusCaptive, StatusComing,
		MonarchTemplateCfgID).Scan(&owned); err != nil {
		return nil, 0, err
	}
	if !HasHeroCapacity(office, owned) {
		return nil, 0, ErrHotelCapacityFull
	}
	var gold int64
	if err := tx.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`,
		serverID, playerID).Scan(&gold); err != nil {
		return nil, 0, err
	}
	if gold < HistoricalPersuadeGold {
		return nil, 0, ErrInsufficientGold
	}
	tag, err := tx.Exec(ctx, `UPDATE player_item SET quantity=quantity-$4 WHERE server_id=$1 AND player_id=$2
		AND item_cfg_id=$3 AND quantity >= $4`, serverID, playerID, HistoricalJewelItem, HistoricalJewelQty)
	if err != nil {
		return nil, 0, err
	}
	if tag.RowsAffected() != 1 {
		return nil, 0, ErrHistoricalItem
	}
	gold -= HistoricalPersuadeGold
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=$3 WHERE server_id=$1 AND player_id=$2`,
		serverID, playerID, gold); err != nil {
		return nil, 0, err
	}
	tag, err = tx.Exec(ctx, `UPDATE player_hero SET status=$4,loyalty=GREATEST(loyalty,70) WHERE server_id=$1
		AND hero_id=$2 AND player_id=$3 AND status=$5`, serverID, heroID, playerID, StatusIdle, StatusCaptive)
	if err != nil {
		return nil, 0, err
	}
	if tag.RowsAffected() != 1 {
		return nil, 0, ErrHistoricalState
	}
	if _, err := tx.Exec(ctx, `DELETE FROM player_hero_captive WHERE server_id=$1 AND hero_id=$2`, serverID, heroID); err != nil {
		return nil, 0, err
	}
	if _, err := tx.Exec(ctx, `UPDATE historical_hero SET state=2,owner_player_id=$2,city_id=$3,updated_at=$4
		WHERE server_id=$1 AND npc_cfg_id=$5`, serverID, playerID, cityID, s.Now(), npcCfgID); err != nil {
		return nil, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, 0, err
	}
	h, err := s.Store.GetHero(ctx, serverID, heroID)
	if err != nil {
		return nil, 0, err
	}
	return h, gold, nil
}
