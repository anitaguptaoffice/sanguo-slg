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

// GrantReceipt is an exact, durable successful payment, not proof of an action.
type GrantReceipt struct {
	GrantID int64
	Rewards RewardBundle
}

// RewardReceiptReader must validate server/player, fixed key, successful status
// and the exact producer-canonical package. Mismatches/errors must not be absence.
// Implementations must never grant, mutate state or hydrate grant caches here.
type RewardReceiptReader interface {
	FindQuestRewardReceipt(context.Context, GrantRequest) (GrantReceipt, bool, error)
}
