package rank

import (
	"context"
	"time"
)

// Store persists rank_snapshot batches.
type Store interface {
	WriteSnapshot(ctx context.Context, meta SnapshotMeta, entries []Entry) error
	LatestSnapshot(ctx context.Context, serverID int32, rankType RankType) (SnapshotMeta, error)
	ListEntries(ctx context.Context, serverID int32, rankType RankType, batchID int64, offset, limit int) ([]Entry, int32, error)
	LookupSubject(ctx context.Context, serverID int32, rankType RankType, batchID int64, subjectID int64) (rank int32, score int64, ok bool, err error)
}

// WriteParams bundles a refresh write.
type WriteParams struct {
	ServerID int32
	RankType RankType
	Entries  []Entry
	At       time.Time
}
