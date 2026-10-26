package march

// SnapshotMarch returns isolated copies of the order and its current runtime
// troops from one locked read. Missing orders return nil, nil. Troops reflect
// existing runtime state in every phase, not a newly inferred home/field balance.
// Returned orders retain their survivor snapshot as history, not field availability.
func (h *Hub) SnapshotMarch(id int64) (*MarchOrder, []TroopStack) {
	h.mu.Lock()
	defer h.mu.Unlock()
	order := h.marches[id]
	if order == nil {
		return nil, nil
	}
	return cloneMarch(order), cloneStacks(h.marchCtx[id].Troops)
}
