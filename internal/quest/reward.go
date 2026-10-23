package quest

import (
	"context"
	"fmt"
)

// GrantRequest is passed to content when claiming quest rewards.
type GrantRequest struct {
	ServerID       int32
	PlayerID       int64
	QuestCfgID     int32
	IdempotencyKey string
	Rewards        RewardBundle
}

// QuestClaimIdempotencyKey builds the recommended idempotency key (spec/rules/content.md).
func QuestClaimIdempotencyKey(playerID int64, questCfgID int32) string {
	return fmt.Sprintf("quest:%d:%d:claim", playerID, questCfgID)
}

// RewardGranter delivers rewards into inventory/wallet (CONTENT-002); quest does not touch internal/content.
type RewardGranter interface {
	GrantQuestReward(ctx context.Context, req GrantRequest) (RewardBundle, error)
}
