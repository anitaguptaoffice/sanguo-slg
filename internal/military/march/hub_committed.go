package march

import (
	"cmp"
	"errors"
	"slices"
	"time"
)

var ErrMarchPublication = errors.New("march: cannot publish committed march")

// PublishCommittedMarch mirrors one confirmed MarchStore.Create in a restored
// Hub. The caller owns confirmation, its player/hero bindings and activation of
// the durable scheduler. A failure leaves the committed order recoverable.
func (h *Hub) PublishCommittedMarch(in MarchCreate, ids MarchIdentity) (*MarchOrder, error) {
	if h == nil || h.scheduler == nil || ids.MarchID <= 0 || ids.MarchID > marchIDCeiling ||
		ids.ArmyID <= 0 || ids.ArmyID > marchIDCeiling {
		return nil, ErrMarchPublication
	}
	in.DepartAt = in.DepartAt.UTC().Truncate(time.Microsecond)
	in.ArriveAt = in.ArriveAt.UTC().Truncate(time.Microsecond)
	if err := validateMarchCreate(in.ServerID, &in); err != nil {
		return nil, errors.Join(ErrMarchPublication, err)
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	_, hasBinding := h.marchCtx[ids.MarchID]
	if !h.restored || hasBinding || h.marches[ids.MarchID] != nil {
		return nil, ErrMarchPublication
	}
	troops, err := NormalizeMarchTroops(h.catalog, in.Troops)
	if err != nil {
		return nil, errors.Join(ErrMarchPublication, err)
	}
	slices.SortFunc(troops, func(a, b TroopStack) int { return cmp.Compare(a.UnitCfgID, b.UnitCfgID) })
	order := &MarchOrder{
		ID: ids.MarchID, ArmyID: ids.ArmyID,
		FromX: int(in.FromX), FromY: int(in.FromY), ToX: int(in.ToX), ToY: int(in.ToY),
		Purpose: in.Purpose, Phase: PhaseMarching, Speed: EffectiveMarchSpeed(h.catalog, troops),
		DepartAt: in.DepartAt, ArriveAt: in.ArriveAt,
	}
	heroID := int64(0)
	if len(in.HeroIDs) == 1 {
		heroID = in.HeroIDs[0]
	}
	h.marches[order.ID] = order
	h.marchCtx[order.ID] = marchRuntime{OriginCityID: in.OriginCityID, PlayerID: in.PlayerID, HeroID: heroID, Troops: troops}
	h.nextMarch = max(h.nextMarch, order.ID)
	arrival := Event{Kind: EventMarchArrive, DueAt: order.ArriveAt, RefID: order.ID, Handler: h.onMarchArrive}
	if h.restoreEv != nil {
		h.restoreEv = append(h.restoreEv, arrival)
	} else {
		h.scheduler.Schedule(arrival)
	}
	return cloneMarch(order), nil
}
