package quest

import "time"

func legacyWallProposal(actor Actor, now time.Time) PlayerQuestRow {
	return PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006,
		State: StateCompleted, Progress: ProgressCounter{Count: 1, ServerVerifiedVersion: 2, LegacyNoPayoutVerified: true}, UpdatedAt: now}
}

// mergeWallRow runs under the database row lock (or MemStore mutex). Consumed
// proof0 history is not eligible for normal proof, even with old acceptance.
func mergeWallRow(old, next PlayerQuestRow, explicitLegacy bool) (PlayerQuestRow, error) {
	if err := validateProof(old); err != nil {
		return PlayerQuestRow{}, err
	}
	if explicitLegacy {
		if old.QuestCfgID != 1006 || old.State != StateCompleted {
			return PlayerQuestRow{}, ErrNotInProgress
		}
		now := next.UpdatedAt
		next = old
		if next.Progress.ServerVerifiedVersion == 0 {
			next.Progress = ProgressCounter{Count: 1, ServerVerifiedVersion: 2, LegacyNoPayoutVerified: true}
		}
		if now.After(next.UpdatedAt) {
			next.UpdatedAt = now
		}
		return next, validateProof(next)
	}
	if next.Progress.LegacyNoPayoutVerified && !old.Progress.LegacyNoPayoutVerified {
		return PlayerQuestRow{}, ErrProgressInvalid
	}
	if old.State == StateCompleted {
		// Even NULL timestamps are historical data, not holes to fill from
		// stale acceptance, normal proof or a duplicate grant continuation.
		if next.UpdatedAt.After(old.UpdatedAt) {
			old.UpdatedAt = next.UpdatedAt
		}
		return old, nil
	}
	if next.Progress.ServerVerifiedVersion == 2 && old.Progress.ServerVerifiedVersion == 0 {
		if old.AcceptedAt == nil || (old.State != StateInProgress && old.State != StateClaimable) || next.State != StateClaimable {
			return PlayerQuestRow{}, ErrNotInProgress
		}
	}
	if old.State > next.State {
		next.State = old.State
	}
	if old.Progress.ServerVerifiedVersion == 2 {
		next.Progress = old.Progress
	}
	if next.Progress.ServerVerifiedVersion == 2 {
		next.Progress.Count = 1
	} else if old.Progress.Count > next.Progress.Count {
		next.Progress.Count = old.Progress.Count
	}
	if old.UpdatedAt.After(next.UpdatedAt) {
		next.UpdatedAt = old.UpdatedAt
	}
	if old.AcceptedAt != nil {
		next.AcceptedAt = old.AcceptedAt
	}
	if old.CompletedAt != nil {
		next.CompletedAt = old.CompletedAt
	}
	if old.RewardClaimedAt != nil {
		next.RewardClaimedAt = old.RewardClaimedAt
	}
	return next, validateProof(next)
}
