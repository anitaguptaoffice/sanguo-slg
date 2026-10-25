package domestic

import "context"

func cloneCity(c *CityState) *CityState {
	out := *c
	out.Buildings = make(map[string]*BuildingInstance, len(c.Buildings))
	for k, v := range c.Buildings {
		b := *v
		out.Buildings[k] = &b
	}
	out.BuildJobs = make([]*BuildJob, len(c.BuildJobs))
	for i, v := range c.BuildJobs {
		j := *v
		out.BuildJobs[i] = &j
	}
	return &out
}

// updateCityLocked publishes only committed state. Callers hold h.mu.
func (h *Hub) updateCityLocked(ctx context.Context, id int64, fn func(*CityState) error) error {
	c := h.cities[id]
	if c == nil {
		return ErrCityNotFound
	}
	if h.store != nil && c.PlayerID != 0 {
		return h.store.saveCity(ctx, h.serverID, c, h.cat, h.now(), fn)
	}
	next := cloneCity(c)
	if fn != nil {
		if err := fn(next); err != nil {
			return err
		}
	}
	*c = *next
	return nil
}

// RefreshWallet reconciles pending local deltas with the authoritative balance.
// It never adopts a caller-provided (possibly stale) external reward snapshot.
func (h *Hub) RefreshWallet(ctx context.Context, id int64) (Resources, error) {
	return h.walletOperation(ctx, id, false, nil)
}

// SettleCity settles production against the locked authoritative balance.
func (h *Hub) SettleCity(ctx context.Context, id int64) (Resources, error) {
	return h.walletOperation(ctx, id, true, nil)
}

// WithWallet settles and applies fn while holding the Hub and PG wallet locks.
// fn must not re-enter Hub or transact on this wallet. External side effects
// performed by fn MUST be rolled back by the caller if this method returns error.
func (h *Hub) WithWallet(ctx context.Context, id int64, fn func(Resources) (Resources, error)) (Resources, error) {
	return h.walletOperation(ctx, id, true, fn)
}
func (h *Hub) walletOperation(ctx context.Context, id int64, settle bool, fn func(Resources) (Resources, error)) (Resources, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	err := h.updateCityLocked(ctx, id, func(c *CityState) error {
		if settle {
			settleProduction(c, h.cat, h.now())
		}
		if fn != nil {
			w, err := fn(c.Wallet)
			if err != nil {
				return err
			}
			if w.Food < 0 || w.Wood < 0 || w.Stone < 0 || w.Iron < 0 {
				return ErrInsufficientRes
			}
			c.Wallet = w
		}
		return nil
	})
	if err != nil {
		return Resources{}, err
	}
	return h.cities[id].Wallet, nil
}

// SettleCityWithProduction excludes external rewards from the earned delta.
func (h *Hub) SettleCityWithProduction(ctx context.Context, id int64) (wallet, production Resources, err error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	err = h.updateCityLocked(ctx, id, func(c *CityState) error {
		before := c.Wallet
		settleProduction(c, h.cat, h.now())
		production = Resources{c.Wallet.Food - before.Food, c.Wallet.Wood - before.Wood, c.Wallet.Stone - before.Stone, c.Wallet.Iron - before.Iron}
		return nil
	})
	if err != nil {
		return Resources{}, Resources{}, err
	}
	return h.cities[id].Wallet, production, nil
}
