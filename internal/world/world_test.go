package world

import (
	"context"
	"fmt"
	"sync"
	"testing"
)

type memStore struct {
	mu     sync.Mutex
	chunks map[string][]Cell
	cities map[string]City
}

func (m *memStore) key(sid int32, cx, cy int) string   { return fmt.Sprintf("%d/%d/%d", sid, cx, cy) }
func (m *memStore) tile(sid int32, x, y int) string    { return fmt.Sprintf("%d@%d,%d", sid, x, y) }
func (m *memStore) LoadChunk(_ context.Context, sid int32, cx, cy int) ([]Cell, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.chunks[m.key(sid, cx, cy)]
	return c, ok, nil
}
func (m *memStore) SaveChunk(_ context.Context, sid int32, cells []Cell) error {
	cx, cy := ChunkCoord(cells[0].X, cells[0].Y)
	m.mu.Lock()
	m.chunks[m.key(sid, cx, cy)] = cells
	m.mu.Unlock()
	return nil
}
func (m *memStore) CreateCity(_ context.Context, c City) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k := m.tile(c.ServerID, c.X, c.Y)
	if _, ok := m.cities[k]; ok {
		return ErrOccupied
	}
	m.cities[k] = c
	return nil
}
func (m *memStore) CityAt(_ context.Context, sid int32, x, y int) (*City, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.cities[m.tile(sid, x, y)]; ok {
		return &c, nil
	}
	return nil, nil
}
func (m *memStore) PlayerCities(_ context.Context, sid int32, pid int64) ([]City, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []City
	for _, c := range m.cities {
		if c.ServerID == sid && c.PlayerID == pid {
			out = append(out, c)
		}
	}
	return out, nil
}
func (m *memStore) ClearResourceOccupancy(context.Context, int32, int, int) error { return nil }

func TestWorldM1(t *testing.T) {
	if MapSize != 500 || ChunksPerAxis*ChunkSize != MapSize {
		t.Fatal("map must be 500×500")
	}
	store := &memStore{chunks: map[string][]Cell{}, cities: map[string]City{}}
	svc := NewService(store)
	ctx := context.Background()
	if err := InitServerMap(ctx, store, 1); err != nil {
		t.Fatal(err)
	}
	n := 0
	for cy := 0; cy < ChunksPerAxis; cy++ {
		for cx := 0; cx < ChunksPerAxis; cx++ {
			if _, ok, _ := store.LoadChunk(ctx, 1, cx, cy); ok {
				n++
			}
		}
	}
	if n != ChunksPerAxis*ChunksPerAxis {
		t.Fatalf("chunks %d", n)
	}
	var x, y int
	found := false
	for y = 0; y < ChunkSize; y++ {
		for x = 0; x < ChunkSize; x++ {
			cells, _ := svc.Loader.Cells(ctx, 1, x, y)
			if c, ok := cellAt(cells, x, y); ok && c.Buildable() {
				found = true
				break
			}
		}
		if found {
			break
		}
	}
	if !found {
		t.Fatal("no buildable tile")
	}
	c := City{ServerID: 1, CityID: 1, PlayerID: 9, Name: "c", X: x, Y: y, WallLevel: 1, Morale: 100}
	if err := svc.CreateCity(ctx, c); err != nil {
		t.Fatal(err)
	}
	if err := svc.CreateCity(ctx, c); err != ErrOccupied {
		t.Fatalf("occupancy: %v", err)
	}
	_ = store.CreateCity(ctx, City{ServerID: 1, CityID: 2, PlayerID: 3, X: 40, Y: 40, Name: "v", WallLevel: 1, Morale: 100})
	vis, err := svc.VisibleTiles(ctx, 1, 3)
	if err != nil || len(vis) != (2*VisionRadius+1)*(2*VisionRadius+1) {
		t.Fatalf("vision len=%d err=%v", len(vis), err)
	}
	if refreshed, err := svc.RefreshWildResources(ctx, 1); err != nil || refreshed == 0 {
		t.Fatalf("refresh=%d err=%v", refreshed, err)
	}
}
