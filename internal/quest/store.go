package quest

import "context"

// Store persists player_quest rows per shard.
type Store interface {
	GetPlayerQuest(ctx context.Context, serverID int32, playerID int64, questCfgID int32) (PlayerQuestRow, bool, error)
	ListPlayerQuests(ctx context.Context, serverID int32, playerID int64) ([]PlayerQuestRow, error)
	UpsertPlayerQuest(ctx context.Context, row PlayerQuestRow) error
}
