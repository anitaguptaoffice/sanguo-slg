package march

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrMarchRestore = errors.New("march: invalid durable march state")

type (
	// RestoredMarch is the API binding data for one live march; HeroIDs is the full list.
	RestoredMarch struct {
		ServerID                                int32
		PlayerID, OriginCityID, ArmyID, MarchID int64
		HeroIDs                                 []int64
	}
	// HeroRelease names a claimed hero (status=3) with no live army reference.
	HeroRelease struct {
		ServerID         int32
		PlayerID, HeroID int64
	}
	RestoreResult struct {
		Marches []RestoredMarch
		Release []HeroRelease
	}
	// MarchRestore reads one repeatable-read, read-only snapshot; it never writes.
	MarchRestore struct {
		pool    *pgxpool.Pool
		profile freshsource.Profile
	}
	// restoreRow mirrors the joined SELECT column order.
	restoreRow struct {
		ID, ArmyID, Status, FromX, FromY, ToX, ToY, Purpose int64
		DepartAt, ArriveAt                                  time.Time
		ReturnAt                                            *time.Time
		Origin, Owner, ArmyStatus                           *int64
		Heroes                                              []int64
	}
	restoreTroop struct{ ArmyID, Unit, Count int64 }
	restoreHero  struct{ HeroID, Player, Status int64 }
)

func NewMarchRestore(ctx context.Context, pool *pgxpool.Pool, p freshsource.Profile) (*MarchRestore, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || pool == nil || strings.HasPrefix(p.SchemaName, "pg_") || p.SchemaName == "information_schema" {
		return nil, ErrMarchRestore
	}
	return &MarchRestore{pool: pool, profile: p}, nil
}

// Restore validates the whole snapshot before publishing any Hub state. Events
// are staged, not scheduled: the caller must bind RestoreResult and then call
// Hub.ActivateRestore before it starts the scheduler.
func (r *MarchRestore) Restore(ctx context.Context, h *Hub) (RestoreResult, error) {
	if r == nil || r.pool == nil || ctx == nil || h == nil {
		return RestoreResult{}, ErrMarchRestore
	}
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return RestoreResult{}, errors.Join(ErrMarchRestore, err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	table := func(name string) string { return pgx.Identifier{r.profile.SchemaName, name}.Sanitize() }
	var orders []restoreRow
	var troops []restoreTroop
	var heroes []restoreHero
	var orphans int64
	if orders, err = readRestoreRows[restoreRow](ctx, tx, `SELECT o.march_id,o.army_id,o.status,o.from_x,o.from_y,o.to_x,o.to_y,o.purpose,o.depart_at,o.arrive_at,o.return_finish_at,o.origin_city_id,a.owner_player_id,a.status,a.hero_ids FROM `+table("march_order")+` o LEFT JOIN `+table("field_army")+` a ON a.server_id=o.server_id AND a.army_id=o.army_id WHERE o.server_id=$1 ORDER BY o.march_id`, r.profile.ServerID); err != nil {
		return RestoreResult{}, errors.Join(ErrMarchRestore, err)
	}
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM `+table("field_army")+` a WHERE a.server_id=$1 AND a.status<>1 AND NOT EXISTS (SELECT 1 FROM `+table("march_order")+` o WHERE o.server_id=a.server_id AND o.army_id=a.army_id AND o.status IN (1,3))`, r.profile.ServerID).Scan(&orphans); err != nil {
		return RestoreResult{}, errors.Join(ErrMarchRestore, err)
	}
	if troops, err = readRestoreRows[restoreTroop](ctx, tx, `SELECT army_id,unit_cfg_id,count FROM `+table("army_troop")+` WHERE server_id=$1 ORDER BY army_id,unit_cfg_id`, r.profile.ServerID); err != nil {
		return RestoreResult{}, errors.Join(ErrMarchRestore, err)
	}
	if heroes, err = readRestoreRows[restoreHero](ctx, tx, `SELECT hero_id,player_id,status FROM `+table("player_hero")+` WHERE server_id=$1 ORDER BY hero_id`, r.profile.ServerID); err != nil {
		return RestoreResult{}, errors.Join(ErrMarchRestore, err)
	}
	result, items, stacks, err := validateRestore(r.profile.ServerID, DefaultUnitCatalog(), orders, troops, heroes, orphans)
	if err != nil {
		return RestoreResult{}, err
	}
	if err := installRestore(h, items, stacks); err != nil {
		return RestoreResult{}, err
	}
	return result, nil
}

func readRestoreRows[T any](ctx context.Context, tx pgx.Tx, sql string, args ...any) ([]T, error) {
	rows, err := tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[T])
}

func validateRestore(server int32, catalog map[int32]UnitSpec, orders []restoreRow, troops []restoreTroop, heroes []restoreHero, orphans int64) (RestoreResult, []restoreRow, map[int64][]TroopStack, error) {
	fail := func() (RestoreResult, []restoreRow, map[int64][]TroopStack, error) {
		return RestoreResult{}, nil, nil, ErrMarchRestore
	}
	if server <= 0 || len(catalog) == 0 || orphans != 0 {
		return fail()
	}
	stacks := make(map[int64][]TroopStack, len(troops))
	for _, t := range troops {
		stacks[t.ArmyID] = append(stacks[t.ArmyID], TroopStack{UnitCfgID: int32(t.Unit), Count: int32(t.Count)})
	}
	byID := make(map[int64]restoreHero, len(heroes))
	for _, h := range heroes {
		byID[h.HeroID] = h
	}
	var result RestoreResult
	var items []restoreRow
	claimed := make(map[int64]bool)
	seenArmy := make(map[int64]bool, len(orders))
	for _, o := range orders {
		if o.Status == 4 {
			continue
		}
		if o.Status != 1 && o.Status != 3 {
			return fail()
		}
		if o.ID <= 0 || o.ArmyID <= 0 || o.Origin == nil || *o.Origin <= 0 || o.Purpose < 1 || o.Purpose > 3 ||
			!validMarchTime(o.DepartAt) || !validMarchTime(o.ArriveAt) || !o.DepartAt.Before(o.ArriveAt) ||
			o.Owner == nil || *o.Owner <= 0 || o.ArmyStatus == nil || (*o.ArmyStatus != 2 && *o.ArmyStatus != 3) || seenArmy[o.ArmyID] {
			return fail()
		}
		seenArmy[o.ArmyID] = true
		if o.Status == 1 {
			if o.ReturnAt != nil && !o.ReturnAt.IsZero() {
				return fail()
			}
		} else if o.ReturnAt == nil || !validMarchTime(*o.ReturnAt) || !o.ReturnAt.After(o.ArriveAt) {
			return fail()
		}
		st := stacks[o.ArmyID]
		if len(st) == 0 || len(o.Heroes) == 0 {
			return fail()
		}
		units := make(map[int32]bool, len(st))
		for _, stack := range st {
			if _, known := catalog[stack.UnitCfgID]; stack.Count <= 0 || !known || units[stack.UnitCfgID] {
				return fail()
			}
			units[stack.UnitCfgID] = true
		}
		seen := make(map[int64]bool, len(o.Heroes))
		for _, id := range o.Heroes {
			if id <= 0 || seen[id] {
				return fail()
			}
			seen[id] = true
			if claimed[id] {
				return fail()
			}
			h, ok := byID[id]
			if !ok || h.Player != *o.Owner || h.Status != 3 {
				return fail()
			}
			claimed[id] = true
		}
		result.Marches = append(result.Marches, RestoredMarch{
			ServerID: server, PlayerID: *o.Owner, OriginCityID: *o.Origin,
			ArmyID: o.ArmyID, MarchID: o.ID, HeroIDs: append([]int64(nil), o.Heroes...),
		})
		items = append(items, o)
	}
	for _, h := range heroes {
		if h.Status == 3 && !claimed[h.HeroID] {
			if h.HeroID <= 0 || h.Player <= 0 {
				return fail()
			}
			result.Release = append(result.Release, HeroRelease{ServerID: server, PlayerID: h.Player, HeroID: h.HeroID})
		}
	}
	return result, items, stacks, nil
}
