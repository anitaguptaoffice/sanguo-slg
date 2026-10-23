package quest

import (
	"context"
	"errors"
)

// ProgressEventKind identifies gameplay hooks that advance quest counters.
//
// Hooked events (QUEST-002 / QUEST-003; for CLIENT-009 / INTG-008):
//   - recruit_hero — hero.v1.RecruitHero success
//   - collect_resource — domestic city wallet accrual / resource gain
//   - train_troops — military.v1.RecruitTroop success (troops enqueued; see events_test.go)
//   - build_level — domestic build queue job completed (flush via domestic.Tick)
//   - use_item — content.v1.UseConsumable success
type ProgressEventKind string

const (
	EventRecruitHero     ProgressEventKind = "recruit_hero"
	EventCollectResource ProgressEventKind = "collect_resource"
	EventTrainTroops     ProgressEventKind = "train_troops"
	EventBuildLevel      ProgressEventKind = "build_level"
	EventUseItem         ProgressEventKind = "use_item"
)

// ProgressEvent is a thin gameplay signal from api hooks.
type ProgressEvent struct {
	Kind          ProgressEventKind
	Delta         int32
	Resource      string // food, wood, iron, stone, silver — for collect_resource
	UnitCode      string // infantry, cavalry, any — for train_troops
	ItemCode      string // for use_item
	BuildingCfgID int32  // for build_level
	BuildLevel    int32  // building level after upgrade completes
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
	case EventTrainTroops:
		if obj.Type != "train_troops" {
			return false
		}
		want := obj.UnitCode
		if want == "" || want == "any" {
			return ev.UnitCode != ""
		}
		return want == ev.UnitCode
	case EventBuildLevel:
		if obj.Type != "build_level" {
			return false
		}
		if obj.BuildingCfgID != 0 && obj.BuildingCfgID != ev.BuildingCfgID {
			return false
		}
		if obj.Level > 0 && ev.BuildLevel < obj.Level {
			return false
		}
		return ev.BuildingCfgID != 0 && ev.BuildLevel > 0
	case EventUseItem:
		if obj.Type != "use_item" {
			return false
		}
		if ev.ItemCode == "" || obj.ItemCode == "" {
			return false
		}
		return ev.ItemCode == obj.ItemCode
	default:
		return false
	}
}

func errorsIsBenignProgress(err error) bool {
	return errors.Is(err, ErrNotInProgress) || errors.Is(err, ErrQuestNotFound)
}
