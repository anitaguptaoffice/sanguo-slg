package quest

import (
	"encoding/json"
	"fmt"
)

// Catalog supplies cfg_quest definitions (DB loader or in-memory for tests).
type Catalog interface {
	Get(questCfgID int32) (QuestCfg, bool)
	ListByChain(chainID int32) []QuestCfg
	ListByQuestType(questType int16) []QuestCfg
	All() []QuestCfg
}

// MemCatalog is an in-memory quest catalog.
type MemCatalog struct {
	byID map[int32]QuestCfg
}

// NewMemCatalog indexes quests and wires next_quest_cfg_id from prev links.
func NewMemCatalog(quests []QuestCfg) *MemCatalog {
	byID := make(map[int32]QuestCfg, len(quests))
	for _, q := range quests {
		byID[q.QuestCfgID] = q
	}
	for id, q := range byID {
		for _, other := range byID {
			if other.PrevQuestCfgID == id {
				q.NextQuestCfgID = other.QuestCfgID
				byID[id] = q
				break
			}
		}
	}
	return &MemCatalog{byID: byID}
}

func (m *MemCatalog) Get(questCfgID int32) (QuestCfg, bool) {
	q, ok := m.byID[questCfgID]
	return q, ok
}

func (m *MemCatalog) ListByChain(chainID int32) []QuestCfg {
	var out []QuestCfg
	for _, q := range m.byID {
		if q.ChainID == chainID {
			out = append(out, q)
		}
	}
	return out
}

func (m *MemCatalog) ListByQuestType(questType int16) []QuestCfg {
	var out []QuestCfg
	for _, q := range m.byID {
		if q.QuestType == questType {
			out = append(out, q)
		}
	}
	return out
}

func (m *MemCatalog) All() []QuestCfg {
	out := make([]QuestCfg, 0, len(m.byID))
	for _, q := range m.byID {
		out = append(out, q)
	}
	return out
}

// ParseRewardsJSON decodes cfg_quest.rewards / content.md schema.
func ParseRewardsJSON(raw []byte) (RewardBundle, error) {
	if len(raw) == 0 || string(raw) == "{}" {
		return RewardBundle{}, nil
	}
	var wire struct {
		RewardPackID string `json:"reward_pack_id"`
		Resources    map[string]int64 `json:"resources"`
		Items        []struct {
			ItemCfgID int32 `json:"item_cfg_id"`
			Qty       int32 `json:"qty"`
			Quantity  int32 `json:"quantity"`
		} `json:"items"`
	}
	if err := json.Unmarshal(raw, &wire); err != nil {
		return RewardBundle{}, err
	}
	items := make([]RewardItem, 0, len(wire.Items))
	for _, it := range wire.Items {
		qty := it.Qty
		if qty == 0 {
			qty = it.Quantity
		}
		items = append(items, RewardItem{ItemCfgID: it.ItemCfgID, Quantity: qty})
	}
	return RewardBundle{
		RewardPackID: wire.RewardPackID,
		Items:        items,
		Resources:    wire.Resources,
	}, nil
}

// ParseObjectivesJSON decodes cfg_quest.objectives.
func ParseObjectivesJSON(raw []byte) ([]Objective, error) {
	if len(raw) == 0 || string(raw) == "[]" {
		return nil, nil
	}
	var wire []Objective
	if err := json.Unmarshal(raw, &wire); err != nil {
		return nil, err
	}
	return wire, nil
}

// ProgressTargetFor returns the counter target for simple count/level objectives.
func ProgressTargetFor(objs []Objective) int32 {
	if len(objs) == 0 {
		return 1
	}
	o := objs[0]
	if o.Count > 0 {
		return o.Count
	}
	if o.Type == "build_level" {
		return 1
	}
	if o.Level > 0 {
		return o.Level
	}
	return 1
}

func chainDisplayName(chainID int32) string {
	if chainID == 0 {
		return ""
	}
	return fmt.Sprintf("chain_%d", chainID)
}
