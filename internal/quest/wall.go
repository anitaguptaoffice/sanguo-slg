package quest

import (
	"bytes"
	"context"
	"encoding/json"
)

// wallConfig validates the complete immutable identity, not a numeric range.
func wallConfig(cfg QuestCfg) error {
	if cfg.QuestCfgID != 1006 || cfg.Code != "chain200_wall" || cfg.QuestType != 1 || cfg.ChainID != 200 || cfg.SortInChain != 1 || cfg.PrevQuestCfgID != 0 || cfg.UnlockLevel != 5 || cfg.Repeatable || len(cfg.Objectives) != 1 || cfg.Objectives[0] != (Objective{Type: "build_level", BuildingCfgID: 7, Level: 1}) || !wallRewards(cfg.Rewards) {
		return ErrProgressInvalid
	}
	return nil
}

// Display strings / reward-pack labels do not participate in content identity.
func wallRewards(r RewardBundle) bool {
	return len(r.Resources) == 1 && r.Resources["wood"] == 800 && len(r.Items) == 1 && r.Items[0] == (RewardItem{ItemCfgID: 2018, Quantity: 1})
}

// CompletedWallLevel is a pure durable-proof floor (1 or 6). It never checks
// unlocks, calls a level/facts provider, looks up receipts, or writes any state.
// Combine with CompletedTutorialLevel outside the unlock provider's recovery
// orchestration. Claimable proof and consumed unverified history contribute 1.
func (s *Service) CompletedWallLevel(ctx context.Context, actor Actor) (int32, error) {
	cfg, ok := s.catalog.Get(1006)
	if !ok {
		return 1, nil
	} // Deliberately partial development/test catalogs.
	if err := wallConfig(cfg); err != nil {
		return 0, err
	}
	row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
	if err != nil {
		return 0, err
	}
	if has {
		if err := validateProof(row); err != nil {
			return 0, err
		}
		if row.State == StateCompleted && row.Progress.ServerVerifiedVersion == 2 {
			return 6, nil
		}
	}
	return 1, nil
}

// Preserve exact raw objective identity before conversion to the typed catalog.
func parseWallObjectivesJSON(raw []byte) ([]Objective, error) {
	if !json.Valid(raw) {
		return nil, ErrProgressInvalid
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var objectives []Objective
	if err := decoder.Decode(&objectives); err != nil {
		return nil, err
	}
	return objectives, nil
}
