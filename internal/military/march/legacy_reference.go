package march

import "math"

// Legacy grid distance constant (reference/legacy/server/game/common.php).
const legacyGridDistance = 6000.0

// LegacyMarchDurationSec models GroundFunc::StartTroop baseline without tech/hero:
// pathNeedTime = floor(pathLength * GRID_DISTANCE / minSpeed), Euclidean pathLength.
func LegacyMarchDurationSec(dx, dy int, minSpeed int) int64 {
	if minSpeed <= 0 {
		minSpeed = 1
	}
	pathLength := math.Hypot(float64(dx), float64(dy))
	if pathLength <= 0 {
		return 0
	}
	sec := pathLength * legacyGridDistance / float64(minSpeed)
	if sec < 1 {
		return 1
	}
	return int64(math.Floor(sec))
}
