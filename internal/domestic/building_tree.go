package domestic

import (
	"embed"
	"encoding/json"
	"fmt"
	"sync"
)

//go:embed seed/building_catalog.json
var buildingSeed embed.FS

// BuildingPrereq is one cross-building level requirement.
type BuildingPrereq struct {
	CfgID int32
	Level int32
}

// BuildingLevel is the explicit cost/time/prerequisite row for one level.
type BuildingLevel struct {
	Level     int32
	Cost      Resources
	TimeSec   int64
	HallLevel int32
	Prereqs   []BuildingPrereq
}

// BuildingDef is the R2-S1 full tree contract for one building.
type BuildingDef struct {
	ID         int32
	Code       string
	Name       string
	Category   string
	SlotType   string
	UnlockHall int32
	MaxLevel   int32
	Levels     []BuildingLevel
}

// Level returns the explicit row for a level, or nil when out of range.
func (d BuildingDef) Level(level int32) *BuildingLevel {
	if level < 1 || int(level) > len(d.Levels) {
		return nil
	}
	return &d.Levels[level-1]
}

var (
	buildingTreeOnce sync.Once
	buildingTree     map[int32]BuildingDef
	buildingTreeErr  error
)

// DefaultBuildingTree returns the embedded 20-building, 16-level tree.
func DefaultBuildingTree() map[int32]BuildingDef {
	buildingTreeOnce.Do(func() {
		raw, err := buildingSeed.ReadFile("seed/building_catalog.json")
		if err != nil {
			buildingTreeErr = err
			return
		}
		buildingTree, buildingTreeErr = loadBuildingTree(raw)
	})
	if buildingTreeErr != nil {
		panic(buildingTreeErr)
	}
	return buildingTree
}

func loadBuildingTree(raw []byte) (map[int32]BuildingDef, error) {
	var doc struct {
		Version   int `json:"version"`
		Buildings []struct {
			ID         int32  `json:"building_cfg_id"`
			Code       string `json:"code"`
			Name       string `json:"name"`
			Category   string `json:"category"`
			SlotType   string `json:"slot_type"`
			UnlockHall int32  `json:"unlock_hall"`
			MaxLevel   int32  `json:"max_level"`
			Levels     []struct {
				Level int32 `json:"level"`
				Cost  struct {
					Food, Wood, Stone, Iron int64
				} `json:"cost"`
				TimeSec   int64 `json:"time_sec"`
				HallLevel int32 `json:"hall_level"`
				Prereqs   []struct {
					CfgID int32 `json:"cfg_id"`
					Level int32 `json:"level"`
				} `json:"prereqs"`
			} `json:"levels"`
		} `json:"buildings"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("domestic: parse building catalog: %w", err)
	}
	if doc.Version != 1 {
		return nil, fmt.Errorf("domestic: unsupported building catalog version %d", doc.Version)
	}
	out := make(map[int32]BuildingDef, len(doc.Buildings))
	for _, b := range doc.Buildings {
		if b.ID <= 0 || b.Code == "" || b.MaxLevel <= 0 || len(b.Levels) != int(b.MaxLevel) {
			return nil, fmt.Errorf("domestic: invalid building %+v", b)
		}
		def := BuildingDef{ID: b.ID, Code: b.Code, Name: b.Name, Category: b.Category,
			SlotType: b.SlotType, UnlockHall: b.UnlockHall, MaxLevel: b.MaxLevel}
		for i, row := range b.Levels {
			if row.Level != int32(i+1) {
				return nil, fmt.Errorf("domestic: building %d level order %d", b.ID, row.Level)
			}
			level := BuildingLevel{Level: row.Level, TimeSec: row.TimeSec, HallLevel: row.HallLevel,
				Cost: Resources{Food: row.Cost.Food, Wood: row.Cost.Wood, Stone: row.Cost.Stone, Iron: row.Cost.Iron}}
			for _, req := range row.Prereqs {
				level.Prereqs = append(level.Prereqs, BuildingPrereq{CfgID: req.CfgID, Level: req.Level})
			}
			def.Levels = append(def.Levels, level)
		}
		if _, exists := out[def.ID]; exists {
			return nil, fmt.Errorf("domestic: duplicate building %d", def.ID)
		}
		out[def.ID] = def
	}
	if len(out) != 20 {
		return nil, fmt.Errorf("domestic: expected 20 buildings, got %d", len(out))
	}
	return out, nil
}

// buildingLevel returns a placed building's level, or zero.
func buildingLevel(c *CityState, cfgID int32) int32 {
	for _, inst := range c.Buildings {
		if inst != nil && inst.CfgID == cfgID {
			return inst.Level
		}
	}
	return 0
}
