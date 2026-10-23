package world

import (
	"context"
	"errors"
	"fmt"
)

var (
	ErrOccupied   = errors.New("world: coordinate occupied")
	ErrBadTerrain = errors.New("world: terrain not buildable")
	ErrOutOfBounds = errors.New("world: out of bounds")
)

type Service struct {
	Store  Store
	Loader *Loader
}

func NewService(s Store) *Service { return &Service{Store: s, Loader: NewLoader(s, 4)} }

func InitServerMap(ctx context.Context, s Store, sid int32) error {
	for cy := 0; cy < ChunksPerAxis; cy++ {
		for cx := 0; cx < ChunksPerAxis; cx++ {
			_, ok, err := s.LoadChunk(ctx, sid, cx, cy)
			if err != nil {
				return err
			}
			if ok {
				continue
			}
			if err := s.SaveChunk(ctx, sid, GenerateChunk(sid, cx, cy)); err != nil {
				return fmt.Errorf("chunk %d,%d: %w", cx, cy, err)
			}
		}
	}
	return nil
}

func (svc *Service) CreateCity(ctx context.Context, c City) error {
	if c.X < 0 || c.Y < 0 || c.X >= MapSize || c.Y >= MapSize {
		return ErrOutOfBounds
	}
	if cur, err := svc.Store.CityAt(ctx, c.ServerID, c.X, c.Y); err != nil {
		return err
	} else if cur != nil {
		return ErrOccupied
	}
	cells, err := svc.Loader.Cells(ctx, c.ServerID, c.X, c.Y)
	if err != nil {
		return err
	}
	cell, ok := cellAt(cells, c.X, c.Y)
	if !ok || !cell.Buildable() {
		return ErrBadTerrain
	}
	return svc.Store.CreateCity(ctx, c)
}

func (svc *Service) VisibleTiles(ctx context.Context, sid int32, pid int64) ([]Coord, error) {
	cities, err := svc.Store.PlayerCities(ctx, sid, pid)
	if err != nil {
		return nil, err
	}
	seen := map[string]Coord{}
	for _, city := range cities {
		for dy := -VisionRadius; dy <= VisionRadius; dy++ {
			for dx := -VisionRadius; dx <= VisionRadius; dx++ {
				if cheb(dx, dy) > VisionRadius {
					continue
				}
				x, y := city.X+dx, city.Y+dy
				if x < 0 || y < 0 || x >= MapSize || y >= MapSize {
					continue
				}
				seen[fmt.Sprintf("%d:%d", x, y)] = Coord{X: x, Y: y}
			}
		}
	}
	out := make([]Coord, 0, len(seen))
	for _, c := range seen {
		out = append(out, c)
	}
	return out, nil
}

func cheb(dx, dy int) int {
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}
	if dx > dy {
		return dx
	}
	return dy
}

func (svc *Service) RefreshWildResources(ctx context.Context, sid int32) (int, error) {
	n := 0
	for cy := 0; cy < ChunksPerAxis; cy++ {
		for cx := 0; cx < ChunksPerAxis; cx++ {
			cells, ok, err := svc.Store.LoadChunk(ctx, sid, cx, cy)
			if err != nil || !ok {
				continue
			}
			changed := false
			for i := range cells {
				if cells[i].ResourceType == 0 || cells[i].ResourceLevel >= 5 {
					continue
				}
				cells[i].ResourceLevel++
				changed = true
				n++
				if err := svc.Store.ClearResourceOccupancy(ctx, sid, cells[i].X, cells[i].Y); err != nil {
					return n, err
				}
			}
			if !changed {
				continue
			}
			if err := svc.Store.SaveChunk(ctx, sid, cells); err != nil {
				return n, err
			}
		}
	}
	return n, nil
}
