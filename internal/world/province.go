package world

import (
	"math"
)

// ProvinceCount is the number of 州郡 the 500×500 world is partitioned into.
const ProvinceCount = 14

// ProvinceNames are original labels for the 14 deterministic province seeds.
var ProvinceNames = [ProvinceCount]string{
	"幽州", "冀州", "青州", "兖州", "徐州", "豫州", "司隶",
	"雍州", "凉州", "并州", "荆州", "扬州", "益州", "交州",
}

type provinceCenter struct {
	id     int16
	x, y   int
	radius float64
}

// ProvinceCenters returns the deterministic province layout for one shard.
// The layout is a pure function of the shard id; no state is cached.
func ProvinceCenters(sid int32) []provinceCenter {
	centers := make([]provinceCenter, ProvinceCount)
	for i := range centers {
		h := splitmix(uint64(uint32(sid))<<32 | uint64(i+1)*0x9E3779B1)
		// Keep centers away from the map edge so each province has a core.
		x := int(h%uint64(MapSize-120)) + 60
		y := int((h>>32)%uint64(MapSize-120)) + 60
		centers[i] = provinceCenter{id: int16(i + 1), x: x, y: y, radius: MapSize / math.Sqrt(ProvinceCount) / 2}
	}
	return centers
}

// ProvinceAt returns the province id and its center distance for a coordinate.
func ProvinceAt(sid int32, x, y int) (int16, float64) {
	best, bestDist := int16(0), math.MaxFloat64
	for _, c := range ProvinceCenters(sid) {
		dx, dy := float64(x-c.x), float64(y-c.y)
		d := math.Hypot(dx, dy)
		if d < bestDist {
			best, bestDist = c.id, d
		}
	}
	return best, bestDist
}

// WildLevelForDistance converts a distance to the province core into a 1..10 level.
func WildLevelForDistance(dist, radius float64) int16 {
	if radius <= 0 {
		return 1
	}
	level := int16(10 - int(dist/radius*9))
	if level < 1 {
		return 1
	}
	if level > 10 {
		return 10
	}
	return level
}

// splitmix is a small deterministic mixer shared by generation paths.
func splitmix(v uint64) uint64 {
	v += 0x9E3779B97F4A7C15
	v = (v ^ (v >> 30)) * 0xBF58476D1CE4E5B9
	v = (v ^ (v >> 27)) * 0x94D049BB133111EB
	return v ^ (v >> 31)
}
