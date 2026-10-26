package quest

import (
	"context"
	"errors"
)

// RecoverWall is the receipt-first read/action coordinator for exact 1006. It
// never accepts, grants, or creates the explicit-Claim no-payout proof variant.
// Call it outside the level provider, then refresh the pure combined floor.
func (s *Service) RecoverWall(ctx context.Context, actor Actor) error {
	cfg, ok := s.catalog.Get(1006)
	if !ok {
		return nil
	}
	_, _, err := s.recoverWallRow(ctx, actor, cfg)
	return err
}

func (s *Service) readWall(ctx context.Context, actor Actor) (PlayerQuestRow, bool, error) {
	row, has, err := s.store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
	if err == nil && has {
		if row.ServerID != actor.ServerID || row.PlayerID != actor.PlayerID || row.QuestCfgID != 1006 {
			return row, has, ErrProgressInvalid
		}
		err = validateProof(row)
	}
	return row, has, err
}

func wallGrantRequest(actor Actor, cfg QuestCfg) GrantRequest {
	return GrantRequest{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006, IdempotencyKey: QuestClaimIdempotencyKey(actor.PlayerID, 1006), Rewards: cfg.Rewards}
}

func (s *Service) recoverWallRow(ctx context.Context, actor Actor, cfg QuestCfg) (PlayerQuestRow, bool, error) {
	if err := wallConfig(cfg); err != nil {
		return PlayerQuestRow{}, false, err
	}
	row, has, err := s.readWall(ctx, actor)
	if err != nil || (has && row.State == StateCompleted) {
		return row, has, err
	}
	reader, ok := s.granter.(RewardReceiptReader)
	if !ok {
		return row, has, ErrGrantFailed
	}
	receipt, paid, err := reader.FindQuestRewardReceipt(ctx, wallGrantRequest(actor, cfg))
	if err != nil {
		return row, has, err
	}
	if paid && (receipt.GrantID <= 0 || !wallRewards(receipt.Rewards)) {
		return row, has, ErrGrantFailed
	}
	// Receipt I/O can overlap a new proof-first claimant. The current row wins.
	row, has, err = s.readWall(ctx, actor)
	if err != nil || (has && row.State == StateCompleted) {
		return row, has, err
	}
	if paid {
		if !has {
			row = PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006}
		}
		if err := s.completeWall(ctx, row); err != nil {
			return row, has, err
		}
		return s.readWall(ctx, actor) // History is committed before any new verification.
	}
	if !has || row.State == StateUnaccepted {
		return row, has, nil
	}
	if row.AcceptedAt == nil || (row.State != StateInProgress && row.State != StateClaimable) {
		return row, has, ErrNotInProgress
	}
	if row.Progress.ServerVerifiedVersion == 2 {
		return row, has, nil
	}
	if err := s.checkUnlock(ctx, actor, cfg); err != nil {
		if errors.Is(err, ErrLevelTooLow) {
			return row, has, nil
		}
		return row, has, err
	}
	if s.tutorialFacts == nil {
		return row, has, nil
	}
	facts, err := s.tutorialFacts(ctx, actor)
	if err != nil {
		return row, has, err
	}
	if facts.CompletedBuildingLevels[7] >= 1 {
		now := s.now()
		row.State, row.Progress = StateClaimable, ProgressCounter{Count: 1, ServerVerifiedVersion: 2}
		row.CompletedAt, row.UpdatedAt = &now, now
		if err := s.store.UpsertPlayerQuest(ctx, row); err != nil {
			return row, has, err
		}
	}
	// Both met and unmet reads can overlap completion. Never return a stale view.
	return s.readWall(ctx, actor)
}

func (s *Service) completeWall(ctx context.Context, row PlayerQuestRow) error {
	now := s.now()
	row.State, row.RewardClaimedAt, row.UpdatedAt = StateCompleted, &now, now
	if row.CompletedAt == nil {
		row.CompletedAt = &now
	}
	return s.store.UpsertPlayerQuest(ctx, row)
}
