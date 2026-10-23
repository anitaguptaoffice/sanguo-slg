package api

import (
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
)

func TestCityProductionRatesPerHourMatchesDomesticFormula(t *testing.T) {
	cat := domestic.DefaultCatalog()
	c := &domestic.CityState{
		Buildings: map[string]*domestic.BuildingInstance{
			"hall": {CfgID: 1, Level: 3},
			"farm": {CfgID: 2, Level: 2},
		},
	}
	rates := cityProductionRatesPerHour(c, cat)
	bonus := 1 + domesticProdBonusPerMainHallLevel*2
	wantFood := int64(float64(cat[2].ProdPerHour) * 2 * bonus)
	if rates.Food != wantFood {
		t.Fatalf("food/h=%d want=%d", rates.Food, wantFood)
	}
	if rates.Wood != 0 || rates.Iron != 0 || rates.Stone != 0 {
		t.Fatalf("unexpected other rates: wood=%d iron=%d stone=%d", rates.Wood, rates.Iron, rates.Stone)
	}
}
