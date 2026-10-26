package quest

import "context"

// CompletedTutorialLevel returns the chain100 floor (1..5), not the player's
// persisted level. API callers must persist GREATEST(existing_level, floor),
// including on AlreadyCompleted/relogin/read recovery. This method never grants
// or writes player/quest state. Legacy completed rows do not need v1 proof.
func (s *Service) CompletedTutorialLevel(ctx context.Context, actor Actor) (int32, error) {
	level := int32(1)
	for id := int32(1001); id <= 1005; id++ {
		row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, id)
		if err != nil {
			return 0, err // A failed read must never masquerade as a known floor.
		}
		if !has || row.State != StateCompleted {
			break
		}
		cfg, ok := s.catalog.Get(id)
		if !ok {
			return 0, ErrQuestNotFound
		}
		if _, err := tutorialObjective(cfg); err != nil {
			return 0, err
		}
		level = id - 1000 // Fixed mapping, never future config sort values.
	}
	return level, nil
}
