package quest

import (
	"encoding/json"
	"fmt"
	"time"
)

// IsAuthoritativeTutorial identifies the immutable v1 chain100 contract only.
func IsAuthoritativeTutorial(cfg QuestCfg) bool {
	return cfg.ChainID == 100 && isTutorialID(cfg.QuestCfgID)
}

func isTutorialID(id int32) bool { return id >= 1001 && id <= 1005 }

// UnmarshalJSON rejects malformed/future proof rather than silently losing it.
func (p *ProgressCounter) UnmarshalJSON(data []byte) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil || fields == nil {
		return fmt.Errorf("%w: expected progress object", ErrProgressInvalid)
	}
	for key, raw := range fields {
		if (key != "count" && key != "server_verified_version") || string(raw) == "null" {
			return fmt.Errorf("%w: unsupported progress field %s", ErrProgressInvalid, key)
		}
	}
	type plain ProgressCounter
	var next plain
	if err := json.Unmarshal(data, &next); err != nil {
		return fmt.Errorf("%w: %v", ErrProgressInvalid, err)
	}
	if next.ServerVerifiedVersion != 0 && next.ServerVerifiedVersion != 1 {
		return fmt.Errorf("%w: unknown proof version", ErrProgressInvalid)
	}
	*p = ProgressCounter(next)
	return nil
}

func validateProof(row PlayerQuestRow) error {
	v := row.Progress.ServerVerifiedVersion
	if v == 0 {
		return nil
	}
	if v != 1 || !isTutorialID(row.QuestCfgID) || row.Progress.Count != 1 ||
		row.AcceptedAt == nil || row.State < StateClaimable || row.State > StateCompleted {
		return fmt.Errorf("%w: invalid tutorial proof", ErrProgressInvalid)
	}
	return nil
}

// Only the five nonrepeatable tutorial IDs merge monotonically; daily resets
// retain their existing replacement semantics. Call under a row lock/mutex.
func mergeTutorialRow(old, next PlayerQuestRow) (PlayerQuestRow, error) {
	if next.Progress.ServerVerifiedVersion == 1 && (old.State < StateInProgress || old.State > StateCompleted || old.AcceptedAt == nil) {
		return PlayerQuestRow{}, ErrNotInProgress
	}
	if old.State > next.State {
		next.State = old.State
	}
	if old.Progress.ServerVerifiedVersion == 1 {
		next.Progress.ServerVerifiedVersion = 1
	}
	if next.Progress.ServerVerifiedVersion == 1 {
		next.Progress.Count = 1
	} else if old.Progress.Count > next.Progress.Count {
		next.Progress.Count = old.Progress.Count
	}
	if old.UpdatedAt.After(next.UpdatedAt) {
		next.UpdatedAt = old.UpdatedAt
	}
	for _, pair := range [][2]**time.Time{{&next.AcceptedAt, &old.AcceptedAt}, {&next.CompletedAt, &old.CompletedAt}, {&next.RewardClaimedAt, &old.RewardClaimedAt}} {
		if *pair[1] != nil {
			*pair[0] = *pair[1]
		}
	}
	return next, nil
}

func cloneQuestRow(row PlayerQuestRow) PlayerQuestRow {
	for _, ptr := range []**time.Time{&row.AcceptedAt, &row.CompletedAt, &row.RewardClaimedAt} {
		if *ptr != nil {
			t := **ptr
			*ptr = &t
		}
	}
	return row
}
