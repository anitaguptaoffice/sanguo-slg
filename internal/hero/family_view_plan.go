package hero

import (
	"fmt"
	"time"
)

// PlanComingPreview preserves the existing prompt without calling a lazy store.
func PlanComingPreview(p PlayerRef, cityID int64, h *Hero, rec *ComingRecord) (TryAcceptComingResult, error) {
	plan, err := PlanComingReject(p, cityID, h, rec)
	if err != nil {
		return TryAcceptComingResult{}, err
	}
	name := plan.Hero.DisplayName
	if name == "" {
		name = fmt.Sprintf("将领#%d", plan.Hero.HeroID)
	}
	return TryAcceptComingResult{Hero: plan.Hero, Summary: fmt.Sprintf("是否接受将领%s加入麾下？", name)}, nil
}

// PlanPersuadeTargets displays only the existing roster and copies progress;
// absent rows retain the legacy zero fallback without persisting fabricated rows.
func (s *Service) PlanPersuadeTargets(progress map[int32]LionizeRecord) ([]PersuadeTargetView, error) {
	if s == nil {
		return nil, ErrInvalidFamilyState
	}
	now := s.now()
	out := make([]PersuadeTargetView, 0, len(DefaultPersuadeTargets()))
	for _, target := range DefaultPersuadeTargets() {
		rec := progress[target.NpcCfgID]
		view := PersuadeTargetView{Target: target, Friend: rec.Friend, State: rec.State, HireFriendMin: LionizeHireFriendMin}
		if !rec.LastPersuadeAt.IsZero() {
			next := rec.LastPersuadeAt.Add(time.Duration(PersuadeCooldownSeconds) * time.Second)
			if next.After(now) {
				view.NextPersuadeAt = next
			}
		}
		out = append(out, view)
	}
	return out, nil
}
