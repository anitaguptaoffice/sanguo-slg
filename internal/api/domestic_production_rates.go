package api

import (
	"math"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
)

const domesticMainHallCfgID = 1
const domesticProdBonusPerMainHallLevel = 0.05

// cityProductionRatesPerHour mirrors domestic.settleProduction hourly output (spec/rules/domestic.md).
func cityProductionRatesPerHour(c *domestic.CityState, cat map[int32]domestic.BuildingSpec) domestic.Resources {
	if c == nil {
		return domestic.Resources{}
	}
	mh := int32(0)
	for _, inst := range c.Buildings {
		if inst != nil && inst.CfgID == domesticMainHallCfgID {
			mh = inst.Level
			break
		}
	}
	bonus := 1.0
	if mh > 1 {
		bonus = 1 + domesticProdBonusPerMainHallLevel*float64(mh-1)
	}
	var rates domestic.Resources
	for _, inst := range c.Buildings {
		if inst == nil || inst.Level < 1 {
			continue
		}
		sp, ok := cat[inst.CfgID]
		if !ok || sp.ProdPerHour < 1 {
			continue
		}
		oh := int64(math.Floor(float64(sp.ProdPerHour) * float64(inst.Level) * bonus))
		switch sp.ProdRes {
		case 0:
			rates.Food += oh
		case 1:
			rates.Wood += oh
		case 2:
			rates.Stone += oh
		case 3:
			rates.Iron += oh
		}
	}
	return rates
}
