package world

import (
	"hash/fnv"
	"math/rand"
)

func GenerateChunk(sid int32, cx, cy int) []Cell {
	minX, minY, maxX, maxY := ChunkBounds(cx, cy)
	w, h := maxX-minX, maxY-minY
	out := make([]Cell, w*h)
	rng := rand.New(rand.NewSource(chunkSeed(sid, cx, cy)))
	for y := minY; y < maxY; y++ {
		for x := minX; x < maxX; x++ {
			i := (y-minY)*w + (x - minX)
			roll := rng.Intn(100)
			t := TerrainPlain
			if roll >= 70 && roll < 90 {
				t = TerrainMountain
			} else if roll >= 90 {
				t = TerrainWater
			}
			rt, rl := int16(0), int16(0)
			if t == TerrainPlain && rng.Intn(100) < 12 {
				rt = int16(1 + rng.Intn(4))
				rl = int16(1 + rng.Intn(5))
			}
			out[i] = Cell{X: x, Y: y, Terrain: t, ResourceType: rt, ResourceLevel: rl}
		}
	}
	return out
}

func chunkSeed(sid int32, cx, cy int) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte{byte(sid), byte(sid >> 8), byte(cx), byte(cy)})
	return int64(h.Sum64())
}
