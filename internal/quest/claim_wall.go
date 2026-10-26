package quest

import (
	"context"
	"errors"
)

func (s *Service) claimWallReward(ctx context.Context, actor Actor, cfg QuestCfg) (PlayerQuestProgress, QuestChainStatus, RewardBundle, error) {
	fail := func(err error) (PlayerQuestProgress, QuestChainStatus, RewardBundle, error) {
		return PlayerQuestProgress{}, QuestChainStatus{}, RewardBundle{}, err
	}
	row, has, err := s.recoverWallRow(ctx, actor, cfg)
	if err != nil {
		return fail(err)
	}
	if has && row.State == StateCompleted {
		if err := s.verifyCompletedWall(ctx, actor, cfg, row); err != nil {
			return fail(err)
		}
		return fail(ErrAlreadyCompleted)
	}
	if !has || row.State != StateClaimable || row.Progress.ServerVerifiedVersion != 2 || row.Progress.LegacyNoPayoutVerified {
		return fail(ErrNotClaimable)
	}
	// Durable proof does not remove the independently established pre-award gate.
	if err := s.checkUnlock(ctx, actor, cfg); err != nil {
		return fail(err)
	}
	// The provider can race completion; use the durable row again before Grant.
	row, has, err = s.readWall(ctx, actor)
	if err != nil {
		return fail(err)
	}
	if has && row.State == StateCompleted {
		return fail(ErrAlreadyCompleted)
	}
	if !has || row.State != StateClaimable || row.Progress.ServerVerifiedVersion != 2 {
		return fail(ErrNotClaimable)
	}
	granted, err := s.granter.GrantQuestReward(ctx, wallGrantRequest(actor, cfg))
	if err != nil {
		return fail(err)
	}
	if err := s.completeWall(ctx, row); err != nil {
		return fail(err)
	}
	row, has, err = s.readWall(ctx, actor)
	if err != nil {
		return fail(err)
	}
	if !has || row.State != StateCompleted || row.RewardClaimedAt == nil {
		return fail(ErrGrantFailed)
	}
	return s.buildProgress(cfg, row, true), s.chainStatus(ctx, actor, cfg.ChainID), granted, nil
}

// This is the sole producer of the legacy no-payout variant. Current facts and
// independently repaired level are checked only on explicit authenticated Claim.
func (s *Service) verifyCompletedWall(ctx context.Context, actor Actor, cfg QuestCfg, row PlayerQuestRow) error {
	if row.Progress.ServerVerifiedVersion == 2 {
		return nil
	}
	// Absence is allowed for consumed legacy history; a known bad receipt is
	// not. Never establish a new floor over mismatched payment evidence.
	reader, ok := s.granter.(RewardReceiptReader)
	if !ok {
		return ErrGrantFailed
	}
	receipt, paid, err := reader.FindQuestRewardReceipt(ctx, wallGrantRequest(actor, cfg))
	if err != nil {
		return err
	}
	if paid && (receipt.GrantID <= 0 || !wallRewards(receipt.Rewards)) {
		return ErrGrantFailed
	}
	if err := s.checkUnlock(ctx, actor, cfg); err != nil {
		if errors.Is(err, ErrLevelTooLow) {
			return nil
		}
		return err
	}
	if s.tutorialFacts == nil {
		return nil
	}
	facts, err := s.tutorialFacts(ctx, actor)
	if err != nil {
		return err
	}
	if facts.CompletedBuildingLevels[7] < 1 {
		return nil
	}
	verifier, ok := s.store.(wallLegacyVerifier)
	if !ok {
		return ErrProgressInvalid
	}
	if err := verifier.verifyLegacyWall(ctx, actor, s.now()); err != nil {
		return err
	}
	fresh, has, err := s.readWall(ctx, actor)
	if err != nil {
		return err
	}
	if !has || fresh.State != StateCompleted || fresh.Progress.ServerVerifiedVersion != 2 {
		return ErrProgressInvalid
	}
	return nil
}
