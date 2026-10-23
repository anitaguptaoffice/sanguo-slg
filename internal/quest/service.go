package quest

import (
	"context"
	"time"
)

// LevelProvider returns player level for unlock checks.
type LevelProvider func(ctx context.Context, serverID int32, playerID int64) (int32, error)

// Service implements accept / progress / claim / list / chain status.
type Service struct {
	store   Store
	catalog Catalog
	granter RewardGranter
	level   LevelProvider
	now     func() time.Time
}

// NewService wires dependencies. granter may be nil only in tests that skip claim.
func NewService(store Store, catalog Catalog, granter RewardGranter, level LevelProvider) *Service {
	if level == nil {
		level = func(context.Context, int32, int64) (int32, error) { return 1, nil }
	}
	return &Service{
		store:   store,
		catalog: catalog,
		granter: granter,
		level:   level,
		now:     time.Now,
	}
}

// SetClock overrides time (tests).
func (s *Service) SetClock(fn func() time.Time) {
	if fn != nil {
		s.now = fn
	}
}

func (s *Service) AcceptQuest(ctx context.Context, actor Actor, questCfgID int32) (PlayerQuestProgress, QuestChainStatus, error) {
	cfg, ok := s.catalog.Get(questCfgID)
	if !ok {
		return PlayerQuestProgress{}, QuestChainStatus{}, ErrQuestNotFound
	}
	if err := s.checkUnlock(ctx, actor, cfg); err != nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, err
	}
	if err := s.checkPrerequisite(ctx, actor, cfg); err != nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, err
	}
	row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, questCfgID)
	if err != nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, err
	}
	if has {
		switch row.State {
		case StateInProgress, StateClaimable:
			return PlayerQuestProgress{}, QuestChainStatus{}, ErrAlreadyAccepted
		case StateCompleted:
			if !cfg.Repeatable {
				return PlayerQuestProgress{}, QuestChainStatus{}, ErrAlreadyCompleted
			}
		}
	}
	now := s.now()
	row = PlayerQuestRow{
		ServerID:   actor.ServerID,
		PlayerID:   actor.PlayerID,
		QuestCfgID: questCfgID,
		State:      StateInProgress,
		Progress:   ProgressCounter{},
		AcceptedAt: &now,
		UpdatedAt:  now,
	}
	if err := s.store.UpsertPlayerQuest(ctx, row); err != nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, err
	}
	view := s.buildProgress(cfg, row, true)
	chain := s.chainStatus(ctx, actor, cfg.ChainID)
	return view, chain, nil
}

func (s *Service) ReportQuestProgress(ctx context.Context, actor Actor, questCfgID int32, absolute bool, value int32) (PlayerQuestProgress, QuestChainStatus, error) {
	cfg, ok := s.catalog.Get(questCfgID)
	if !ok {
		return PlayerQuestProgress{}, QuestChainStatus{}, ErrQuestNotFound
	}
	row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, questCfgID)
	if err != nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, err
	}
	if !has || row.State != StateInProgress {
		return PlayerQuestProgress{}, QuestChainStatus{}, ErrNotInProgress
	}
	target := ProgressTargetFor(cfg.Objectives)
	var next int32
	if absolute {
		next = value
	} else {
		next = row.Progress.Count + value
	}
	if next < 0 {
		return PlayerQuestProgress{}, QuestChainStatus{}, ErrProgressInvalid
	}
	row.Progress.Count = next
	row.UpdatedAt = s.now()
	if next >= target {
		row.State = StateClaimable
		t := s.now()
		row.CompletedAt = &t
	}
	if err := s.store.UpsertPlayerQuest(ctx, row); err != nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, err
	}
	view := s.buildProgress(cfg, row, true)
	chain := s.chainStatus(ctx, actor, cfg.ChainID)
	return view, chain, nil
}

func (s *Service) ClaimQuestReward(ctx context.Context, actor Actor, questCfgID int32) (PlayerQuestProgress, QuestChainStatus, RewardBundle, error) {
	cfg, ok := s.catalog.Get(questCfgID)
	if !ok {
		return PlayerQuestProgress{}, QuestChainStatus{}, RewardBundle{}, ErrQuestNotFound
	}
	row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, questCfgID)
	if err != nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, RewardBundle{}, err
	}
	if !has || row.State != StateClaimable {
		if has && row.State == StateCompleted {
			return PlayerQuestProgress{}, QuestChainStatus{}, RewardBundle{}, ErrAlreadyCompleted
		}
		return PlayerQuestProgress{}, QuestChainStatus{}, RewardBundle{}, ErrNotClaimable
	}
	if s.granter == nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, RewardBundle{}, ErrGrantFailed
	}
	req := GrantRequest{
		ServerID:       actor.ServerID,
		PlayerID:       actor.PlayerID,
		QuestCfgID:     questCfgID,
		IdempotencyKey: QuestClaimIdempotencyKey(actor.PlayerID, questCfgID),
		Rewards:        cfg.Rewards,
	}
	granted, err := s.granter.GrantQuestReward(ctx, req)
	if err != nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, RewardBundle{}, err
	}
	now := s.now()
	row.State = StateCompleted
	row.RewardClaimedAt = &now
	row.UpdatedAt = now
	if err := s.store.UpsertPlayerQuest(ctx, row); err != nil {
		return PlayerQuestProgress{}, QuestChainStatus{}, RewardBundle{}, err
	}
	view := s.buildProgress(cfg, row, true)
	chain := s.chainStatus(ctx, actor, cfg.ChainID)
	return view, chain, granted, nil
}

func (s *Service) GetQuestChainStatus(ctx context.Context, actor Actor, chainID int32) (QuestChainStatus, []PlayerQuestProgress, error) {
	chain := s.chainStatus(ctx, actor, chainID)
	quests := s.catalog.ListByChain(chainID)
	var views []PlayerQuestProgress
	for _, cfg := range quests {
		row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, cfg.QuestCfgID)
		if err != nil {
			return QuestChainStatus{}, nil, err
		}
		if !has {
			views = append(views, s.buildProgress(cfg, PlayerQuestRow{}, false))
			continue
		}
		views = append(views, s.buildProgress(cfg, row, true))
	}
	return chain, views, nil
}

func (s *Service) checkUnlock(ctx context.Context, actor Actor, cfg QuestCfg) error {
	lvl, err := s.level(ctx, actor.ServerID, actor.PlayerID)
	if err != nil {
		return err
	}
	if lvl < cfg.UnlockLevel {
		return ErrLevelTooLow
	}
	return nil
}

func (s *Service) checkPrerequisite(ctx context.Context, actor Actor, cfg QuestCfg) error {
	if cfg.PrevQuestCfgID == 0 {
		return nil
	}
	prev, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, cfg.PrevQuestCfgID)
	if err != nil {
		return err
	}
	if !has || prev.State != StateCompleted {
		return ErrPrerequisiteNotMet
	}
	return nil
}

func (s *Service) buildProgress(cfg QuestCfg, row PlayerQuestRow, hasRow bool) PlayerQuestProgress {
	target := ProgressTargetFor(cfg.Objectives)
	var acceptedMs, updatedMs int64
	if row.AcceptedAt != nil {
		acceptedMs = row.AcceptedAt.UnixMilli()
	}
	if !row.UpdatedAt.IsZero() {
		updatedMs = row.UpdatedAt.UnixMilli()
	}
	return PlayerQuestProgress{
		QuestCfgID:      cfg.QuestCfgID,
		QuestCode:       cfg.Code,
		ChainID:         cfg.ChainID,
		ChainOrder:      int32(cfg.SortInChain),
		PrevQuestCfgID:  cfg.PrevQuestCfgID,
		NextQuestCfgID:  cfg.NextQuestCfgID,
		State:           ProtoStateFromDB(row.State, hasRow),
		ProgressCurrent: row.Progress.Count,
		ProgressTarget:  target,
		AcceptedAtMs:    acceptedMs,
		UpdatedAtMs:     updatedMs,
		RewardPreview:   cfg.Rewards,
	}
}

func (s *Service) chainStatus(ctx context.Context, actor Actor, chainID int32) QuestChainStatus {
	if chainID == 0 {
		return QuestChainStatus{}
	}
	quests := s.catalog.ListByChain(chainID)
	st := QuestChainStatus{
		ChainID:         chainID,
		ChainName:       chainDisplayName(chainID),
		TotalQuestCount: int32(len(quests)),
	}
	if len(quests) == 0 {
		return st
	}
	var completed int32
	var active int32
	var nextAvail int32
	locked := false
	for _, cfg := range quests {
		row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, cfg.QuestCfgID)
		if err != nil {
			continue
		}
		if has && row.State == StateCompleted {
			completed++
			continue
		}
		if has && (row.State == StateInProgress || row.State == StateClaimable) {
			active = cfg.QuestCfgID
		}
		if nextAvail == 0 && (!has || row.State == StateUnaccepted) {
			if cfg.PrevQuestCfgID == 0 {
				nextAvail = cfg.QuestCfgID
			} else {
				prev, ok, _ := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, cfg.PrevQuestCfgID)
				if ok && prev.State == StateCompleted {
					nextAvail = cfg.QuestCfgID
				} else if !ok {
					locked = true
				}
			}
		}
	}
	st.CompletedQuestCount = completed
	st.ActiveQuestCfgID = active
	st.NextAvailableQuestCfgID = nextAvail
	if completed == st.TotalQuestCount && st.TotalQuestCount > 0 {
		st.ChainState = QuestChainStateCompleted
	} else if locked && active == 0 && completed == 0 {
		st.ChainState = QuestChainStateLocked
	} else {
		st.ChainState = QuestChainStateInProgress
	}
	return st
}
