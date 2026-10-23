package rank

import (
	"errors"
	"time"
)

// RankType matches sanguo.rank.v1.LeaderboardType (stored as rank_snapshot.rank_type).
type RankType int16

const (
	RankPlayerPower    RankType = 1
	RankPlayerResource RankType = 2
)

var (
	ErrUnknownRankType = errors.New("rank: unknown leaderboard type")
	ErrNoSnapshot      = errors.New("rank: no snapshot for server/type")
)

// DefaultTopN is the max rows persisted per refresh (see spec/rules/social.md).
const DefaultTopN = 200

// DefaultRefreshInterval between scheduled snapshot refreshes.
const DefaultRefreshInterval = 5 * time.Minute

// PlayerRow is live data fed into a refresh (from other domains via DataSource).
type PlayerRow struct {
	PlayerID    int64
	DisplayName string
	Score       int64
	GuildName   string
}

// Entry is one ranked row in a snapshot batch.
type Entry struct {
	Position    int32
	SubjectID   int64
	DisplayName string
	Score       int64
	GuildName   string
}

// SnapshotMeta is the rank_snapshot header for one batch.
type SnapshotMeta struct {
	ServerID    int32
	RankType    RankType
	BatchID     int64
	RefreshedAt time.Time
	EntryCount  int32
}

// LeaderboardQuery loads a page from the latest snapshot.
type LeaderboardQuery struct {
	ServerID       int32
	Type           RankType
	Page           int32
	PageSize       int32
	ViewerPlayerID int64
}

// LeaderboardPage is the query result (maps to GetLeaderboardResponse).
type LeaderboardPage struct {
	Type                  RankType
	Entries               []Entry
	TotalCount            int32
	MyRank                int32
	MyScore               int64
	SnapshotVersion       int64
	SnapshotRefreshedAtMs int64
}
