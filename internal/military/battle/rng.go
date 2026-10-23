package battle

import "hash/fnv"

// damageUniform returns U in [damageRandomMin, damageRandomMax] deterministically.
func damageUniform(battleID string, round int, phase int, strikerID string) float64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(battleID))
	_, _ = h.Write([]byte{byte(round), byte(phase)})
	_, _ = h.Write([]byte(strikerID))
	u01 := float64(h.Sum64()%1_000_000) / 1_000_000.0
	return damageRandomMin + (damageRandomMax-damageRandomMin)*u01
}
