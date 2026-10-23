package content

import "context"

// Store persists player_item rows and reward grant idempotency (reward_grant_queue).
type Store interface {
	LoadBag(ctx context.Context, p PlayerRef) ([]Stack, error)
	SaveStack(ctx context.Context, p PlayerRef, itemCfgID int32, qty int32) error
	FindSuccessfulGrant(ctx context.Context, serverID int32, idempotencyKey string) (grantID int64, ok bool, err error)
	RecordSuccessfulGrant(ctx context.Context, job GrantJob, grantID int64) error
	NextGrantID(ctx context.Context, serverID int32) (int64, error)
}
