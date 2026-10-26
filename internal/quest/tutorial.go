package quest

import (
	"context"
	"fmt"
)

// TutorialFacts contains only persisted facts belonging to the requested actor.
// Levels are maxima per building config across owned cities, excluding queued
// upgrades. HasOwnedHero includes every persisted owned hero status.
type TutorialFacts struct {
	CompletedBuildingLevels map[int32]int32
	HasOwnedHero            bool
}

type TutorialFactsProvider func(context.Context, Actor) (TutorialFacts, error)

// SetTutorialFactsProvider wires the API-owned adapter at startup only; do not
// mutate it concurrently with requests. Nil disables reconciliation, not proof
// requirements at the separate claim/public Report gates.
func (s *Service) SetTutorialFactsProvider(provider TutorialFactsProvider) {
	s.tutorialFacts = provider
}

// ReconcileTutorial is the successful-action hook. It never accepts or rewards
// quests. Missing catalog entries are not invented (the dev catalog is partial).
func (s *Service) ReconcileTutorial(ctx context.Context, actor Actor) error {
	if s.tutorialFacts == nil {
		return nil
	}
	for id := int32(1001); id <= 1005; id++ {
		cfg, ok := s.catalog.Get(id)
		if !ok {
			continue
		}
		row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, id)
		if err != nil {
			return err
		}
		if _, err := s.reconcileTutorialRow(ctx, actor, cfg, row, has); err != nil {
			return err
		}
	}
	return nil
}

func tutorialObjective(cfg QuestCfg) (Objective, error) {
	objectives := [...]Objective{
		{Type: "build_level", BuildingCfgID: 1, Level: 2},
		{Type: "recruit_hero", Count: 1},
		{Type: "build_level", BuildingCfgID: 2, Level: 3},
		{Type: "build_level", BuildingCfgID: 3, Level: 2},
		{Type: "build_level", BuildingCfgID: 6, Level: 2},
	}
	if !IsAuthoritativeTutorial(cfg) {
		return Objective{}, fmt.Errorf("%w: tutorial identity", ErrProgressInvalid)
	}
	i := cfg.QuestCfgID - 1001
	prev, unlock := cfg.QuestCfgID-1, i
	if i == 0 {
		prev = 0
	}
	if unlock < 1 {
		unlock = 1
	}
	if cfg.QuestType != 1 || cfg.Repeatable || cfg.PrevQuestCfgID != prev || cfg.SortInChain != int16(i+1) || cfg.UnlockLevel != unlock || len(cfg.Objectives) != 1 || cfg.Objectives[0] != objectives[i] {
		return Objective{}, fmt.Errorf("%w: tutorial config %d", ErrProgressInvalid, cfg.QuestCfgID)
	}
	return objectives[i], nil
}

func (s *Service) reconcileTutorialRow(ctx context.Context, actor Actor, cfg QuestCfg, row PlayerQuestRow, has bool) (PlayerQuestRow, error) {
	if s.tutorialFacts == nil || !isTutorialID(cfg.QuestCfgID) {
		return row, nil
	}
	obj, err := tutorialObjective(cfg)
	if err != nil {
		return row, err
	}
	if !has || row.State == StateUnaccepted || row.State == StateCompleted || row.Progress.ServerVerifiedVersion == 1 {
		return row, nil
	}
	if row.AcceptedAt == nil || (row.State != StateInProgress && row.State != StateClaimable) {
		return row, ErrNotInProgress
	}
	if err := s.checkPrerequisite(ctx, actor, cfg); err != nil {
		return row, err
	}
	if err := s.checkUnlock(ctx, actor, cfg); err != nil {
		return row, err
	}
	facts, err := s.tutorialFacts(ctx, actor)
	if err != nil {
		return row, err
	}
	met := facts.HasOwnedHero
	if obj.Type == "build_level" {
		met = facts.CompletedBuildingLevels[obj.BuildingCfgID] >= obj.Level
	}
	if met {
		now := s.now()
		row.State, row.Progress = StateClaimable, ProgressCounter{Count: 1, ServerVerifiedVersion: 1}
		row.CompletedAt, row.UpdatedAt = &now, now
		if err := s.store.UpsertPlayerQuest(ctx, row); err != nil {
			return row, err
		}
	}
	// Even unmet facts may race a successful reconcile/claim. Never return the
	// pre-provider snapshot or the proposed write instead of the merged row.
	fresh, exists, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, cfg.QuestCfgID)
	if err == nil && !exists {
		err = ErrNotInProgress
	}
	return fresh, err
}
