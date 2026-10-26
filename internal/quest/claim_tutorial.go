package quest

import "context"

// claimTutorialReward separates paid-receipt recovery from new entitlement.
// Receipt lookup is read-only: Grant is never used to probe for past payment.
func (s *Service) claimTutorialReward(ctx context.Context, actor Actor, cfg QuestCfg) (PlayerQuestProgress, QuestChainStatus, RewardBundle, error) {
	fail := func(err error) (PlayerQuestProgress, QuestChainStatus, RewardBundle, error) {
		return PlayerQuestProgress{}, QuestChainStatus{}, RewardBundle{}, err
	}
	read := func() (PlayerQuestRow, bool, error) {
		return s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, cfg.QuestCfgID)
	}
	row, has, err := read()
	if err != nil {
		return fail(err)
	}
	if has && row.State == StateCompleted {
		return fail(ErrAlreadyCompleted)
	}
	reader, ok := s.granter.(RewardReceiptReader)
	if !ok {
		return fail(ErrGrantFailed)
	}
	req := GrantRequest{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: cfg.QuestCfgID,
		IdempotencyKey: QuestClaimIdempotencyKey(actor.PlayerID, cfg.QuestCfgID), Rewards: cfg.Rewards}
	receipt, paid, err := reader.FindQuestRewardReceipt(ctx, req)
	if err != nil {
		return fail(err)
	}
	// The receipt IO may race another claimant. Never use the pre-lookup row.
	row, has, err = read()
	if err != nil {
		return fail(err)
	}
	if has && row.State == StateCompleted {
		return fail(ErrAlreadyCompleted)
	}
	granted := receipt.Rewards
	if paid {
		if receipt.GrantID <= 0 {
			return fail(ErrGrantFailed)
		}
		// A matching historical payment repairs even missing/unaccepted legacy
		// state. It is not evidence of an action and must not create proof v1.
		if !has {
			row = PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: cfg.QuestCfgID}
		}
	} else {
		if _, err := tutorialObjective(cfg); err != nil {
			return fail(err)
		}
		if !has || row.AcceptedAt == nil || (row.State != StateInProgress && row.State != StateClaimable) {
			return fail(ErrNotClaimable)
		}
		if err := validateProof(row); err != nil {
			return fail(err)
		}
		if err := s.checkPrerequisite(ctx, actor, cfg); err != nil {
			return fail(err)
		}
		if err := s.checkUnlock(ctx, actor, cfg); err != nil {
			return fail(err)
		}
		if _, err := s.reconcileTutorialRow(ctx, actor, cfg, row, has); err != nil {
			return fail(err)
		}
		// Re-read even when proof already existed or no provider was wired.
		// A concurrent completion wins; actual content grants also dedupe by key.
		row, has, err = read()
		if err != nil {
			return fail(err)
		}
		if has && row.State == StateCompleted {
			return fail(ErrAlreadyCompleted)
		}
		if !has || row.State != StateClaimable || row.Progress.ServerVerifiedVersion != 1 {
			return fail(ErrNotClaimable)
		}
		if err := validateProof(row); err != nil {
			return fail(err)
		}
		granted, err = s.granter.GrantQuestReward(ctx, req)
		if err != nil {
			return fail(err)
		}
	}
	now := s.now()
	row.State, row.RewardClaimedAt, row.UpdatedAt = StateCompleted, &now, now
	if row.CompletedAt == nil {
		row.CompletedAt = &now
	}
	if err := s.store.UpsertPlayerQuest(ctx, row); err != nil {
		return fail(err)
	}
	row, has, err = read()
	if err != nil {
		return fail(err)
	}
	if !has || row.State != StateCompleted || row.RewardClaimedAt == nil {
		return fail(ErrGrantFailed)
	}
	return s.buildProgress(cfg, row, true), s.chainStatus(ctx, actor, cfg.ChainID), granted, nil
}
