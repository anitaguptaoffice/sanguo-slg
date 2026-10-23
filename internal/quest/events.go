package quest

import (
	"context"
	"errors"
)

// ProgressEventKind identifies gameplay hooks that advance quest counters.
type ProgressEventKind string

const (
	EventRecruitHero     ProgressEventKind = "recruit_hero"
	EventCollectResource ProgressEventKind = "collect_resource"
)

// ProgressEvent is a thin gameplay signal from api hooks.
type ProgressEvent struct {
	Kind     ProgressEventKind
	Delta    int32
	Resource string // food, wood, iron, stone, silver — for collect_resource
}

// ApplyProgressEvent advances matching in-progress daily quests (quest_type=2).
func (s *Service) ApplyProgressEvent(ctx context.Context, actor Actor, ev ProgressEvent) error {
	if ev.Delta <= 0 && ev.Kind != EventRecruitHero {
		return nil
	}
	rows, err := s.store.ListPlayerQuests(ctx, actor.ServerID, actor.PlayerID)
	if err != nil {
		return err
	}
	byID := make(map[int32]PlayerQuestRow, len(rows))
	for _, r := range rows {
		byID[r.QuestCfgID] = r
	}
	for _, cfg := range s.catalog.All() {
		if cfg.QuestType != QuestTypeDaily {
			continue
		}
		row, has := byID[cfg.QuestCfgID]
		if !has || row.State != StateInProgress {
			continue
		}
		if !eventMatchesObjective(cfg, ev) {
			continue
		}
		delta := ev.Delta
		if delta <= 0 && ev.Kind == EventRecruitHero {
			delta = 1
		}
		if delta <= 0 {
			continue
		}
		_, _, err := s.ReportQuestProgress(ctx, actor, cfg.QuestCfgID, false, delta)
		if err != nil && !errorsIsBenignProgress(err) {
			return err
		}
	}
	return nil
}

func eventMatchesObjective(cfg QuestCfg, ev ProgressEvent) bool {
	if len(cfg.Objectives) == 0 {
		return false
	}
	obj := cfg.Objectives[0]
	switch ev.Kind {
	case EventRecruitHero:
		return obj.Type == "recruit_hero"
	case EventCollectResource:
		if obj.Type != "collect_resource" {
			return false
		}
		if ev.Resource == "" {
			return false
		}
		res := obj.Resource
		if res == "" {
			res = "food"
		}
		return res == ev.Resource
	default:
		return false
	}
}

func errorsIsBenignProgress(err error) bool {
	return errors.Is(err, ErrNotInProgress) || errors.Is(err, ErrQuestNotFound)
}
