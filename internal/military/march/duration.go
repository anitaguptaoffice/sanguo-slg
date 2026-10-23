package march

import "math"

// marchSecPerCellAtSpeed50 is the baseline: one map cell at speed 50 takes 72 seconds.
// Effective duration scales linearly with distance and inversely with unit speed.
const marchSecPerCellAtSpeed50 = 72.0

// MarchDurationSec computes one-way march time from grid distance and effective speed.
func MarchDurationSec(distance int, speed int) int64 {
	if distance <= 0 {
		return 0
	}
	if speed <= 0 {
		speed = 1
	}
	sec := float64(distance) * marchSecPerCellAtSpeed50 * 50.0 / float64(speed)
	if sec < 1 {
		return 1
	}
	return int64(math.Ceil(sec))
}
