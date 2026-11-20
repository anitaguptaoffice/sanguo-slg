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
	rates := cityProductionRatesPerHour(c, cat, [4]int64{})
	bonus := 1 + domesticProdBonusPerMainHallLevel*2
	wantFood := int64(float64(cat[2].ProdPerHour) * 2 * bonus)
	if rates.Food != wantFood {
		t.Fatalf("food/h=%d want=%d", rates.Food, wantFood)
	}
	if rates.Wood != 0 || rates.Iron != 0 || rates.Stone != 0 {
		t.Fatalf("unexpected other rates: wood=%d iron=%d stone=%d", rates.Wood, rates.Iron, rates.Stone)
	}

	// Owned-field percentages stack on top of the building rate.
	boosted := cityProductionRatesPerHour(c, cat, [4]int64{25, 0, 0, 0})
	if want := wantFood * 125 / 100; boosted.Food != want {
		t.Fatalf("field bonus food/h=%d want=%d", boosted.Food, want)
	}
}
