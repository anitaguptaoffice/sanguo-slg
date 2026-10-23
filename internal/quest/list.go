package quest

import "context"

// ListQuestsFilter scopes ListPlayerQuests (chain_id and/or quest_type).
type ListQuestsFilter struct {
	ChainIDs         []int32
	QuestType        int16
	IncludeCompleted bool
}

// ListPlayerQuests returns quest views and chain summaries for the filter.
func (s *Service) ListPlayerQuests(ctx context.Context, actor Actor, f ListQuestsFilter) ([]PlayerQuestProgress, []QuestChainStatus, error) {
	chainIDs := f.ChainIDs
	if len(chainIDs) == 0 {
		chainIDs = distinctChainIDs(s.catalog)
	}
	var quests []PlayerQuestProgress
	var chains []QuestChainStatus
	for _, cid := range chainIDs {
		st, views, err := s.GetQuestChainStatus(ctx, actor, cid)
		if err != nil {
			return nil, nil, err
		}
		chains = append(chains, st)
		for _, v := range views {
			cfg, ok := s.catalog.Get(v.QuestCfgID)
			if !ok {
				continue
			}
			if f.QuestType != 0 && cfg.QuestType != f.QuestType {
				continue
			}
			if !f.IncludeCompleted && v.State == PlayerQuestStateCompleted {
				continue
			}
			quests = append(quests, v)
		}
	}
	return quests, chains, nil
}

func distinctChainIDs(cat Catalog) []int32 {
	seen := make(map[int32]struct{})
	var out []int32
	for _, q := range cat.All() {
		if q.ChainID == 0 {
			continue
		}
		if _, ok := seen[q.ChainID]; ok {
			continue
		}
		seen[q.ChainID] = struct{}{}
		out = append(out, q.ChainID)
	}
	return out
}
