package api

import (
	"math"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
)

// accrue mirrors domestic settleProduction for read paths (integration layer only).
func accrue(c *domestic.CityState, cat map[int32]domestic.BuildingSpec, now time.Time) {
	if c.LastSettleAt.IsZero() {
		c.LastSettleAt = now
		return
	}
	const offlineCap = 24 * time.Hour
	const whCapBase, whCapPerLvl = 50000, 25000
	const prodBonus = 0.05
	el := now.Sub(c.LastSettleAt)
	if el > offlineCap {
		el = offlineCap
	}
	if el <= 0 {
		return
	}
	sec := el.Seconds()
	mh := int32(0)
	for _, b := range c.Buildings {
		if b.CfgID == 1 {
			mh = b.Level
			break
		}
	}
	bonus := 1.0
	if mh > 1 {
		bonus = 1 + prodBonus*float64(mh-1)
	}
	cap := float64(whCapBase + whCapPerLvl*int64(mh))
	var d [4]float64
	for _, inst := range c.Buildings {
		sp, ok := cat[inst.CfgID]
		if !ok || sp.ProdPerHour < 1 || inst.Level < 1 {
			continue
		}
		oh := math.Floor(float64(sp.ProdPerHour) * float64(inst.Level) * bonus)
		d[sp.ProdRes] += oh / 3600 * sec
	}
	clamp := func(st int64, add float64) int64 {
		return int64(math.Floor(math.Min(cap, math.Max(0, float64(st)+add))))
	}
	w := c.Wallet
	w.Food = clamp(w.Food, d[0])
	w.Wood = clamp(w.Wood, d[1])
	w.Stone = clamp(w.Stone, d[2])
	w.Iron = clamp(w.Iron, d[3])
	c.Wallet, c.LastSettleAt = w, now
}
