package domestic

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrAtomicCityCreation = errors.New("domestic: invalid or unavailable atomic city creation")

// NewCityWorldParticipant must validate and INSERT the world city using only tx.
// It must not manage transaction lifecycle, use a pool, or re-enter this Hub.
type NewCityWorldParticipant func(context.Context, pgx.Tx) (int64, error)

// SupportsAtomicCityCreation binds API authentication and creation to one pool.
// Like UseStore, persistence wiring is immutable after startup; this reads only
// that wiring, not mutable city state, and never waits for the Hub operation lock.
func (h *Hub) SupportsAtomicCityCreation(pool *pgxpool.Pool, serverID int32) bool {
	return h != nil && pool != nil && h.store != nil && h.store.Pool == pool && h.serverID == serverID
}

// CreateNewCity owns Hub -> wallet -> world -> checkpoint locking and one commit.
// initial is a trusted server template, never an existing-city recovery request.
// A commit error can be unknown; callers must not infer absence or blindly retry.
// The input remains unchanged, and state/scheduler publish only after commit.
func (h *Hub) CreateNewCity(ctx context.Context, serverID int32, initial *CityState, insertWorld NewCityWorldParticipant) (int64, error) {
	if h == nil || initial == nil || initial.ID != 0 || initial.PlayerID <= 0 || serverID <= 0 || insertWorld == nil {
		return 0, ErrAtomicCityCreation
	}
	if err := h.lockCreation(ctx); err != nil {
		return 0, err
	}
	defer h.mu.Unlock()
	if h.store == nil || h.store.Pool == nil || h.serverID != serverID {
		return 0, ErrAtomicCityCreation
	}
	for _, b := range initial.Buildings {
		if b == nil {
			return 0, ErrAtomicCityCreation
		}
	}
	for _, job := range initial.BuildJobs {
		if job == nil {
			return 0, ErrAtomicCityCreation
		}
	}
	work, now := cloneCity(initial), h.now()
	work.LastSettleAt, work.productionRemainder = now, [4]int64{}
	work.walletBase, work.walletSaved = Resources{}, false
	participant := func(ctx context.Context, tx pgx.Tx) (int64, error) {
		id, err := insertWorld(ctx, tx)
		if err == nil {
			if _, exists := h.cities[id]; exists {
				return 0, ErrCityAlreadyRegistered
			}
		}
		return id, err
	}
	if err := h.store.saveCityWithWorld(ctx, serverID, work, h.cat, now, nil, true, participant); err != nil {
		return 0, err
	}
	h.registerCityLocked(work)
	return work.ID, nil
}

func (h *Hub) lockCreation(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if ctx.Done() == nil {
		h.mu.Lock()
		return nil
	}
	tick := time.NewTicker(time.Millisecond)
	defer tick.Stop()
	for {
		if h.mu.TryLock() {
			if err := ctx.Err(); err != nil {
				h.mu.Unlock()
				return err
			}
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-tick.C:
		}
	}
}
