package quest

import (
	"context"
	"time"
)

// Store persists player_quest rows per shard.
type Store interface {
	GetPlayerQuest(ctx context.Context, serverID int32, playerID int64, questCfgID int32) (PlayerQuestRow, bool, error)
	ListPlayerQuests(ctx context.Context, serverID int32, playerID int64) ([]PlayerQuestRow, error)
	UpsertPlayerQuest(ctx context.Context, row PlayerQuestRow) error
}

// wallLegacyVerifier is deliberately separate from generic writes. Only explicit
// Claim uses it after independently checking current level and owned-wall facts.
type wallLegacyVerifier interface {
	verifyLegacyWall(context.Context, Actor, time.Time) error
}
