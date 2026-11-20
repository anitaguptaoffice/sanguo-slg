package world

import (
	"context"
	"time"
)

// TileView is one map tile as returned to the world map viewport.
type TileView struct {
	Cell
	CityLevel     int32
	OwnerPlayerID int64
	OwnerName     string
	OwnerCityName string
}

// MarchLine is one visible in-progress march segment.
type MarchLine struct {
	MarchID  int64
	FromX    int
	FromY    int
	ToX      int
	ToY      int
	Phase    int16
	ArriveAt time.Time
	OwnerID  int64
}

// ViewStore is implemented by PGStore; it keeps the viewport queries out of
// the chunk loader contract used by city creation.
type ViewStore interface {
	Viewport(ctx context.Context, sid int32, minX, minY, maxX, maxY int) ([]TileView, error)
	MarchLines(ctx context.Context, sid int32, minX, minY, maxX, maxY int) ([]MarchLine, error)
}

// Viewport clamps a requested rectangle to the map and returns its tiles and
// in-progress marches. The radius is inclusive around the centre.
func (svc *Service) Viewport(ctx context.Context, sid int32, centerX, centerY, radiusX, radiusY int) ([]TileView, []MarchLine, error) {
	minX, minY, maxX, maxY := viewportBounds(centerX, centerY, radiusX, radiusY)
	store, ok := svc.Store.(ViewStore)
	if !ok {
		return nil, nil, ErrViewportUnavailable
	}
	tiles, err := store.Viewport(ctx, sid, minX, minY, maxX, maxY)
	if err != nil {
		return nil, nil, err
	}
	marches, err := store.MarchLines(ctx, sid, minX, minY, maxX, maxY)
	if err != nil {
		return nil, nil, err
	}
	return tiles, marches, nil
}

// TileDetail returns one tile, or nil when it is outside the map.
func (svc *Service) TileDetail(ctx context.Context, sid int32, x, y int) (*TileView, error) {
	if x < 0 || y < 0 || x >= MapSize || y >= MapSize {
		return nil, nil
	}
	tiles, _, err := svc.Viewport(ctx, sid, x, y, 0, 0)
	if err != nil || len(tiles) == 0 {
		return nil, err
	}
	return &tiles[0], nil
}

func viewportBounds(centerX, centerY, radiusX, radiusY int) (minX, minY, maxX, maxY int) {
	if radiusX < 0 {
		radiusX = 0
	}
	if radiusY < 0 {
		radiusY = 0
	}
	minX, maxX = centerX-radiusX, centerX+radiusX
	minY, maxY = centerY-radiusY, centerY+radiusY
	if minX < 0 {
		minX = 0
	}
	if minY < 0 {
		minY = 0
	}
	if maxX >= MapSize {
		maxX = MapSize - 1
	}
	if maxY >= MapSize {
		maxY = MapSize - 1
	}
	return minX, minY, maxX, maxY
}

// OwnedFields returns the wild tiles owned by one city.
func (svc *Service) OwnedFields(ctx context.Context, sid int32, cityID int64) ([]TileView, error) {
	store, ok := svc.Store.(interface {
		OwnedFields(ctx context.Context, sid int32, cityID int64) ([]TileView, error)
	})
	if !ok {
		return nil, ErrViewportUnavailable
	}
	return store.OwnedFields(ctx, sid, cityID)
}

// AbandonField clears one city's ownership of a wild tile.
func (svc *Service) AbandonField(ctx context.Context, sid int32, cityID int64, x, y int) (bool, error) {
	store, ok := svc.Store.(interface {
		AbandonField(ctx context.Context, sid int32, cityID int64, x, y int) (bool, error)
	})
	if !ok {
		return false, ErrViewportUnavailable
	}
	return store.AbandonField(ctx, sid, cityID, x, y)
}
