package world

import (
	"context"
	"fmt"
	"sync"
	"time"
)

const (
	MapSize       = 500
	ChunkSize     = 50
	ChunksPerAxis = MapSize / ChunkSize
	VisionRadius  = 5
)

// Terrain follows the original world type scale (cfg_world_type 0..7).
type Terrain int16

const (
	TerrainCity     Terrain = 0
	TerrainPlain    Terrain = 1
	TerrainDesert   Terrain = 2
	TerrainForest   Terrain = 3
	TerrainGrass    Terrain = 4
	TerrainMountain Terrain = 5
	TerrainLake     Terrain = 6
	TerrainSwamp    Terrain = 7
)

// TerrainName returns the player-facing terrain label.
func TerrainName(t Terrain) string {
	switch t {
	case TerrainCity:
		return "城池"
	case TerrainPlain:
		return "平地"
	case TerrainDesert:
		return "荒漠"
	case TerrainForest:
		return "森林"
	case TerrainGrass:
		return "草原"
	case TerrainMountain:
		return "山地"
	case TerrainLake:
		return "湖泊"
	case TerrainSwamp:
		return "沼泽"
	default:
		return "未知"
	}
}

type Cell struct {
	X, Y          int
	Terrain       Terrain
	ResourceType  int16
	ResourceLevel int16
	// Level is the wild-land level (1..10); MaxLevel is its recoverable ceiling.
	Level      int16
	MaxLevel   int16
	ProvinceID int16
	// OwnerCityID is the occupying player city, 0 when unowned.
	OwnerCityID int64
	// NpcKind is 0 for a plain wild tile and 1 for a yellow-turban camp.
	NpcKind int16
	// GarrisonJSON stores the remaining defenders after a battle; nil means the
	// configured full garrison.
	GarrisonJSON []byte
	// RecoverAt is the garrison recovery deadline; zero means none.
	RecoverAt time.Time
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

// Buildable reports whether a city may be placed on this tile.
func (c Cell) Buildable() bool {
	return c.Terrain == TerrainPlain && c.ResourceType == 0 && c.NpcKind == 0 && c.OwnerCityID == 0
}

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
