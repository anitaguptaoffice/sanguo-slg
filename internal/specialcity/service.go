// Package specialcity implements county/commandery/state/capital national war.
package specialcity

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
	ErrNotFound       = errors.New("specialcity: city not found")
	ErrNoGuild        = errors.New("specialcity: guild membership required")
	ErrNoCity         = errors.New("specialcity: no owned special city")
	ErrAlreadyClaimed = errors.New("specialcity: tax already claimed today")
	ErrUnitLocked     = errors.New("specialcity: special unit locked")
	ErrCityOwner      = errors.New("specialcity: city not owned by player")
	ErrInsufficient   = errors.New("specialcity: insufficient resources")
)

const CityTypeCounty = 1

// City is one special city with runtime ownership.
type City struct {
	CfgID          int32
	CityType       int16
	Name           string
	X, Y           int
	WallLevel      int32
	HeroName       string
	HeroLevel      int
	HeroForce      int32
	HeroIntel      int32
	Garrison       []march.TroopStack
	Loot           march.LootRecord
	Recovery       time.Duration
	UnitCfgID      int32
	UnitName       string
	MinPhase       int16
	OwnerGuildID   int64
	OwnerGuildName string
	OccupiedAt     time.Time
	NextRecoverAt  time.Time
}

// Total returns the sum of current defenders.
func (c City) Total() int32 {
	var n int32
	for _, st := range c.Garrison {
		n += st.Count
	}
	return n
}

// Service reads and mutates special city state.
type Service struct {
	pool *pgxpool.Pool
	now  func() time.Time
}

// New builds a service; now defaults to time.Now.
func New(pool *pgxpool.Pool, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{pool: pool, now: now}
}

// List returns every configured city with refreshed garrison and ownership.
func (s *Service) List(ctx context.Context, serverID int32) ([]City, error) {
	rows, err := s.pool.Query(ctx, `SELECT c.city_cfg_id,c.city_type,c.name,c.x,c.y,c.wall_level,c.hero_name,
		c.hero_level,c.hero_force,c.hero_intel,c.garrison,c.loot,c.recovery_seconds,COALESCE(c.unit_cfg_id,0),
		COALESCE(st.owner_guild_id,0),COALESCE(g.name,''),COALESCE(st.occupied_at,'epoch'::timestamptz),
		COALESCE(st.next_recover_at,'epoch'::timestamptz),st.garrison,COALESCE(u.name,''),c.min_phase
		FROM cfg_special_city c
		LEFT JOIN cfg_unit u ON u.unit_cfg_id=c.unit_cfg_id
		LEFT JOIN special_city_state st ON st.server_id=$1 AND st.city_cfg_id=c.city_cfg_id
		LEFT JOIN guild g ON g.server_id=$1 AND g.guild_id=st.owner_guild_id
		ORDER BY c.city_cfg_id`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []City
	for rows.Next() {
		var c City
		var garrisonRaw, lootRaw, stateRaw []byte
		var recovery int
		if err := rows.Scan(&c.CfgID, &c.CityType, &c.Name, &c.X, &c.Y, &c.WallLevel, &c.HeroName,
			&c.HeroLevel, &c.HeroForce, &c.HeroIntel, &garrisonRaw, &lootRaw, &recovery, &c.UnitCfgID,
			&c.OwnerGuildID, &c.OwnerGuildName, &c.OccupiedAt, &c.NextRecoverAt, &stateRaw, &c.UnitName, &c.MinPhase); err != nil {
			return nil, err
		}
		c.Recovery = time.Duration(recovery) * time.Second
		c.Garrison, err = decodeStacks(stateRaw)
		if err != nil {
			return nil, err
		}
		initial, err := decodeStacks(garrisonRaw)
		if err != nil {
			return nil, err
		}
		if c.NextRecoverAt.IsZero() {
			if len(c.Garrison) == 0 {
				c.Garrison = initial
			}
		} else if !c.NextRecoverAt.After(s.now()) {
			c.Garrison = initial
			c.NextRecoverAt = time.Time{}
		}
		if err := json.Unmarshal(lootRaw, &c.Loot); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// Defense loads the city at x,y with recovered garrison.
func (s *Service) Defense(ctx context.Context, serverID int32, x, y int) (*City, error) {
	cities, err := s.List(ctx, serverID)
	if err != nil {
		return nil, err
	}
	for i := range cities {
		if cities[i].X == x && cities[i].Y == y {
			if !cities[i].NextRecoverAt.IsZero() && !cities[i].NextRecoverAt.After(s.now()) {
				_ = s.recover(ctx, serverID, cities[i].CfgID)
			}
			return &cities[i], nil
		}
	}
	return nil, ErrNotFound
}

func (s *Service) recover(ctx context.Context, serverID int32, cfgID int32) error {
	_, err := s.pool.Exec(ctx, `UPDATE special_city_state st SET garrison=c.garrison,next_recover_at=NULL
		FROM cfg_special_city c WHERE st.server_id=$1 AND st.city_cfg_id=$2 AND c.city_cfg_id=st.city_cfg_id`,
		serverID, cfgID)
	return err
}

// AfterBattle persists defenders and transfers ownership on a guild win.
func (s *Service) AfterBattle(ctx context.Context, serverID int32, cfgID int32, attackerPlayerID int64, won bool, defenders []march.TroopStack) (bool, int64, error) {
	var guildID int64
	if err := s.pool.QueryRow(ctx, `SELECT COALESCE((SELECT guild_id FROM guild_member WHERE server_id=$1 AND player_id=$2),0)`,
		serverID, attackerPlayerID).Scan(&guildID); err != nil {
		return false, 0, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var initialRaw []byte
	var recovery int
	if err := tx.QueryRow(ctx, `SELECT garrison,recovery_seconds FROM cfg_special_city WHERE city_cfg_id=$1`, cfgID).
		Scan(&initialRaw, &recovery); err != nil {
		return false, 0, err
	}
	next := s.now().Add(time.Duration(recovery) * time.Second)
	captured := won && guildID > 0
	var payload []byte
	if won {
		if captured {
			payload = initialRaw
		} else {
			initial, err := decodeStacks(initialRaw)
			if err != nil {
				return false, 0, err
			}
			for i := range initial {
				initial[i].Count = initial[i].Count / 4
				if initial[i].Count == 0 {
					initial[i].Count = 1
				}
			}
			payload, err = json.Marshal(stacksToMap(initial))
			if err != nil {
				return false, 0, err
			}
		}
	} else {
		payload, err = json.Marshal(stacksToMap(defenders))
		if err != nil {
			return false, 0, err
		}
	}
	var owner any
	var occupied any
	if captured {
		owner = guildID
		occupied = s.now()
	} else {
		owner = nil
		occupied = nil
	}
	_, err = tx.Exec(ctx, `INSERT INTO special_city_state(server_id,city_cfg_id,owner_guild_id,garrison,occupied_at,next_recover_at)
		VALUES($1,$2,COALESCE($3,0),$4,$5,$6)
		ON CONFLICT (server_id,city_cfg_id) DO UPDATE SET
			owner_guild_id=CASE WHEN $3::bigint IS NULL THEN special_city_state.owner_guild_id ELSE $3 END,
			garrison=EXCLUDED.garrison,
			occupied_at=CASE WHEN $3::bigint IS NULL THEN special_city_state.occupied_at ELSE EXCLUDED.occupied_at END,
			next_recover_at=EXCLUDED.next_recover_at`,
		serverID, cfgID, owner, payload, occupied, next)
	if err != nil {
		return false, 0, err
	}
	if captured {
		if _, err := tx.Exec(ctx, `INSERT INTO player_special_capture(server_id,player_id,captures)
			VALUES($1,$2,1) ON CONFLICT (server_id,player_id)
			DO UPDATE SET captures=player_special_capture.captures+1`, serverID, attackerPlayerID); err != nil {
			return false, 0, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return false, 0, err
	}
	return captured, guildID, nil
}

// UnlockedUnits lists regional units available to the player's guild.
func (s *Service) UnlockedUnits(ctx context.Context, serverID int32, playerID int64) ([]int32, error) {
	rows, err := s.pool.Query(ctx, `SELECT c.unit_cfg_id FROM special_city_state st
		JOIN cfg_special_city c ON c.city_cfg_id=st.city_cfg_id
		JOIN guild_member m ON m.server_id=st.server_id AND m.guild_id=st.owner_guild_id
		WHERE st.server_id=$1 AND m.player_id=$2 AND st.owner_guild_id>0 AND c.unit_cfg_id IS NOT NULL
		ORDER BY c.unit_cfg_id`, serverID, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int32
	for rows.Next() {
		var id int32
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// Recruit directly enlists a regional unit into one of the player's cities.
func (s *Service) Recruit(ctx context.Context, serverID int32, playerID, cityID int64, unitCfgID, count int32) (int32, error) {
	if count <= 0 || count > 500 {
		return 0, ErrInsufficient
	}
	unlocked, err := s.UnlockedUnits(ctx, serverID, playerID)
	if err != nil {
		return 0, err
	}
	ok := false
	for _, id := range unlocked {
		if id == unitCfgID {
			ok = true
			break
		}
	}
	if !ok {
		return 0, ErrUnitLocked
	}
	spec, exists := march.DefaultUnitCatalog()[unitCfgID]
	if !exists {
		return 0, ErrUnitLocked
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var owner int64
	if err := tx.QueryRow(ctx, `SELECT player_id FROM player_city WHERE server_id=$1 AND city_id=$2 AND player_id=$3`,
		serverID, cityID, playerID).Scan(&owner); err != nil {
		return 0, ErrCityOwner
	}
	food := int64(spec.RecruitCost.Food) * int64(count)
	wood := int64(spec.RecruitCost.Wood) * int64(count)
	stone := int64(spec.RecruitCost.Stone) * int64(count)
	iron := int64(spec.RecruitCost.Iron) * int64(count)
	tag, err := tx.Exec(ctx, `UPDATE player_wallet SET food=food-$3,wood=wood-$4,stone=stone-$5,iron=iron-$6
		WHERE server_id=$1 AND player_id=$2 AND food>=$3 AND wood>=$4 AND stone>=$5 AND iron>=$6`,
		serverID, playerID, food, wood, stone, iron)
	if err != nil {
		return 0, err
	}
	if tag.RowsAffected() != 1 {
		return 0, ErrInsufficient
	}
	var total int32
	if err := tx.QueryRow(ctx, `INSERT INTO city_troop(server_id,city_id,unit_cfg_id,count,wounded)
		VALUES($1,$2,$3,$4,0) ON CONFLICT (server_id,city_id,unit_cfg_id)
		DO UPDATE SET count=city_troop.count+EXCLUDED.count RETURNING count`,
		serverID, cityID, unitCfgID, count).Scan(&total); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return total, nil
}

// Tax is a daily claim from special cities owned by the player's guild.
type Tax struct {
	Cities                        int32
	Food, Wood, Stone, Iron, Gold int64
}

// ClaimTax grants the daily special city tax once per player per day.
func (s *Service) ClaimTax(ctx context.Context, serverID int32, playerID int64) (*Tax, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var guildID int64
	if err := tx.QueryRow(ctx, `SELECT COALESCE((SELECT guild_id FROM guild_member WHERE server_id=$1 AND player_id=$2),0)`,
		serverID, playerID).Scan(&guildID); err != nil {
		return nil, err
	}
	if guildID == 0 {
		return nil, ErrNoGuild
	}
	rows, err := tx.Query(ctx, `SELECT c.city_type FROM special_city_state st
		JOIN cfg_special_city c ON c.city_cfg_id=st.city_cfg_id
		WHERE st.server_id=$1 AND st.owner_guild_id=$2`, serverID, guildID)
	if err != nil {
		return nil, err
	}
	var cities int32
	tax := &Tax{}
	for rows.Next() {
		var t int16
		if err := rows.Scan(&t); err != nil {
			rows.Close()
			return nil, err
		}
		cities++
		mult := int64(t)
		tax.Food += 500 * mult
		tax.Wood += 400 * mult
		tax.Stone += 200 * mult
		tax.Iron += 120 * mult
		tax.Gold += 20 * mult
	}
	rows.Close()
	if cities == 0 {
		return nil, ErrNoCity
	}
	tax.Cities = cities
	today := s.now().UTC().Format("2006-01-02")
	var claimed string
	err = tx.QueryRow(ctx, `INSERT INTO special_city_tax_claim(server_id,player_id,claim_date,cities,food,wood,stone,iron,gold)
		VALUES($1,$2,$3::date,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING claim_date::text`,
		serverID, playerID, today, tax.Cities, tax.Food, tax.Wood, tax.Stone, tax.Iron, tax.Gold).Scan(&claimed)
	if err == pgx.ErrNoRows {
		return nil, ErrAlreadyClaimed
	}
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET food=food+$3,wood=wood+$4,stone=stone+$5,iron=iron+$6,gold=gold+$7
		WHERE server_id=$1 AND player_id=$2`, serverID, playerID, tax.Food, tax.Wood, tax.Stone, tax.Iron, tax.Gold); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return tax, nil
}

func decodeStacks(raw []byte) ([]march.TroopStack, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var m map[string]int32
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	out := make([]march.TroopStack, 0, len(m))
	for id, count := range m {
		var unit int32
		if _, err := fmt.Sscanf(id, "%d", &unit); err != nil {
			return nil, err
		}
		if count > 0 {
			out = append(out, march.TroopStack{UnitCfgID: unit, Count: count})
		}
	}
	sortStacks(out)
	return out, nil
}

func stacksToMap(stacks []march.TroopStack) map[string]int32 {
	out := make(map[string]int32, len(stacks))
	for _, st := range stacks {
		if st.Count > 0 {
			out[fmt.Sprint(st.UnitCfgID)] = st.Count
		}
	}
	return out
}

func sortStacks(stacks []march.TroopStack) {
	for i := 1; i < len(stacks); i++ {
		for j := i; j > 0 && stacks[j].UnitCfgID < stacks[j-1].UnitCfgID; j-- {
			stacks[j], stacks[j-1] = stacks[j-1], stacks[j]
		}
	}
}
