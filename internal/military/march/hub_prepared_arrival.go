package march

import (
	"context"
	"time"
)

// SetPreparedMarchArrivalHandler installs the durable resolver before activation.
// A prepared Hub requires durable return credit and accepts committed departures only.
func (h *Hub) SetPreparedMarchArrivalHandler(resolve MarchArrivalHandler) error {
	if h == nil || resolve == nil {
		return ErrMarchTransition
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.restored || h.restoreEv == nil || h.onDurableReturn == nil || h.onPreparedArrival != nil {
		return ErrMarchTransition
	}
	h.onPreparedArrival = resolve
	h.preparedArrivals = make(map[int64]struct{})
	return nil
}

func (h *Hub) onPreparedMarchArrival(event Event, resolve MarchArrivalHandler) {
	h.mu.Lock()
	order := h.marches[event.RefID]
	rt, bound := h.marchCtx[event.RefID]
	_, running := h.preparedArrivals[event.RefID]
	if order == nil || order.Phase != PhaseMarching || !order.ArriveAt.Equal(event.DueAt) ||
		!bound || rt.PlayerID <= 0 || running || h.arrivalErrors[event.RefID] != nil {
		h.mu.Unlock()
		return
	}
	arrived := *order
	_ = MarkArrived(&arrived)
	candidate := MarchArrivalEvent{MarchID: order.ID, PlayerID: rt.PlayerID, Order: arrived, Troops: cloneStacks(rt.Troops)}
	h.preparedArrivals[event.RefID] = struct{}{}
	h.mu.Unlock()

	out, err := h.resolvePreparedArrival(resolve, candidate)
	h.mu.Lock()
	delete(h.preparedArrivals, event.RefID)
	if h.marches[event.RefID] != order || order.Phase != PhaseMarching {
		h.mu.Unlock()
		return
	}
	if err == nil {
		err = h.confirmPreparedArrival(&arrived, rt, out)
	}
	if err != nil {
		if h.arrivalErrors == nil {
			h.arrivalErrors = make(map[int64]error)
		}
		h.arrivalErrors[event.RefID] = err
		h.mu.Unlock()
		return
	}
	arrived.LastReportID = out.ReportID
	rt.Troops = cloneStacks(out.RemainingTroops)
	h.marchCtx[event.RefID] = rt
	h.marches[event.RefID] = &arrived
	finished := h.onFinished
	if arrived.Phase == PhaseReturning {
		h.scheduler.Schedule(Event{Kind: EventMarchReturnDone, DueAt: arrived.ReturnFinishAt, RefID: arrived.ID, Handler: h.onMarchReturn})
		finished = nil
	}
	h.mu.Unlock()
	if finished != nil {
		finished(event.RefID)
	}
}

// Serialize prepared resolutions for the shared defender garrisons while keeping
// Hub reads available throughout the resolver's transaction.
func (h *Hub) resolvePreparedArrival(resolve MarchArrivalHandler, event MarchArrivalEvent) (MarchArrivalOutcome, error) {
	h.arrivalResolverMu.Lock()
	defer h.arrivalResolverMu.Unlock()
	return resolve(context.Background(), event)
}

func (h *Hub) confirmPreparedArrival(order *MarchOrder, rt marchRuntime, out MarchArrivalOutcome) error {
	if !out.Durable || out.ReportID < 0 || out.BattleRan != (out.ReportID > 0) ||
		(!out.BattleRan && !sameStacks(rt.Troops, out.RemainingTroops)) {
		return ErrMarchTransition
	}
	if len(out.RemainingTroops) == 0 {
		order.Phase = PhaseReturned
		order.ReturnFinishAt = time.Time{}
		return nil
	}
	stacks, err := NormalizeMarchTroops(h.catalog, out.RemainingTroops)
	if err != nil || len(stacks) != len(out.RemainingTroops) {
		return ErrMarchTransition
	}
	return BeginReturn(order, order.ArriveAt)
}
