package chat

import "context"

// Store persists channels and messages (memory or PG per SPEC-005).
type Store interface {
	EnsureWorldChannel(ctx context.Context, serverID int32) (int64, error)
	EnsurePrivateChannel(ctx context.Context, serverID int32, playerA, playerB int64) (int64, error)
	InsertMessage(ctx context.Context, msg Message) (Message, error)
	ListMessages(ctx context.Context, q ListQuery) ([]Message, error)
}

// PlayerDirectory resolves display names and same-shard membership for private chat.
type PlayerDirectory interface {
	DisplayName(ctx context.Context, serverID int32, playerID int64) (string, error)
	ExistsOnServer(ctx context.Context, serverID int32, playerID int64) (bool, error)
}
