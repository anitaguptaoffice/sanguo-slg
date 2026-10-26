package domestic

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrHotelLevelsUnavailable = errors.New("domestic: hotel levels transaction unavailable")

// HotelLevels preserves the hotel API's persisted MAX(level) aggregation.
type HotelLevels struct{ Hotel, Office int32 }

// HotelLevelPort captures startup-only persistence wiring, never cached cities.
// Fields are private so changing PGStore.Pool cannot retarget a bound port.
type HotelLevelPort struct {
	hub      *Hub
	store    *PGStore
	pool     *pgxpool.Pool
	serverID int32
}

// HotelLevelsPort must be obtained during startup, after UseStore. Persistence
// wiring must not change concurrently with requests (the same rule as UseStore).
func (h *Hub) HotelLevelsPort() *HotelLevelPort {
	if h == nil || h.store == nil || h.store.Pool == nil || h.serverID <= 0 {
		return nil
	}
	return &HotelLevelPort{hub: h, store: h.store, pool: h.store.Pool, serverID: h.serverID}
}

// Supports binds the coordinator's exact pool/schema and shard without a Hub
// lock. Replaced stores, retargeted pools and memory-only wiring fail closed.
func (p *HotelLevelPort) Supports(pool *pgxpool.Pool, serverID int32) bool {
	return p != nil && pool != nil && p.pool == pool && serverID > 0 && p.serverID == serverID &&
		p.hub != nil && p.hub.store == p.store && p.hub.SupportsAtomicCityCreation(pool, serverID)
}

// LevelsInTx reads only city_building through the supplied transaction. The
// coordinator must first check Supports, begin on that pool, lock the existing
// actor and wallet, then authorize/lock the city FOR UPDATE through WORLD.
// No ownership proof or lock acquisition is implicit here. In particular, do
// not enter Hub operations while holding the wallet: DOM writers lock Hub first.
// Missing buildings return zero, preserving the existing not-built behavior.
func (p *HotelLevelPort) LevelsInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID int64) (HotelLevels, error) {
	if p == nil || !p.Supports(p.pool, serverID) || tx == nil || cityID <= 0 {
		return HotelLevels{}, ErrHotelLevelsUnavailable
	}
	var levels HotelLevels
	// Existing hotel cfg 8 and hero-office cfg 1; FILTER preserves MAX even for
	// malformed negative levels instead of silently introducing a zero floor.
	err := tx.QueryRow(ctx, `SELECT
		COALESCE(MAX(level) FILTER (WHERE building_cfg_id=8),0),
		COALESCE(MAX(level) FILTER (WHERE building_cfg_id=1),0)
		FROM city_building WHERE server_id=$1 AND city_id=$2`, serverID, cityID).
		Scan(&levels.Hotel, &levels.Office)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return HotelLevels{}, ctxErr
		}
		if errors.Is(err, context.Canceled) {
			return HotelLevels{}, context.Canceled
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return HotelLevels{}, context.DeadlineExceeded
		}
		return HotelLevels{}, ErrHotelLevelsUnavailable
	}
	return levels, nil
}
