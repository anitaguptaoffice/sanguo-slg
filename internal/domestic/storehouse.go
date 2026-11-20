package domestic

import "context"

// Warehouse building config ID from the R2 blueprint building tree.
const warehouseCfgID int32 = 16

// StorehouseCapacityBonus is the extra per-resource storage granted by one
// warehouse level. The legacy curve is level*(level+1)*5000.
func StorehouseCapacityBonus(level int32) int64 {
	if level <= 0 {
		return 0
	}
	return int64(level) * int64(level+1) * 5000
}

// StorehouseProtectionPercent is the bounded project policy for R2-S6: four
// percent per warehouse level, capped at sixty percent so at least forty
// percent of each resource remains lootable. R4-S3's raiding skill can reduce
// this percentage when player-city looting is implemented.
func StorehouseProtectionPercent(level int32) int32 {
	if level <= 0 {
		return 0
	}
	pct := level * 4
	if pct > 60 {
		pct = 60
	}
	return pct
}

// StorehouseLevel returns the single warehouse level of a city.
func StorehouseLevel(c *CityState) int32 {
	if c == nil {
		return 0
	}
	var level int32
	for _, b := range c.Buildings {
		if b != nil && b.CfgID == warehouseCfgID && b.Level > level {
			level = b.Level
		}
	}
	return level
}

// StorehouseProtected returns the amount of each resource protected from
// looting at the city's current warehouse level.
func StorehouseProtected(wallet Resources, level int32) Resources {
	pct := StorehouseProtectionPercent(level)
	if pct <= 0 {
		return Resources{}
	}
	return Resources{
		Food:  wallet.Food * int64(pct) / 100,
		Wood:  wallet.Wood * int64(pct) / 100,
		Stone: wallet.Stone * int64(pct) / 100,
		Iron:  wallet.Iron * int64(pct) / 100,
	}
}

// StorehouseView is the warehouse panel snapshot.
type StorehouseView struct {
	Level             int32
	CapacityBonus     int64
	ProtectionPercent int32
	Protected         Resources
	Wallet            Resources
}

// Storehouse reads the warehouse level, capacity bonus and protected amounts
// from one committed Hub snapshot.
func (h *Hub) Storehouse(ctx context.Context, cityID int64) (StorehouseView, error) {
	if h == nil {
		return StorehouseView{}, ErrCityNotFound
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	c := h.cities[cityID]
	if c == nil {
		return StorehouseView{}, ErrCityNotFound
	}
	level := StorehouseLevel(c)
	return StorehouseView{
		Level:             level,
		CapacityBonus:     StorehouseCapacityBonus(level),
		ProtectionPercent: StorehouseProtectionPercent(level),
		Protected:         StorehouseProtected(c.Wallet, level),
		Wallet:            c.Wallet,
	}, nil
}
