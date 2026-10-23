package content

import (
	"fmt"
)

// UseResult describes what happened when a consumable was used.
type UseResult struct {
	ItemCfgID int32
	Remaining int32
	Grants    *ResourceGrants
	Speedup   *SpeedupEffect
	Recruit   *RecruitEffect
	Train     *TrainTroopEffect
}

// Use consumes count units of a consumable item and returns its effect.
// Supports item_type 1 (resource pack) and 2 (speedup).
func (s *Service) Use(p PlayerRef, itemCfgID int32, count int32) (UseResult, error) {
	if count <= 0 {
		return UseResult{}, ErrInvalidQuantity
	}
	def, err := s.itemDef(itemCfgID)
	if err != nil {
		return UseResult{}, err
	}
	switch def.Type {
	case ItemTypeResourcePack:
		grants, err := parseResourceGrants(def, count)
		if err != nil {
			return UseResult{}, err
		}
		rem, err := s.Remove(p, itemCfgID, count)
		if err != nil {
			return UseResult{}, err
		}
		s.mu.Lock()
		s.creditWallet(p, resourceWalletFromGrants(grants))
		s.mu.Unlock()
		return UseResult{ItemCfgID: itemCfgID, Remaining: rem, Grants: &grants}, nil
	case ItemTypeSpeedup:
		effect, err := parseSpeedup(def, count)
		if err != nil {
			return UseResult{}, err
		}
		rem, err := s.Remove(p, itemCfgID, count)
		if err != nil {
			return UseResult{}, err
		}
		return UseResult{ItemCfgID: itemCfgID, Remaining: rem, Speedup: &effect}, nil
	case ItemTypeRecruit:
		effect, err := parseRecruit(def, count)
		if err != nil {
			return UseResult{}, err
		}
		rem, err := s.Remove(p, itemCfgID, count)
		if err != nil {
			return UseResult{}, err
		}
		return UseResult{ItemCfgID: itemCfgID, Remaining: rem, Recruit: &effect}, nil
	case ItemTypeTrainTroop:
		effect, err := parseTrainTroop(def, count)
		if err != nil {
			return UseResult{}, err
		}
		rem, err := s.Remove(p, itemCfgID, count)
		if err != nil {
			return UseResult{}, err
		}
		return UseResult{ItemCfgID: itemCfgID, Remaining: rem, Train: &effect}, nil
	default:
		return UseResult{}, ErrNotConsumable
	}
}

func resourceWalletFromGrants(g ResourceGrants) ResourceWallet {
	return ResourceWallet{Food: g.Food, Wood: g.Wood, Iron: g.Iron, Stone: g.Stone}
}

func parseRecruit(def ItemDef, count int32) (RecruitEffect, error) {
	pool, _ := def.Meta["hero_pool"].(string)
	if pool == "" {
		return RecruitEffect{}, fmt.Errorf("content: item %d missing meta.hero_pool", def.ID)
	}
	draws := int32(1)
	if raw, ok := def.Meta["draws"]; ok {
		n, err := asInt64(raw)
		if err != nil {
			return RecruitEffect{}, fmt.Errorf("content: item %d draws: %w", def.ID, err)
		}
		draws = int32(n)
	}
	return RecruitEffect{HeroPool: pool, Draws: draws * count}, nil
}

func parseTrainTroop(def ItemDef, count int32) (TrainTroopEffect, error) {
	code, _ := def.Meta["unit_code"].(string)
	if code == "" {
		return TrainTroopEffect{}, fmt.Errorf("content: item %d missing meta.unit_code", def.ID)
	}
	per, err := asInt64(def.Meta["count"])
	if err != nil {
		return TrainTroopEffect{}, fmt.Errorf("content: item %d count: %w", def.ID, err)
	}
	return TrainTroopEffect{UnitCode: code, Count: per * int64(count)}, nil
}

func parseResourceGrants(def ItemDef, count int32) (ResourceGrants, error) {
	raw, ok := def.Meta["grants"]
	if !ok {
		return ResourceGrants{}, fmt.Errorf("content: item %d missing meta.grants", def.ID)
	}
	m, ok := raw.(map[string]any)
	if !ok {
		return ResourceGrants{}, fmt.Errorf("content: item %d invalid meta.grants", def.ID)
	}
	var g ResourceGrants
	for k, v := range m {
		n, err := asInt64(v)
		if err != nil {
			return ResourceGrants{}, fmt.Errorf("content: item %d grants.%s: %w", def.ID, k, err)
		}
		switch k {
		case "food":
			g.Food = n * int64(count)
		case "wood":
			g.Wood = n * int64(count)
		case "stone":
			g.Stone = n * int64(count)
		case "iron":
			g.Iron = n * int64(count)
		default:
			return ResourceGrants{}, fmt.Errorf("content: item %d unknown grant %q", def.ID, k)
		}
	}
	return g, nil
}

func parseSpeedup(def ItemDef, count int32) (SpeedupEffect, error) {
	secRaw, ok := def.Meta["speedup_sec"]
	if !ok {
		return SpeedupEffect{}, fmt.Errorf("content: item %d missing meta.speedup_sec", def.ID)
	}
	sec, err := asInt64(secRaw)
	if err != nil {
		return SpeedupEffect{}, fmt.Errorf("content: item %d speedup_sec: %w", def.ID, err)
	}
	var applies []string
	if raw, ok := def.Meta["applies_to"]; ok {
		arr, ok := raw.([]any)
		if !ok {
			return SpeedupEffect{}, fmt.Errorf("content: item %d invalid applies_to", def.ID)
		}
		for _, el := range arr {
			s, ok := el.(string)
			if !ok {
				return SpeedupEffect{}, fmt.Errorf("content: item %d invalid applies_to entry", def.ID)
			}
			applies = append(applies, s)
		}
	}
	return SpeedupEffect{
		Seconds:   sec * int64(count),
		AppliesTo: applies,
	}, nil
}

func asInt64(v any) (int64, error) {
	switch n := v.(type) {
	case int:
		return int64(n), nil
	case int64:
		return n, nil
	case float64:
		if n != float64(int64(n)) {
			return 0, fmt.Errorf("non-integer number")
		}
		return int64(n), nil
	default:
		return 0, fmt.Errorf("expected number, got %T", v)
	}
}
