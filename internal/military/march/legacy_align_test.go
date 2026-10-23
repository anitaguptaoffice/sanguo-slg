package march

import "testing"

func TestLegacyMarchDurationMatchesReferenceFormula(t *testing.T) {
	// 10 cells east, speed 50 → 10 * 6000 / 50 = 1200s (legacy Euclidean along axis)
	got := LegacyMarchDurationSec(10, 0, 50)
	if got != 1200 {
		t.Fatalf("legacy march: want 1200 got %d", got)
	}
}

func TestM1MarchDurationUsesChebyshevCalibration(t *testing.T) {
	// M1: 10 chebyshev cells at speed 50 → 720s (duration_test baseline)
	if MarchDurationSec(10, 50) != 720 {
		t.Fatalf("m1 march baseline mismatch")
	}
}
