package hero

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrEquipmentUnavailable = errors.New("hero: equipment unavailable")
	ErrEquipmentOwner       = errors.New("hero: equipment owner mismatch")
	ErrEquipmentSlot        = errors.New("hero: equipment slot mismatch")
	ErrEquipmentLevel       = errors.New("hero: building level too low")
	ErrEquipmentGold        = errors.New("hero: insufficient gold")
	ErrEquipmentIron        = errors.New("hero: insufficient iron")
	ErrEquipmentMax         = errors.New("hero: equipment already maxed")
	ErrEquipmentSockets     = errors.New("hero: no free socket")
	ErrEquipmentGem         = errors.New("hero: unknown gem")
	ErrEquipmentMount       = errors.New("hero: not a mount")
)

// Equipment is one forged instance with its effective attributes.
type Equipment struct {
	ID           int64
	CfgID        int32
	SlotType     int32
	Tier         int32
	Name         string
	EnhanceLevel int32
	MaxEnhance   int32
	Sockets      int32
	Gems         []int32
	Force        int32
	Intel        int32
	Politics     int32
	Command      int32
	SpeedPct     int32
	Equipped     bool
	HeroID       int64
}

// EquipmentService owns forging, enhancement, sockets and mounting.
type EquipmentService struct {
	Pool *pgxpool.Pool
	Now  func() time.Time
}

func NewEquipment(pool *pgxpool.Pool, now func() time.Time) *EquipmentService {
	if now == nil {
		now = time.Now
	}
	return &EquipmentService{Pool: pool, Now: now}
}

type equipmentCfg struct {
	cfgID                                     int32
	slot, tier                                int32
	name                                      string
	force, intel, politics, command, speedPct int32
	forgeGold, forgeIron, enhanceGold         int64
	maxEnhance, sockets                       int32
}

func (e *EquipmentService) config(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, cfgID int32) (equipmentCfg, error) {
	var c equipmentCfg
	err := q.QueryRow(ctx, `SELECT cfg_id,slot_type,tier,name,force,intel,politics,command,speed_pct,
		forge_gold,forge_iron,enhance_gold,max_enhance,sockets FROM cfg_equipment WHERE cfg_id=$1`, cfgID).
		Scan(&c.cfgID, &c.slot, &c.tier, &c.name, &c.force, &c.intel, &c.politics, &c.command,
			&c.speedPct, &c.forgeGold, &c.forgeIron, &c.enhanceGold, &c.maxEnhance, &c.sockets)
	return c, err
}

func effectiveEquipment(c equipmentCfg, id, heroID int64, enhance int32, gems []int32, equipped bool) Equipment {
	out := Equipment{ID: id, CfgID: c.cfgID, SlotType: c.slot, Tier: c.tier, Name: c.name,
		EnhanceLevel: enhance, MaxEnhance: c.maxEnhance, Sockets: c.sockets, Gems: gems,
		Force: c.force, Intel: c.intel, Politics: c.politics, Command: c.command,
		SpeedPct: c.speedPct, Equipped: equipped, HeroID: heroID}
	bonus := c.tier * enhance
	switch c.slot {
	case 2:
		out.Force += bonus
	case 0, 1:
		out.Command += bonus
	case 3:
		out.Force += enhance
		out.SpeedPct += enhance
	case 4:
		out.Force += enhance
		out.Intel += enhance
		out.Politics += enhance
	}
	for _, gemID := range gems {
		var g struct{ force, intel, politics, command int32 }
		if err := equipmentGemAttrs(gemID, &g); err != nil {
			continue
		}
		out.Force += g.force
		out.Intel += g.intel
		out.Politics += g.politics
		out.Command += g.command
	}
	return out
}

// gemAttrs is installed at construction from the database-backed gem catalog.
// A package-level cache keeps effectiveEquipment pure for repeated views.
var gemCatalog = map[int32]struct{ force, intel, politics, command int32 }{}
var gemGuard struct {
	sync.Mutex
	loaded bool
	err    error
}

func equipmentGemAttrs(id int32, out *struct{ force, intel, politics, command int32 }) error {
	g, ok := gemCatalog[id]
	if !ok {
		return ErrEquipmentGem
	}
	*out = g
	return nil
}

func (e *EquipmentService) loadGems(ctx context.Context, tx pgx.Tx) error {
	gemGuard.Lock()
	defer gemGuard.Unlock()
	if gemGuard.loaded {
		return gemGuard.err
	}
	rows, err := tx.Query(ctx, `SELECT gem_cfg_id,force,intel,politics,command FROM cfg_gem`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id int32
		var g struct{ force, intel, politics, command int32 }
		if err := rows.Scan(&id, &g.force, &g.intel, &g.politics, &g.command); err != nil {
			return err
		}
		gemCatalog[id] = g
	}
	gemGuard.loaded, gemGuard.err = true, rows.Err()
	return gemGuard.err
}

func (e *EquipmentService) levels(ctx context.Context, tx pgx.Tx, serverID int32, cityID int64) (blacksmith, stable int32, err error) {
	err = tx.QueryRow(ctx, `SELECT
		COALESCE((SELECT MAX(level) FROM city_building WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=13),0),
		COALESCE((SELECT MAX(level) FROM city_building WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=15),0)`,
		serverID, cityID).Scan(&blacksmith, &stable)
	return
}

func scanEquipment(row pgx.Row) (Equipment, error) {
	var out Equipment
	var gemsRaw []byte
	var heroID *int64
	err := row.Scan(&out.ID, &out.CfgID, &out.SlotType, &out.Name, &out.EnhanceLevel,
		&out.MaxEnhance, &out.Sockets, &gemsRaw, &out.Force, &out.Intel, &out.Politics,
		&out.Command, &out.SpeedPct, &out.Tier, &heroID)
	if err != nil {
		return out, err
	}
	out.Equipped = heroID != nil
	if heroID != nil {
		out.HeroID = *heroID
	}
	if len(gemsRaw) > 0 {
		_ = json.Unmarshal(gemsRaw, &out.Gems)
	}
	return out, nil
}

const equipmentSelect = `SELECT e.equipment_id,e.cfg_id,c.slot_type,c.name,e.enhance_level,c.max_enhance,
	c.sockets,e.gems::text,c.force,c.intel,c.politics,c.command,c.speed_pct,c.tier,h.hero_id
	FROM player_equipment e JOIN cfg_equipment c ON c.cfg_id=e.cfg_id
	LEFT JOIN hero_equipment h ON h.server_id=e.server_id AND h.equipment_id=e.equipment_id`

func (e *EquipmentService) List(ctx context.Context, serverID int32, playerID, heroID, cityID int64) (equipped, inventory []Equipment, blacksmith, stable int32, err error) {
	if e == nil || e.Pool == nil {
		return nil, nil, 0, 0, ErrEquipmentUnavailable
	}
	tx, err := e.Pool.Begin(ctx)
	if err != nil {
		return nil, nil, 0, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err = e.loadGems(ctx, tx); err != nil {
		return nil, nil, 0, 0, err
	}
	blacksmith, stable, err = e.levels(ctx, tx, serverID, cityID)
	if err != nil {
		return nil, nil, 0, 0, err
	}
	rows, err := tx.Query(ctx, equipmentSelect+` WHERE e.server_id=$1 AND e.player_id=$2 AND h.hero_id IS NOT NULL ORDER BY c.slot_type`, serverID, playerID)
	if err != nil {
		return nil, nil, 0, 0, err
	}
	for rows.Next() {
		item, err := scanEquipment(rows)
		if err != nil {
			rows.Close()
			return nil, nil, 0, 0, err
		}
		equipped = append(equipped, item)
	}
	if err = rows.Err(); err != nil {
		return nil, nil, 0, 0, err
	}
	rows.Close()
	rows, err = tx.Query(ctx, equipmentSelect+` WHERE e.server_id=$1 AND e.player_id=$2 AND h.hero_id IS NULL ORDER BY c.slot_type,c.tier DESC,e.equipment_id`, serverID, playerID)
	if err != nil {
		return nil, nil, 0, 0, err
	}
	for rows.Next() {
		item, err := scanEquipment(rows)
		if err != nil {
			rows.Close()
			return nil, nil, 0, 0, err
		}
		inventory = append(inventory, item)
	}
	if err = rows.Err(); err != nil {
		return nil, nil, 0, 0, err
	}
	return equipped, inventory, blacksmith, stable, tx.Commit(ctx)
}

func (e *EquipmentService) owner(ctx context.Context, tx pgx.Tx, serverID int32, playerID, heroID int64) error {
	if heroID <= 0 {
		return nil
	}
	var owner int64
	err := tx.QueryRow(ctx, `SELECT player_id FROM player_hero WHERE server_id=$1 AND hero_id=$2`, serverID, heroID).Scan(&owner)
	if err != nil {
		return err
	}
	if owner != playerID {
		return ErrEquipmentOwner
	}
	return nil
}

func (e *EquipmentService) Forge(ctx context.Context, serverID int32, playerID, cityID int64, slotType, tier int32) (Equipment, int64, error) {
	if slotType < 0 || slotType > 4 || tier < 1 || tier > 3 {
		return Equipment{}, 0, ErrEquipmentUnavailable
	}
	cfgID := (slotType+1)*100 + tier
	tx, err := e.Pool.Begin(ctx)
	if err != nil {
		return Equipment{}, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	cfg, err := e.config(ctx, tx, cfgID)
	if err != nil {
		return Equipment{}, 0, ErrEquipmentUnavailable
	}
	blacksmith, _, err := e.levels(ctx, tx, serverID, cityID)
	if err != nil {
		return Equipment{}, 0, err
	}
	if blacksmith < tier {
		return Equipment{}, 0, ErrEquipmentLevel
	}
	gold, err := e.debitWallet(ctx, tx, serverID, playerID, cfg.forgeGold, cfg.forgeIron)
	if err != nil {
		return Equipment{}, 0, err
	}
	var id int64
	if err := tx.QueryRow(ctx, `INSERT INTO player_equipment(server_id,player_id,cfg_id) VALUES($1,$2,$3) RETURNING equipment_id`,
		serverID, playerID, cfgID).Scan(&id); err != nil {
		return Equipment{}, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Equipment{}, 0, err
	}
	return effectiveEquipment(cfg, id, 0, 0, nil, false), gold, nil
}

func (e *EquipmentService) debitWallet(ctx context.Context, tx pgx.Tx, serverID int32, playerID, gold, iron int64) (int64, error) {
	var haveGold, haveIron int64
	if err := tx.QueryRow(ctx, `SELECT gold,iron FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`,
		serverID, playerID).Scan(&haveGold, &haveIron); err != nil {
		return 0, err
	}
	if haveGold < gold {
		return 0, ErrEquipmentGold
	}
	if haveIron < iron {
		return 0, ErrEquipmentIron
	}
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold-$3,iron=iron-$4 WHERE server_id=$1 AND player_id=$2`,
		serverID, playerID, gold, iron); err != nil {
		return 0, err
	}
	return haveGold - gold, nil
}

func (e *EquipmentService) item(ctx context.Context, tx pgx.Tx, serverID int32, playerID, equipmentID int64, lock bool) (Equipment, equipmentCfg, error) {
	q := equipmentSelect + ` WHERE e.server_id=$1 AND e.player_id=$2 AND e.equipment_id=$3`
	if lock {
		q += ` FOR UPDATE OF e`
	}
	item, err := scanEquipment(tx.QueryRow(ctx, q, serverID, playerID, equipmentID))
	if err != nil {
		return Equipment{}, equipmentCfg{}, ErrEquipmentOwner
	}
	cfg, err := e.config(ctx, tx, item.CfgID)
	return item, cfg, err
}

func (e *EquipmentService) Enhance(ctx context.Context, serverID int32, playerID, cityID, equipmentID int64) (Equipment, int64, error) {
	tx, err := e.Pool.Begin(ctx)
	if err != nil {
		return Equipment{}, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	item, cfg, err := e.item(ctx, tx, serverID, playerID, equipmentID, true)
	if err != nil {
		return Equipment{}, 0, err
	}
	blacksmith, _, err := e.levels(ctx, tx, serverID, cityID)
	if err != nil {
		return Equipment{}, 0, err
	}
	if blacksmith < cfg.tier {
		return Equipment{}, 0, ErrEquipmentLevel
	}
	if item.EnhanceLevel >= cfg.maxEnhance {
		return Equipment{}, 0, ErrEquipmentMax
	}
	gold, err := e.debitWallet(ctx, tx, serverID, playerID, cfg.enhanceGold, 0)
	if err != nil {
		return Equipment{}, 0, err
	}
	if err := tx.QueryRow(ctx, `UPDATE player_equipment SET enhance_level=enhance_level+1
		WHERE server_id=$1 AND equipment_id=$2 RETURNING enhance_level`, serverID, equipmentID).Scan(&item.EnhanceLevel); err != nil {
		return Equipment{}, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Equipment{}, 0, err
	}
	return effectiveEquipment(cfg, item.ID, item.HeroID, item.EnhanceLevel, item.Gems, item.Equipped), gold, nil
}

func (e *EquipmentService) Socket(ctx context.Context, serverID int32, playerID, cityID, equipmentID int64, gemID int32) (Equipment, int64, error) {
	tx, err := e.Pool.Begin(ctx)
	if err != nil {
		return Equipment{}, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := e.loadGems(ctx, tx); err != nil {
		return Equipment{}, 0, err
	}
	if _, ok := gemCatalog[gemID]; !ok {
		return Equipment{}, 0, ErrEquipmentGem
	}
	item, cfg, err := e.item(ctx, tx, serverID, playerID, equipmentID, true)
	if err != nil {
		return Equipment{}, 0, err
	}
	if len(item.Gems) >= int(cfg.sockets) {
		return Equipment{}, 0, ErrEquipmentSockets
	}
	var gemTier int32
	var gemGold int64
	if err := tx.QueryRow(ctx, `SELECT tier,gold FROM cfg_gem WHERE gem_cfg_id=$1`, gemID).Scan(&gemTier, &gemGold); err != nil {
		return Equipment{}, 0, ErrEquipmentGem
	}
	blacksmith, _, err := e.levels(ctx, tx, serverID, cityID)
	if err != nil {
		return Equipment{}, 0, err
	}
	if blacksmith < gemTier {
		return Equipment{}, 0, ErrEquipmentLevel
	}
	gold, err := e.debitWallet(ctx, tx, serverID, playerID, gemGold, 0)
	if err != nil {
		return Equipment{}, 0, err
	}
	var gemsRaw []byte
	if err := tx.QueryRow(ctx, `UPDATE player_equipment SET gems=gems || to_jsonb($3::int)
		WHERE server_id=$1 AND equipment_id=$2 RETURNING gems::text`, serverID, equipmentID, gemID).Scan(&gemsRaw); err != nil {
		return Equipment{}, 0, err
	}
	if err := json.Unmarshal(gemsRaw, &item.Gems); err != nil {
		return Equipment{}, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Equipment{}, 0, err
	}
	return effectiveEquipment(cfg, item.ID, item.HeroID, item.EnhanceLevel, item.Gems, item.Equipped), gold, nil
}

func (e *EquipmentService) Equip(ctx context.Context, serverID int32, playerID, heroID, cityID, equipmentID int64) ([]Equipment, error) {
	tx, err := e.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := e.owner(ctx, tx, serverID, playerID, heroID); err != nil {
		return nil, err
	}
	item, cfg, err := e.item(ctx, tx, serverID, playerID, equipmentID, true)
	if err != nil {
		return nil, err
	}
	if item.Equipped && item.HeroID != heroID {
		return nil, ErrEquipmentOwner
	}
	if _, err := tx.Exec(ctx, `DELETE FROM hero_equipment WHERE server_id=$1 AND (equipment_id=$2 OR (hero_id=$3 AND slot_type=$4))`,
		serverID, equipmentID, heroID, cfg.slot); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO hero_equipment(server_id,hero_id,slot_type,equipment_id) VALUES($1,$2,$3,$4)`,
		serverID, heroID, cfg.slot, equipmentID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	equipped, _, _, _, err := e.List(ctx, serverID, playerID, heroID, cityID)
	return equipped, err
}

func (e *EquipmentService) Unequip(ctx context.Context, serverID int32, playerID, heroID, cityID int64, slotType int32) ([]Equipment, error) {
	tx, err := e.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := e.owner(ctx, tx, serverID, playerID, heroID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM hero_equipment WHERE server_id=$1 AND hero_id=$2 AND slot_type=$3`,
		serverID, heroID, slotType); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	equipped, _, _, _, err := e.List(ctx, serverID, playerID, heroID, cityID)
	return equipped, err
}

func (e *EquipmentService) TrainMount(ctx context.Context, serverID int32, playerID, cityID, equipmentID int64) (Equipment, int64, error) {
	tx, err := e.Pool.Begin(ctx)
	if err != nil {
		return Equipment{}, 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	item, cfg, err := e.item(ctx, tx, serverID, playerID, equipmentID, true)
	if err != nil {
		return Equipment{}, 0, err
	}
	if cfg.slot != 3 {
		return Equipment{}, 0, ErrEquipmentMount
	}
	_, stable, err := e.levels(ctx, tx, serverID, cityID)
	if err != nil {
		return Equipment{}, 0, err
	}
	if stable < cfg.tier {
		return Equipment{}, 0, ErrEquipmentLevel
	}
	if item.EnhanceLevel >= cfg.maxEnhance {
		return Equipment{}, 0, ErrEquipmentMax
	}
	gold, err := e.debitWallet(ctx, tx, serverID, playerID, cfg.enhanceGold, 0)
	if err != nil {
		return Equipment{}, 0, err
	}
	if err := tx.QueryRow(ctx, `UPDATE player_equipment SET enhance_level=enhance_level+1
		WHERE server_id=$1 AND equipment_id=$2 RETURNING enhance_level`, serverID, equipmentID).Scan(&item.EnhanceLevel); err != nil {
		return Equipment{}, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Equipment{}, 0, err
	}
	return effectiveEquipment(cfg, item.ID, item.HeroID, item.EnhanceLevel, item.Gems, item.Equipped), gold, nil
}
