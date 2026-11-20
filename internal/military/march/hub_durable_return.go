package march

import "time"

// DurableMarchReturnEvent identifies the current Hub candidate. The caller
// binds its shard and revalidates the exact identity in PostgreSQL.
type DurableMarchReturnEvent struct {
	MarchID, ArmyID, CityID, PlayerID int64
	ReturnAt                          time.Time
}

// DurableMarchReturnHandler returns only observations confirmed by its
// transaction owner. Errors, including unknown commits, quarantine the event.
type DurableMarchReturnHandler func(DurableMarchReturnEvent) (ReturnObservation, error)

// SetDurableMarchReturnHandler installs the prepared consumer before scheduler
// activation. Install it only on a Hub with the complete durable lifecycle.
func (h *Hub) SetDurableMarchReturnHandler(complete DurableMarchReturnHandler) error {
	if h == nil || complete == nil {
		return ErrReturnUnavailable
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.restored || h.restoreEv == nil || h.onDurableReturn != nil {
		return ErrReturnUnavailable
	}
	h.onDurableReturn = complete
	return nil
}

// MarchReturnError reports the unresolved result for this Hub generation.
func (h *Hub) MarchReturnError(id int64) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.returnErrors[id]
}

func (h *Hub) onDurableMarchReturn(event Event, complete DurableMarchReturnHandler) {
	h.mu.Lock()
	order := h.marches[event.RefID]
	rt, bound := h.marchCtx[event.RefID]
	_, running := h.durableReturns[event.RefID]
	if order == nil || order.Phase != PhaseReturning || !bound || rt.OriginCityID <= 0 ||
		rt.PlayerID <= 0 || running || h.returnErrors[event.RefID] != nil {
		h.mu.Unlock()
		return
	}
	candidate := DurableMarchReturnEvent{order.ID, order.ArmyID, rt.OriginCityID, rt.PlayerID, order.ReturnFinishAt}
	if h.durableReturns == nil {
		h.durableReturns = make(map[int64]struct{})
	}
	h.durableReturns[event.RefID] = struct{}{}
	h.mu.Unlock()

	out, err := complete(candidate) // Never hold a Hub mutex across PostgreSQL.
	h.mu.Lock()
	delete(h.durableReturns, event.RefID)
	if h.marches[event.RefID] != order || order.Phase != PhaseReturning || !order.ReturnFinishAt.Equal(candidate.ReturnAt) {
		h.mu.Unlock()
		return
	}
	if err == nil && !matchesDurableReturn(candidate, out) {
		err = ErrReturnUnavailable
	}
	if err != nil {
		if h.returnErrors == nil {
			h.returnErrors = make(map[int64]error)
		}
		h.returnErrors[event.RefID] = err
		h.mu.Unlock()
		return
	}
	if out.Disposition == ReturnEarly {
		retry := h.now().Add(DefaultTickInterval)
		if candidate.ReturnAt.After(retry) {
			retry = candidate.ReturnAt
		}
		h.scheduler.Schedule(Event{Kind: EventMarchReturnDone, RefID: event.RefID, DueAt: retry, Handler: h.onMarchReturn})
		h.mu.Unlock()
		return
	}
	_ = MarkReturnComplete(order) // Matching phase already checked.
	finished := h.onFinished
	h.mu.Unlock()
	if finished != nil {
		finished(event.RefID)
	}
}

func matchesDurableReturn(event DurableMarchReturnEvent, out ReturnObservation) bool {
	c := out.Candidate
	return c.ServerID > 0 && c.MarchID == event.MarchID && c.ArmyID == event.ArmyID &&
		c.CityID == event.CityID && c.PlayerID == event.PlayerID && !event.ReturnAt.IsZero() &&
		// PostgreSQL stores deadlines at microsecond precision while the Hub
		// scheduled the nanosecond value it computed from time.Now.
		out.ReturnAt.Truncate(time.Microsecond).Equal(event.ReturnAt.Truncate(time.Microsecond)) &&
		(out.Disposition == ReturnApplied || out.Disposition == ReturnCreditedTerminal || out.Disposition == ReturnEarly)
}
