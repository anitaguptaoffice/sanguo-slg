package world

import (
	"encoding/json"
	"fmt"
	"os"
)

// WildLoot is the resource haul of one wild tile.
type WildLoot struct {
	Food, Wood, Stone, Iron, Gold int64
}

// WildDrop is one weighted item drop.
type WildDrop struct {
	ItemCfgID int32
	Weight    int32
}

// WildTroop is one defender stack of the generated garrison.
type WildTroop struct {
	UnitCfgID int32
	Count     int32
}

// WildLevel is the garrison and reward profile of one wild-land level.
type WildLevel struct {
	Level     int16
	HeroLevel int16
	Troops    []WildTroop
	Loot      WildLoot
	Items     []WildDrop
}

// WildTerrain is the per-terrain wild profile (levels 1..10).
type WildTerrain struct {
	Terrain      Terrain
	Name         string
	BonusPercent WildLoot
	Levels       [11]*WildLevel
}

// WildCamp is the yellow-turban camp profile (npc_kind 1).
type WildCamp struct {
	NpcKind int16
	Name    string
	Levels  [11]*WildLevel
}

// WildConfig is the immutable world_wild configuration loaded at startup.
type WildConfig struct {
	Terrains map[Terrain]*WildTerrain
	Camps    map[int16]*WildCamp
}

type wildJSON struct {
	Version  int `json:"version"`
	Terrains map[string]struct {
		Terrain      int16          `json:"terrain"`
		Name         string         `json:"name"`
		BonusPercent map[string]int `json:"bonus_percent"`
		Levels       []wildLevel    `json:"levels"`
	} `json:"terrains"`
	NpcCamps map[string]struct {
		NpcKind int16       `json:"npc_kind"`
		Name    string      `json:"name"`
		Levels  []wildLevel `json:"levels"`
	} `json:"npc_camps"`
}

type wildLevel struct {
	Level     int16 `json:"level"`
	HeroLevel int16 `json:"hero_level"`
	Troops    []struct {
		UnitCfgID int32 `json:"unit_cfg_id"`
		Count     int32 `json:"count"`
	} `json:"troops"`
	Loot struct {
		Food  int64 `json:"food"`
		Wood  int64 `json:"wood"`
		Stone int64 `json:"stone"`
		Iron  int64 `json:"iron"`
		Gold  int64 `json:"gold"`
	} `json:"loot"`
	Items []struct {
		ItemCfgID int32 `json:"item_cfg_id"`
		Weight    int32 `json:"weight"`
	} `json:"items"`
}

// LoadWildConfig reads the generated world_wild.json contract.
func LoadWildConfig(path string) (*WildConfig, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var doc wildJSON
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	if doc.Version != 1 {
		return nil, fmt.Errorf("world_wild: unsupported version %d", doc.Version)
	}
	out := &WildConfig{Terrains: map[Terrain]*WildTerrain{}, Camps: map[int16]*WildCamp{}}
	for _, entry := range doc.Terrains {
		terrain := Terrain(entry.Terrain)
		if terrain < TerrainPlain || terrain > TerrainSwamp {
			return nil, fmt.Errorf("world_wild: invalid terrain %d", entry.Terrain)
		}
		if entry.Name == "" {
			return nil, fmt.Errorf("world_wild: terrain %d has no name", entry.Terrain)
		}
		wt := &WildTerrain{Terrain: terrain, Name: entry.Name,
			BonusPercent: WildLoot{
				Food: int64(entry.BonusPercent["food"]), Wood: int64(entry.BonusPercent["wood"]),
				Stone: int64(entry.BonusPercent["stone"]), Iron: int64(entry.BonusPercent["iron"]),
				Gold: int64(entry.BonusPercent["gold"]),
			}}
		if err := fillLevels(wt.Levels[:], entry.Levels); err != nil {
			return nil, fmt.Errorf("world_wild: terrain %d: %w", entry.Terrain, err)
		}
		out.Terrains[terrain] = wt
	}
	for _, entry := range doc.NpcCamps {
		if entry.NpcKind <= 0 {
			return nil, fmt.Errorf("world_wild: invalid npc kind %d", entry.NpcKind)
		}
		camp := &WildCamp{NpcKind: entry.NpcKind, Name: entry.Name}
		if err := fillLevels(camp.Levels[:], entry.Levels); err != nil {
			return nil, fmt.Errorf("world_wild: camp %d: %w", entry.NpcKind, err)
		}
		out.Camps[entry.NpcKind] = camp
	}
	if len(out.Terrains) == 0 {
		return nil, fmt.Errorf("world_wild: no terrains")
	}
	return out, nil
}

func fillLevels(dst []*WildLevel, src []wildLevel) error {
	if len(src) != 10 {
		return fmt.Errorf("expected 10 levels, got %d", len(src))
	}
	for _, row := range src {
		if row.Level < 1 || row.Level > 10 {
			return fmt.Errorf("level %d out of range", row.Level)
		}
		level := &WildLevel{Level: row.Level, HeroLevel: row.HeroLevel,
			Loot: WildLoot{Food: row.Loot.Food, Wood: row.Loot.Wood, Stone: row.Loot.Stone, Iron: row.Loot.Iron, Gold: row.Loot.Gold}}
		for _, troop := range row.Troops {
			if troop.UnitCfgID < 1 || troop.UnitCfgID > 4 || troop.Count <= 0 {
				return fmt.Errorf("level %d: invalid troop %+v", row.Level, troop)
			}
			level.Troops = append(level.Troops, WildTroop{UnitCfgID: troop.UnitCfgID, Count: troop.Count})
		}
		if len(level.Troops) == 0 {
			return fmt.Errorf("level %d: empty garrison", row.Level)
		}
		for _, item := range row.Items {
			if item.ItemCfgID <= 0 || item.Weight <= 0 {
				return fmt.Errorf("level %d: invalid drop %+v", row.Level, item)
			}
			level.Items = append(level.Items, WildDrop{ItemCfgID: item.ItemCfgID, Weight: item.Weight})
		}
		dst[row.Level] = level
	}
	return nil
}

// Terrain returns the wild profile for a terrain, or nil for city/unknown.
func (c *WildConfig) Terrain(t Terrain) *WildTerrain {
	if c == nil {
		return nil
	}
	return c.Terrains[t]
}

// Level returns the profile for a terrain level (1..10).
func (t *WildTerrain) Level(level int16) *WildLevel {
	if t == nil || level < 1 || level > 10 {
		return nil
	}
	return t.Levels[level]
}

// Level returns the camp profile for a level (1..10).
func (c *WildCamp) Level(level int16) *WildLevel {
	if c == nil || level < 1 || level > 10 {
		return nil
	}
	return c.Levels[level]
}

// Profile resolves the garrison profile for a tile.
func (c *WildConfig) Profile(cell Cell) *WildLevel {
	switch {
	case cell.NpcKind == 1 && c != nil:
		if camp := c.Camps[cell.NpcKind]; camp != nil {
			return camp.Level(cell.Level)
		}
	case cell.Terrain >= TerrainPlain && cell.Terrain <= TerrainSwamp:
		if t := c.Terrain(cell.Terrain); t != nil {
			return t.Level(cell.Level)
		}
	}
	return nil
}
