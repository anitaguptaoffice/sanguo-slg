package march

// installRestore publishes a validated plan atomically under the Hub mutex. It
// stages the restore events instead of scheduling them: handlers cannot run
// until ActivateRestore, which the caller invokes only after it has published
// the returned bindings and before it starts the scheduler.
func installRestore(h *Hub, items []restoreRow, stacks map[int64][]TroopStack) error {
	if h == nil || h.scheduler == nil {
		return ErrMarchRestore
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.restored || len(h.marches) != 0 || len(h.marchCtx) != 0 {
		return ErrMarchRestore
	}
	catalog := h.catalog
	for _, it := range items {
		if EffectiveMarchSpeed(catalog, stacks[it.ArmyID]) <= 0 {
			return ErrMarchRestore
		}
	}
	events := make([]Event, 0, len(items))
	var next int64
	for _, it := range items {
		troops := stacks[it.ArmyID]
		order := &MarchOrder{
			ID: it.ID, ArmyID: it.ArmyID,
			FromX: int(it.FromX), FromY: int(it.FromY), ToX: int(it.ToX), ToY: int(it.ToY),
			Purpose: int16(it.Purpose), Phase: PhaseMarching, Speed: EffectiveMarchSpeed(catalog, troops),
			DepartAt: it.DepartAt, ArriveAt: it.ArriveAt,
		}
		if it.Status == 3 {
			order.Phase = PhaseReturning
			order.ReturnFinishAt = *it.ReturnAt
			events = append(events, Event{Kind: EventMarchReturnDone, DueAt: order.ReturnFinishAt, RefID: order.ID,
				Handler: func(ev Event) { h.onMarchReturn(ev) }})
		} else {
			events = append(events, Event{Kind: EventMarchArrive, DueAt: order.ArriveAt, RefID: order.ID,
				Handler: func(ev Event) { h.onMarchArrive(ev) }})
		}
		hero := int64(0)
		if len(it.Heroes) == 1 {
			hero = it.Heroes[0]
		}
		h.marches[order.ID] = order
		h.marchCtx[order.ID] = marchRuntime{OriginCityID: *it.Origin, PlayerID: *it.Owner, HeroID: hero, Troops: cloneStacks(troops)}
		if order.ID > next {
			next = order.ID
		}
	}
	h.nextMarch = next
	h.restored = true
	h.restoreEv = events
	return nil
}

// ActivateRestore publishes the staged restore events exactly once. The caller
// must finish binding RestoreResult and start the scheduler only after this
// returns, so no overdue handler can observe a half-published snapshot. Overdue
// arrivals keep their frozen deadline: onMarchArrive starts the return clock at
// the original arrival, so the return is due at arrival+travel, not at
// activation+travel.
func (h *Hub) ActivateRestore() error {
	if h == nil {
		return ErrMarchRestore
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.restored || h.restoreEv == nil {
		return ErrMarchRestore
	}
	events := h.restoreEv
	h.restoreEv = nil
	for _, ev := range events {
		h.scheduler.Schedule(ev)
	}
	return nil
}
