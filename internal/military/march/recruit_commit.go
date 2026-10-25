package march

import "errors"

var ErrWalletCommitRequired = errors.New("march: wallet commit callback required")

// RecruitWithWallet plans recruitment before committing the authoritative wallet,
// then publishes the job and schedules completion only after a successful commit.
// The callback runs under the military lock: lock order is military -> domestic
// -> database. It must not re-enter this Hub, and must return success only after
// committing the debit. An error must mean no debit was committed.
// Queues remain in memory: a process crash after debit can still lose the job.
// This does not provide durable queues or request-level idempotency.
func (h *Hub) RecruitWithWallet(req RecruitRequest, commit func(Resources) (Resources, error)) (RecruitResult, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	city := h.cities[req.CityID]
	if city == nil {
		return RecruitResult{}, ErrCityNotFound
	}
	if req.Count <= 0 {
		return RecruitResult{}, ErrInvalidCount
	}
	spec, ok := h.catalog[req.UnitCfgID]
	if !ok {
		return RecruitResult{}, ErrUnknownUnit
	}
	if commit == nil {
		return RecruitResult{}, ErrWalletCommitRequired
	}
	cost := spec.RecruitCost.Scale(req.Count)
	// StartRecruit only appends jobs; isolate its slice and sequence changes.
	staged := *city
	staged.RecruitJobs = append([]*RecruitJob(nil), city.RecruitJobs...)
	// Affordability belongs to the authoritative wallet, not this cached mirror.
	staged.Wallet = cost
	res, job, err := StartRecruit(&staged, h.catalog, h.now(), req)
	if err != nil {
		return RecruitResult{}, err
	}
	after, err := commit(cost)
	if err != nil {
		return RecruitResult{}, err
	}
	staged.Wallet = after
	res.Wallet = after
	*city = staged
	if job.Status == QueueActive {
		h.scheduleRecruitComplete(req.CityID, job)
	}
	return res, nil
}

// EnsureCity atomically registers a missing city without overwriting an existing
// wallet, queue or troop balance. Both the input and returned snapshot are owned
// by the caller; later caller mutations cannot change Hub state.
func (h *Hub) EnsureCity(c *CityState) *CityState {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c == nil {
		return nil
	}
	if h.cities[c.ID] == nil {
		h.cities[c.ID] = cloneCity(c)
	}
	return cloneCity(h.cities[c.ID])
}

// SnapshotCity returns an independent, consistent copy for concurrent readers.
func (h *Hub) SnapshotCity(id int64) *CityState {
	h.mu.Lock()
	defer h.mu.Unlock()
	return cloneCity(h.cities[id])
}

func cloneCity(c *CityState) *CityState {
	if c == nil {
		return nil
	}
	out := *c
	out.Troops = make(map[int32]int32, len(c.Troops))
	for id, count := range c.Troops {
		out.Troops[id] = count
	}
	out.RecruitJobs = make([]*RecruitJob, len(c.RecruitJobs))
	for i, job := range c.RecruitJobs {
		if job != nil {
			copy := *job
			out.RecruitJobs[i] = &copy
		}
	}
	return &out
}
