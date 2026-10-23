package hero

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed seed/heroes.json
var embeddedHeroesJSON []byte

type seedHeroRow struct {
	TemplateCfgID int32 `json:"template_cfg_id"`
	Code          string
	Name          string
	Rarity        int16
	Pool          string
	BaseStats     struct {
		Force, Intel, Politics, Command int32
	} `json:"base_stats"`
	RecruitCost struct {
		Food, Wood, Stone, Iron int64
	} `json:"recruit_cost"`
	RecruitItem struct {
		ItemCfgID int32 `json:"item_cfg_id"`
		Quantity  int32
	} `json:"recruit_item"`
}

type seedHeroesDoc struct {
	Heroes []seedHeroRow `json:"heroes"`
}

// EmbeddedCatalog loads DATA-002-aligned hero templates from internal/hero/seed/heroes.json.
func EmbeddedCatalog() (map[int32]Template, error) {
	var doc seedHeroesDoc
	if err := json.Unmarshal(embeddedHeroesJSON, &doc); err != nil {
		return nil, fmt.Errorf("hero: decode embedded catalog: %w", err)
	}
	if len(doc.Heroes) == 0 {
		return nil, fmt.Errorf("hero: embedded catalog is empty")
	}
	out := make(map[int32]Template, len(doc.Heroes))
	for _, row := range doc.Heroes {
		if row.TemplateCfgID <= 0 {
			return nil, fmt.Errorf("hero: invalid template_cfg_id %d", row.TemplateCfgID)
		}
		t := Template{
			TemplateCfgID: row.TemplateCfgID,
			Code:          row.Code,
			Name:          row.Name,
			Pool:          row.Pool,
			Rarity:        row.Rarity,
			Base: BaseStats{
				Force: row.BaseStats.Force, Intel: row.BaseStats.Intel,
				Politics: row.BaseStats.Politics, Command: row.BaseStats.Command,
			},
			RecruitCost: Resources{
				Food: row.RecruitCost.Food, Wood: row.RecruitCost.Wood,
				Stone: row.RecruitCost.Stone, Iron: row.RecruitCost.Iron,
			},
			RecruitItem: ItemCost{ItemCfgID: row.RecruitItem.ItemCfgID, Quantity: row.RecruitItem.Quantity},
		}
		if t.Pool == "" {
			t.Pool = "standard"
		}
		out[t.TemplateCfgID] = t
	}
	return out, nil
}

// DefaultCatalog returns the embedded DATA-002 hero catalog (falls back to legacy stub on error).
func DefaultCatalog() map[int32]Template {
	cat, err := EmbeddedCatalog()
	if err != nil {
		return legacyDefaultCatalog()
	}
	return cat
}

func legacyDefaultCatalog() map[int32]Template {
	scroll := ItemCost{RecruitScrollID, 1}
	cost5 := Resources{5000, 5000, 3000, 2000}
	cost4 := Resources{3000, 3000, 2000, 1000}
	raw := []Template{
		{1001, "liu_bei", "刘备", "standard", 5, BaseStats{72, 75, 88, 78}, cost5, scroll},
		{1002, "guan_yu", "关羽", "standard", 5, BaseStats{95, 62, 55, 82}, cost5, scroll},
		{1003, "zhang_fei", "张飞", "standard", 4, BaseStats{92, 45, 40, 75}, cost4, scroll},
		{1004, "zhao_yun", "赵云", "standard", 4, BaseStats{88, 70, 58, 85}, cost4, scroll},
		{1005, "huang_zhong", "黄忠", "standard", 4, BaseStats{90, 68, 52, 80}, cost4, scroll},
		{1006, "ma_chao", "马超", "standard", 4, BaseStats{91, 55, 48, 79}, cost4, scroll},
	}
	out := make(map[int32]Template, len(raw))
	for _, t := range raw {
		out[t.TemplateCfgID] = t
	}
	return out
}
