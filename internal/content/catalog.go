package content

import (
	"encoding/json"
	"fmt"
	"io"
)

// Catalog holds static item definitions and bag limits from seed data.
type Catalog struct {
	BagMaxDistinctItems int32
	Items               map[int32]ItemDef
	ByCode              map[string]ItemDef
}

type seedCatalog struct {
	BagMaxDistinctItems int32 `json:"bag_max_distinct_items"`
	Items               []struct {
		ItemCfgID int32          `json:"item_cfg_id"`
		Code      string         `json:"code"`
		Name      string         `json:"name"`
		ItemType  int16          `json:"item_type"`
		MaxStack  int32          `json:"max_stack"`
		Meta      map[string]any `json:"meta"`
	} `json:"items"`
}

// LoadCatalog parses seed JSON (same shape as internal/content/seed/catalog.json).
func LoadCatalog(r io.Reader) (*Catalog, error) {
	var raw seedCatalog
	if err := json.NewDecoder(r).Decode(&raw); err != nil {
		return nil, fmt.Errorf("content: decode catalog: %w", err)
	}
	if raw.BagMaxDistinctItems <= 0 {
		return nil, fmt.Errorf("content: bag_max_distinct_items must be positive")
	}
	cat := &Catalog{
		BagMaxDistinctItems: raw.BagMaxDistinctItems,
		Items:               make(map[int32]ItemDef, len(raw.Items)),
		ByCode:              make(map[string]ItemDef, len(raw.Items)),
	}
	for _, row := range raw.Items {
		if row.ItemCfgID <= 0 {
			return nil, fmt.Errorf("content: invalid item_cfg_id %d", row.ItemCfgID)
		}
		if row.MaxStack <= 0 {
			return nil, fmt.Errorf("content: item %d max_stack must be positive", row.ItemCfgID)
		}
		def := ItemDef{
			ID:       row.ItemCfgID,
			Code:     row.Code,
			Name:     row.Name,
			Type:     ItemType(row.ItemType),
			MaxStack: row.MaxStack,
			Meta:     row.Meta,
		}
		if _, dup := cat.Items[def.ID]; dup {
			return nil, fmt.Errorf("content: duplicate item_cfg_id %d", def.ID)
		}
		cat.Items[def.ID] = def
		cat.ByCode[def.Code] = def
	}
	if len(cat.Items) == 0 {
		return nil, fmt.Errorf("content: catalog has no items")
	}
	return cat, nil
}

// DefaultCatalog loads the embedded seed catalog generated from spec/data/source/items.yml.
func DefaultCatalog() (*Catalog, error) {
	return EmbeddedCatalog()
}
