package march

import (
	"context"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

var (
	// ErrMarchControl reports an invalid recall/speedup target or state.
	ErrMarchControl = errors.New("march: control unavailable")
	// ErrMarchSpeedupStock reports an empty or missing speedup item.
	ErrMarchSpeedupStock = errors.New("march: no speedup item")
)

// ControlPhase mirrors march_order.status for the control paths.
const (
	ControlMarching  int16 = 1
	ControlArrived   int16 = 2
	ControlReturning int16 = 3
)

// ControlState is the durable view returned by recall/speedup.
type ControlState struct {
	MarchID      int64
	ArmyID       int64
	OriginCityID int64
	Status       int16
	DepartAt     time.Time
	ArriveAt     time.Time
	ReturnAt     time.Time
	ReducedSec   int64
}

// ControlStore owns the durable recall and speedup statements. It locks one
// march row, validates ownership and writes the new timing in one transaction.
type ControlStore struct {
	binding *recruittx.Binding
	profile freshsource.Profile
}

func NewControlStore(ctx context.Context, b *recruittx.Binding, p freshsource.Profile) (*ControlStore, error) {
	if ctx == nil || b == nil {
		return nil, ErrMarchControl
	}
	p, err := freshsource.Snapshot(p)
	if err != nil {
		return nil, errors.Join(ErrMarchControl, err)
	}
	return &ControlStore{binding: b, profile: p}, nil
}

func (c *ControlStore) table(name string) string {
	return pgx.Identifier{c.profile.SchemaName, name}.Sanitize()
}

func (c *ControlStore) load(ctx context.Context, a *recruittx.Access, serverID, playerID, marchID int64) (ControlState, error) {
	var state ControlState
	var owner int64
	var returnAt *time.Time
	err := a.Scan(ctx, c.binding, `
		SELECT o.march_id, o.army_id, COALESCE(o.origin_city_id,0), o.status, o.depart_at, o.arrive_at, o.return_finish_at, a.owner_player_id
		FROM `+c.table("march_order")+` o
		JOIN `+c.table("field_army")+` a ON a.server_id = o.server_id AND a.army_id = o.army_id
		WHERE o.server_id = $1 AND o.march_id = $2
		FOR UPDATE OF o`, []any{serverID, marchID},
		&state.MarchID, &state.ArmyID, &state.OriginCityID, &state.Status, &state.DepartAt, &state.ArriveAt, &returnAt, &owner)
	if err != nil {
		return state, err
	}
	if owner != playerID || state.MarchID != marchID {
		return state, ErrMarchControl
	}
	if returnAt != nil {
		state.ReturnAt = *returnAt
	}
	return state, nil
}

// ActiveCount counts one player's live marches (marching or returning).
func (c *ControlStore) ActiveCount(ctx context.Context, serverID, playerID int64) (count int64, err error) {
	if serverID <= 0 || playerID <= 0 {
		return 0, ErrMarchControl
	}
	txCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	owner, err := c.binding.Begin(txCtx)
	if err != nil {
		return 0, err
	}
	defer func() {
		clean, stop := context.WithTimeout(context.WithoutCancel(txCtx), 5*time.Second)
		defer stop()
		_ = owner.Rollback(clean)
	}()
	if err = owner.Access().Scan(txCtx, c.binding, `
		SELECT count(*) FROM `+c.table("march_order")+` o
		JOIN `+c.table("field_army")+` a ON a.server_id = o.server_id AND a.army_id = o.army_id
		WHERE o.server_id = $1 AND a.owner_player_id = $2 AND o.status IN (1,3)`,
		[]any{serverID, playerID}, &count); err != nil {
		return 0, err
	}
	return count, nil
}

// Recall starts the return leg. Marching troops turn back at now + elapsed;
// arrived/stationed troops use the original one-way duration.
func (c *ControlStore) Recall(ctx context.Context, serverID, playerID, marchID int64, now time.Time) (state ControlState, err error) {
	if serverID <= 0 || playerID <= 0 || marchID <= 0 || now.IsZero() {
		return state, ErrMarchControl
	}
	txCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	owner, err := c.binding.Begin(txCtx)
	if err != nil {
		return state, err
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		clean, stop := context.WithTimeout(context.WithoutCancel(txCtx), 5*time.Second)
		defer stop()
		if endErr := owner.Rollback(clean); endErr != nil && err == nil {
			state, err = ControlState{}, endErr
		}
	}()
	access := owner.Access()
	state, err = c.load(txCtx, access, serverID, playerID, marchID)
	if err != nil {
		return state, err
	}
	switch state.Status {
	case ControlReturning:
		return state, nil
	case ControlMarching:
		elapsed := now.Sub(state.DepartAt)
		if elapsed < time.Second {
			elapsed = time.Second
		}
		state.ReturnAt = now.Add(elapsed)
	case ControlArrived:
		oneWay := state.ArriveAt.Sub(state.DepartAt)
		if oneWay < time.Second {
			oneWay = time.Second
		}
		state.ReturnAt = now.Add(oneWay)
	default:
		return ControlState{}, ErrMarchControl
	}
	if _, err = access.Exec(txCtx, c.binding, `
		UPDATE `+c.table("march_order")+`
		SET status = 3, return_finish_at = $3
		WHERE server_id = $1 AND march_id = $2`,
		serverID, marchID, state.ReturnAt); err != nil {
		return ControlState{}, err
	}
	state.ReturnAt = state.ReturnAt.Truncate(time.Microsecond)
	state.Status = ControlReturning
	if _, err = access.Exec(txCtx, c.binding, `
		UPDATE `+c.table("march_order")+`
		SET return_finish_at = $3
		WHERE server_id = $1 AND march_id = $2`,
		serverID, marchID, state.ReturnAt); err != nil {
		return ControlState{}, err
	}
	if err = owner.Commit(txCtx); err != nil {
		return ControlState{}, err
	}
	committed = true
	return state, nil
}

// Speedup consumes one item and shortens the active arrival or return deadline.
// It never moves a deadline into the past.
func (c *ControlStore) Speedup(ctx context.Context, serverID, playerID, marchID int64, itemCfgID int32, sec int64, now time.Time) (state ControlState, err error) {
	if serverID <= 0 || playerID <= 0 || marchID <= 0 || itemCfgID <= 0 || sec <= 0 || now.IsZero() {
		return state, ErrMarchControl
	}
	txCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	owner, err := c.binding.Begin(txCtx)
	if err != nil {
		return state, err
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		clean, stop := context.WithTimeout(context.WithoutCancel(txCtx), 5*time.Second)
		defer stop()
		if endErr := owner.Rollback(clean); endErr != nil && err == nil {
			state, err = ControlState{}, endErr
		}
	}()
	access := owner.Access()
	state, err = c.load(txCtx, access, serverID, playerID, marchID)
	if err != nil {
		return state, err
	}
	if state.Status == ControlArrived {
		return ControlState{}, ErrMarchControl
	}
	var remaining int32
	if err = access.Scan(txCtx, c.binding, `
		UPDATE `+c.table("player_item")+`
		SET quantity = quantity - 1
		WHERE server_id = $1 AND player_id = $2 AND item_cfg_id = $3 AND quantity >= 1
		RETURNING quantity`,
		[]any{serverID, playerID, itemCfgID}, &remaining); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ControlState{}, ErrMarchSpeedupStock
		}
		return ControlState{}, err
	}
	deadline := state.ArriveAt
	column := "arrive_at"
	if state.Status == ControlReturning {
		deadline = state.ReturnAt
		column = "return_finish_at"
	}
	reduced := time.Duration(sec) * time.Second
	updated := deadline.Add(-reduced).Truncate(time.Microsecond)
	floor := now.Add(time.Second)
	if updated.Before(floor) {
		updated = floor
	}
	state.ReducedSec = int64(deadline.Sub(updated) / time.Second)
	if state.ReducedSec <= 0 {
		return ControlState{}, ErrMarchControl
	}
	if _, err = access.Exec(txCtx, c.binding, `
		UPDATE `+c.table("march_order")+`
		SET `+column+` = $3
		WHERE server_id = $1 AND march_id = $2`,
		serverID, marchID, updated); err != nil {
		return ControlState{}, err
	}
	if column == "arrive_at" {
		state.ArriveAt = updated
	} else {
		state.ReturnAt = updated
	}
	if err = owner.Commit(txCtx); err != nil {
		return ControlState{}, err
	}
	committed = true
	return state, nil
}
