package domestic

import (
	"math"
	"testing"
	"time"
)

func TestProductionMatchesDomesticDocFormula(t *testing.T) {
	cat := DefaultCatalog()
	// farm id=2: base_per_hour 120, level 2, main_hall level 3 → bonus 1 + 0.05*2 = 1.1
	c := &CityState{
		LastSettleAt: time.Unix(0, 0),
		Wallet:       Resources{},
		Buildings: map[string]*BuildingInstance{
			"hall": {CfgID: 1, Level: 3},
			"farm": {CfgID: 2, Level: 2},
		},
	}
	settleProduction(c, cat, time.Unix(3600, 0))

	bonus := 1 + prodBonus*float64(mainHallLvl(c)-1)
	expectedHour := math.Floor(float64(cat[2].ProdPerHour) * float64(2) * bonus)
	if math.Abs(float64(c.Wallet.Food)-expectedHour) > 0.01 {
		t.Fatalf("food want ~%v got %d", expectedHour, c.Wallet.Food)
	}
}
