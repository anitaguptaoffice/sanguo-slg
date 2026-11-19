package world

import (
	"reflect"
	"testing"
)

func TestGenerateChunkIsDeterministicAndCoversEightTerrains(t *testing.T) {
	first := GenerateChunk(1, 2, 3)
	second := GenerateChunk(1, 2, 3)
	if len(first) != len(second) {
		t.Fatalf("chunk sizes differ: %d %d", len(first), len(second))
	}
	for i := range first {
		if !reflect.DeepEqual(first[i], second[i]) {
			t.Fatalf("cell %d differs between identical generations: %+v %+v", i, first[i], second[i])
		}
	}
	seen := map[Terrain]int{}
	provinces := map[int16]bool{}
	for _, cell := range first {
		seen[cell.Terrain]++
		provinces[cell.ProvinceID] = true
		if cell.Level < 1 || cell.Level > 10 || cell.MaxLevel != 10 {
			t.Fatalf("invalid level %+v", cell)
		}
		if cell.Terrain != TerrainPlain && cell.Terrain != TerrainGrass && cell.Terrain != TerrainForest &&
			cell.Terrain != TerrainDesert && cell.Terrain != TerrainMountain && cell.Terrain != TerrainLake &&
			cell.Terrain != TerrainSwamp {
			t.Fatalf("generated city or unknown terrain %d", cell.Terrain)
		}
		if cell.Terrain == TerrainCity {
			t.Fatal("city tiles must not be generated")
		}
		if cell.NpcKind != 0 && cell.NpcKind != 1 {
			t.Fatalf("invalid npc kind %d", cell.NpcKind)
		}
		if cell.NpcKind == 1 && cell.Terrain != TerrainMountain && cell.Terrain != TerrainForest && cell.Terrain != TerrainSwamp {
			t.Fatalf("yellow turban camp on %s", TerrainName(cell.Terrain))
		}
	}
	for _, terrain := range []Terrain{TerrainPlain, TerrainGrass, TerrainForest, TerrainDesert, TerrainMountain, TerrainLake, TerrainSwamp} {
		if seen[terrain] == 0 {
			t.Fatalf("terrain %s missing from a 50x50 chunk", TerrainName(terrain))
		}
	}
	if len(provinces) == 0 {
		t.Fatal("no province assigned")
	}
	for id := range provinces {
		if id < 1 || id > ProvinceCount {
			t.Fatalf("province %d out of range", id)
		}
	}
}

func TestProvinceLayoutIsStablePerShard(t *testing.T) {
	a := ProvinceCenters(1)
	b := ProvinceCenters(1)
	if len(a) != ProvinceCount {
		t.Fatalf("province count %d", len(a))
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("province %d changed between calls", i)
		}
	}
	c := ProvinceCenters(2)
	if a[0] == c[0] {
		t.Fatal("different shards share the same first province center")
	}
}

func TestWildLevelBounds(t *testing.T) {
	if got := WildLevelForDistance(0, 100); got != 10 {
		t.Fatalf("core level %d, want 10", got)
	}
	if got := WildLevelForDistance(1000, 100); got != 1 {
		t.Fatalf("far level %d, want 1", got)
	}
	if got := WildLevelForDistance(1, 0); got != 1 {
		t.Fatalf("zero radius level %d, want 1", got)
	}
}
