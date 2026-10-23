package march

import "testing"

func TestGridDistance(t *testing.T) {
	if GridDistance(0, 0, 3, 4) != 4 {
		t.Fatal("chebyshev distance")
	}
	if GridDistance(10, 10, 10, 10) != 0 {
		t.Fatal("same cell")
	}
}

func TestMarchDurationScalesWithSpeed(t *testing.T) {
	dist := 10
	slow := MarchDurationSec(dist, 50)
	fast := MarchDurationSec(dist, 100)
	if fast >= slow {
		t.Fatalf("faster troops should march quicker: slow=%d fast=%d", slow, fast)
	}
	if MarchDurationSec(dist, 50) != 720 {
		t.Fatalf("baseline 10 cells at speed 50 = 720s, got %d", MarchDurationSec(dist, 50))
	}
}

func TestEffectiveMarchSpeedBottleneck(t *testing.T) {
	cat := DefaultUnitCatalog()
	spd := EffectiveMarchSpeed(cat, []TroopStack{
		{UnitCfgID: 2, Count: 100},
		{UnitCfgID: 4, Count: 1},
	})
	if spd != 30 {
		t.Fatalf("expected siege speed 30, got %d", spd)
	}
}
