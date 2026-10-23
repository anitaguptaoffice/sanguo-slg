package mail

import (
	"context"
)

// Store persists player_mail rows.
type Store interface {
	NextMailID(ctx context.Context, serverID int32) (int64, error)
	Insert(ctx context.Context, m Mail) error
	Get(ctx context.Context, serverID int32, mailID int64) (Mail, bool, error)
	ListInbox(ctx context.Context, serverID int32, playerID int64, q ListQuery) (ListResult, error)
	MarkRead(ctx context.Context, serverID int32, playerID int64, mailID int64) (Mail, error)
	MarkClaimed(ctx context.Context, serverID int32, playerID int64, mailID int64) (Mail, error)
}
