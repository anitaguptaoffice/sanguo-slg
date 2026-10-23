package world

import (
	"context"
	"fmt"
	"sync"
)

const (
	MapSize       = 500
	ChunkSize     = 50
	ChunksPerAxis = MapSize / ChunkSize
	VisionRadius  = 5
)

type Terrain int16

const (
	TerrainPlain    Terrain = 0
	TerrainMountain Terrain = 1
	TerrainWater    Terrain = 2
)

type Cell struct {
	X, Y          int
	Terrain       Terrain
	ResourceType  int16
	ResourceLevel int16
}

type City struct {
	ServerID  int32
	CityID    int64
	PlayerID  int64
	Name      string
	X, Y      int
	IsCapital bool
	WallLevel int
	Morale    int
}

type Coord struct{ X, Y int }

func (c Cell) Buildable() bool { return c.Terrain == TerrainPlain && c.ResourceType == 0 }

func ChunkCoord(x, y int) (int, int) { return x / ChunkSize, y / ChunkSize }

func ChunkBounds(cx, cy int) (minX, minY, maxX, maxY int) {
	minX, minY = cx*ChunkSize, cy*ChunkSize
	maxX, maxY = minX+ChunkSize, minY+ChunkSize
	if maxX > MapSize {
		maxX = MapSize
	}
	if maxY > MapSize {
		maxY = MapSize
	}
	return minX, minY, maxX, maxY
}

type Store interface {
	LoadChunk(ctx context.Context, sid int32, cx, cy int) ([]Cell, bool, error)
	SaveChunk(ctx context.Context, sid int32, cells []Cell) error
	CreateCity(ctx context.Context, c City) error
	CityAt(ctx context.Context, sid int32, x, y int) (*City, error)
	PlayerCities(ctx context.Context, sid int32, pid int64) ([]City, error)
	ClearResourceOccupancy(ctx context.Context, sid int32, x, y int) error
}

type Loader struct {
	store Store
	mu    sync.Mutex
	cache map[string][]Cell
	max   int
}

func NewLoader(s Store, max int) *Loader {
	if max < 1 {
		max = 4
	}
	return &Loader{store: s, cache: map[string][]Cell{}, max: max}
}

func (l *Loader) Cells(ctx context.Context, sid int32, x, y int) ([]Cell, error) {
	cx, cy := ChunkCoord(x, y)
	key := fmt.Sprintf("%d/%d/%d", sid, cx, cy)
	l.mu.Lock()
	if c, ok := l.cache[key]; ok {
		l.mu.Unlock()
		return c, nil
	}
	l.mu.Unlock()

	cells, ok, err := l.store.LoadChunk(ctx, sid, cx, cy)
	if err != nil {
		return nil, err
	}
	if !ok {
		cells = GenerateChunk(sid, cx, cy)
		if err := l.store.SaveChunk(ctx, sid, cells); err != nil {
			return nil, err
		}
	}
	l.mu.Lock()
	if len(l.cache) >= l.max {
		l.cache = map[string][]Cell{}
	}
	l.cache[key] = cells
	l.mu.Unlock()
	return cells, nil
}

func cellAt(cells []Cell, x, y int) (Cell, bool) {
	minX, minY, _, _ := ChunkBounds(ChunkCoord(x, y))
	i := (y-minY)*ChunkSize + (x - minX)
	if i < 0 || i >= len(cells) {
		return Cell{}, false
	}
	return cells[i], true
}
