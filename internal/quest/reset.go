package quest

import "context"

func (s *Service) ensureDailyFresh(ctx context.Context, cfg QuestCfg, row *PlayerQuestRow) error {
	if row == nil || !ShouldResetDailyQuest(cfg, *row, s.now()) {
		return nil
	}
	*row = ResetDailyRow(*row, s.now())
	return s.store.UpsertPlayerQuest(ctx, *row)
}

func (s *Service) getPlayerQuestFresh(ctx context.Context, actor Actor, questCfgID int32) (QuestCfg, PlayerQuestRow, bool, error) {
	cfg, ok := s.catalog.Get(questCfgID)
	if !ok {
		return QuestCfg{}, PlayerQuestRow{}, false, ErrQuestNotFound
	}
	row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, questCfgID)
	if err != nil {
		return QuestCfg{}, PlayerQuestRow{}, false, err
	}
	if has {
		if err := s.ensureDailyFresh(ctx, cfg, &row); err != nil {
			return QuestCfg{}, PlayerQuestRow{}, false, err
		}
	}
	return cfg, row, has, nil
}
