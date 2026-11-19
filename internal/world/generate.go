package world

// terrainWeight maps a 0..999 roll to one of the seven wild terrains. City
// tiles are never generated: players and NPC cities occupy them later.
var terrainWeight = []struct {
	limit   int
	terrain Terrain
}{
	{300, TerrainPlain},
	{460, TerrainGrass},
	{600, TerrainForest},
	{700, TerrainDesert},
	{820, TerrainMountain},
	{910, TerrainLake},
	{1000, TerrainSwamp},
}

const (
	starterX      = 60
	starterY      = 60
	starterRadius = 4
)

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

func terrainForRoll(roll int) Terrain {
	for _, w := range terrainWeight {
		if roll < w.limit {
			return w.terrain
		}
	}
	return TerrainSwamp
}

// GenerateChunk builds one deterministic 50×50 chunk for the shard. Terrain,
// province, level and NPC camps depend only on (server, x, y), so any chunk can
// be regenerated or compared without reading neighbours.
func GenerateChunk(sid int32, cx, cy int) []Cell {
	minX, minY, maxX, maxY := ChunkBounds(cx, cy)
	w, h := maxX-minX, maxY-minY
	out := make([]Cell, w*h)
	for y := minY; y < maxY; y++ {
		for x := minX; x < maxX; x++ {
			i := (y-minY)*w + (x - minX)
			roll := splitmix(uint64(uint32(sid))<<40 | uint64(uint32(x))<<20 | uint64(uint32(y)))
			t := terrainForRoll(int(roll % 1000))
			// The starter valley around (60,60) stays open plain so every new
			// player has a guaranteed buildable capital site.
			starter := abs(x-starterX) <= starterRadius && abs(y-starterY) <= starterRadius
			if starter {
				t = TerrainPlain
			}
			province, dist := ProvinceAt(sid, x, y)
			centers := ProvinceCenters(sid)
			level := WildLevelForDistance(dist, centers[province-1].radius)

			rt, rl := int16(0), int16(0)
			if !starter && roll>>12%100 < 12 {
				switch t {
				case TerrainPlain:
					rt, rl = 1, level
				case TerrainGrass, TerrainForest:
					rt, rl = 2, level
				}
			}
			npc := int16(0)
			if t != TerrainPlain && (t == TerrainMountain || t == TerrainForest || t == TerrainSwamp) && level >= 3 && roll>>24%100 < 6 {
				npc = 1
			}
			out[i] = Cell{
				X: x, Y: y, Terrain: t,
				ResourceType: rt, ResourceLevel: rl,
				Level: level, MaxLevel: 10, ProvinceID: province, NpcKind: npc,
			}
		}
	}
	return out
}
