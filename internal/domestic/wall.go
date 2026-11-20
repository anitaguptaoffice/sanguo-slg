package domestic

import (
	"context"
	"errors"
)

var (
	ErrWallUnavailable = errors.New("domestic: wall defenses unavailable")
	ErrWallCapacity    = errors.New("domestic: wall area exhausted")
)

// WallDefenseSpec is one of the five R2-S5 wall defenses.
type WallDefenseSpec struct {
	Type  int32
	Code  string
	Name  string
	Cost  Resources
	Space int32
}

func WallDefenseCatalog() []WallDefenseSpec {
	return []WallDefenseSpec{
		{1, "trap", "陷阱", Resources{Food: 40, Wood: 60}, 1},
		{2, "stakes", "拒马", Resources{Food: 60, Wood: 80, Iron: 20}, 2},
		{3, "tower", "箭塔", Resources{Food: 120, Wood: 100, Stone: 80, Iron: 50}, 5},
		{4, "log", "滚木", Resources{Food: 50, Wood: 120}, 3},
		{5, "rock", "礌石", Resources{Food: 40, Wood: 30, Stone: 120}, 4},
	}
}

// WallArea is the total construction space from the wall level.
func WallArea(c *CityState) int32 {
	if c == nil {
		return 0
	}
	if wall := c.Buildings["wall"]; wall != nil && wall.Level > 0 {
		return wall.Level * 20
	}
	return 0
}

// WallAreaUsed is the space consumed by built defenses.
func WallAreaUsed(c *CityState) int32 {
	var used int32
	catalog := WallDefenseCatalog()
	for i, count := range c.Wall {
		if i < len(catalog) {
			used += count * catalog[i].Space
		}
	}
	return used
}

// WallDefenseView is one defense row.
type WallDefenseView struct {
	Type  int32
	Code  string
	Name  string
	Count int32
	Space int32
	Cost  Resources
}

// WallDefenses lists the five defenses plus area usage.
func (h *Hub) WallDefenses(ctx context.Context, cityID int64) ([]WallDefenseView, int32, int32, error) {
	var views []WallDefenseView
	var area, used int32
	h.mu.Lock()
	defer h.mu.Unlock()
	city := h.cities[cityID]
	if city == nil {
		return nil, 0, 0, ErrCityNotFound
	}
	err := h.updateCityLocked(ctx, cityID, func(c *CityState) error {
		area, used = WallArea(c), WallAreaUsed(c)
		for _, spec := range WallDefenseCatalog() {
			views = append(views, WallDefenseView{Type: spec.Type, Code: spec.Code, Name: spec.Name,
				Count: c.Wall[spec.Type-1], Space: spec.Space, Cost: spec.Cost})
		}
		return nil
	})
	if err != nil {
		return nil, 0, 0, err
	}
	return views, area, used, nil
}

// BuildWallDefense adds one defense after checking wall area and resources.
func (h *Hub) BuildWallDefense(ctx context.Context, cityID int64, defenseType int32) ([]WallDefenseView, int32, int32, error) {
	if defenseType < 1 || defenseType > 5 {
		return nil, 0, 0, ErrWallUnavailable
	}
	var views []WallDefenseView
	var area, used int32
	h.mu.Lock()
	defer h.mu.Unlock()
	city := h.cities[cityID]
	if city == nil {
		return nil, 0, 0, ErrCityNotFound
	}
	spec := WallDefenseCatalog()[defenseType-1]
	err := h.updateCityLocked(ctx, cityID, func(c *CityState) error {
		area, used = WallArea(c), WallAreaUsed(c)
		if area <= 0 {
			return ErrWallUnavailable
		}
		if used+spec.Space > area {
			return ErrWallCapacity
		}
		if !c.Wallet.Sub(spec.Cost) {
			return ErrInsufficientRes
		}
		c.Wall[defenseType-1]++
		used += spec.Space
		for _, s := range WallDefenseCatalog() {
			views = append(views, WallDefenseView{Type: s.Type, Code: s.Code, Name: s.Name,
				Count: c.Wall[s.Type-1], Space: s.Space, Cost: s.Cost})
		}
		return nil
	})
	if err != nil {
		return nil, 0, 0, err
	}
	return views, area, used, nil
}
