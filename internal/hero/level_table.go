package hero

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed seed/hero_levels.json
var embeddedHeroLevelsJSON []byte

// LevelRow mirrors legacy cfg_hero_level (total_exp at level, upgrade_exp cost to reach level+1 on next row).
type LevelRow struct {
	Level      int32 `json:"level"`
	TotalExp   int64 `json:"total_exp"`
	UpgradeExp int64 `json:"upgrade_exp"`
}

// LevelTable is the slim M1 cfg_hero_level (max level 20).
type LevelTable struct {
	byLevel map[int32]LevelRow
}

type seedHeroLevelsDoc struct {
	Levels []LevelRow `json:"levels"`
}

// DefaultLevelTable loads embedded hero level seed.
func DefaultLevelTable() (*LevelTable, error) {
	var doc seedHeroLevelsDoc
	if err := json.Unmarshal(embeddedHeroLevelsJSON, &doc); err != nil {
		return nil, fmt.Errorf("hero: decode level table: %w", err)
	}
	if len(doc.Levels) == 0 {
		return nil, fmt.Errorf("hero: level table is empty")
	}
	t := &LevelTable{byLevel: make(map[int32]LevelRow, len(doc.Levels))}
	for _, row := range doc.Levels {
		if row.Level <= 0 {
			return nil, fmt.Errorf("hero: invalid level row %d", row.Level)
		}
		t.byLevel[row.Level] = row
	}
	if _, ok := t.byLevel[1]; !ok {
		return nil, fmt.Errorf("hero: level table missing level 1")
	}
	return t, nil
}

func (t *LevelTable) row(level int32) (LevelRow, bool) {
	if t == nil {
		return LevelRow{}, false
	}
	r, ok := t.byLevel[level]
	return r, ok
}

// TotalExpForLevel returns cumulative exp to be at the given level (legacy total_exp column).
func (t *LevelTable) TotalExpForLevel(level int32) int64 {
	r, ok := t.row(level)
	if !ok {
		return 0
	}
	return r.TotalExp
}

// UpgradeExpToNext returns exp required to advance from level to level+1 (legacy row level+1.upgrade_exp).
func (t *LevelTable) UpgradeExpToNext(level int32) int64 {
	r, ok := t.row(level + 1)
	if !ok {
		return 0
	}
	return r.UpgradeExp
}

// ExpTowardNext is hero.exp - total_exp(current level); legacy pool before upgradeHero.
func (t *LevelTable) ExpTowardNext(level int32, exp int64) int64 {
	return exp - t.TotalExpForLevel(level)
}
