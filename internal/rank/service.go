package rank

import (
	"context"
	"time"
)

// Service refreshes leaderboard snapshots and serves queries.
type Service struct {
	store  Store
	source DataSource
	topN   int
	now    func() time.Time
}

// NewService wires store and live data source.
func NewService(store Store, source DataSource) *Service {
	return &Service{
		store:  store,
		source: source,
		topN:   DefaultTopN,
		now:    time.Now,
	}
}

// SetTopN caps rows written per refresh (for tests).
func (s *Service) SetTopN(n int) {
	if n > 0 {
		s.topN = n
	}
}

// Refresh pulls scores from DataSource, ranks them, and writes a new snapshot batch.
func (s *Service) Refresh(ctx context.Context, serverID int32, rankType RankType) (SnapshotMeta, error) {
	if rankType != RankPlayerPower && rankType != RankPlayerResource {
		return SnapshotMeta{}, ErrUnknownRankType
	}
	rows, err := s.source.ListPlayerScores(ctx, serverID, rankType)
	if err != nil {
		return SnapshotMeta{}, err
	}
	entries := SortAndRank(rows, s.topN)
	meta := SnapshotMeta{
		ServerID:    serverID,
		RankType:    rankType,
		RefreshedAt: s.now(),
	}
	if err := s.store.WriteSnapshot(ctx, meta, entries); err != nil {
		return SnapshotMeta{}, err
	}
	return s.store.LatestSnapshot(ctx, serverID, rankType)
}

// GetLeaderboard returns a page from the latest snapshot for server_id and type.
func (s *Service) GetLeaderboard(ctx context.Context, q LeaderboardQuery) (LeaderboardPage, error) {
	if q.Type != RankPlayerPower && q.Type != RankPlayerResource {
		return LeaderboardPage{}, ErrUnknownRankType
	}
	meta, err := s.store.LatestSnapshot(ctx, q.ServerID, q.Type)
	if err != nil {
		return LeaderboardPage{}, err
	}
	page := q.Page
	if page <= 0 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := int((page - 1) * pageSize)
	entries, total, err := s.store.ListEntries(ctx, q.ServerID, q.Type, meta.BatchID, offset, int(pageSize))
	if err != nil {
		return LeaderboardPage{}, err
	}
	out := LeaderboardPage{
		Type:                  q.Type,
		Entries:               entries,
		TotalCount:            total,
		SnapshotVersion:       meta.BatchID,
		SnapshotRefreshedAtMs: meta.RefreshedAt.UnixMilli(),
	}
	if q.ViewerPlayerID != 0 {
		rank, score, ok, err := s.store.LookupSubject(ctx, q.ServerID, q.Type, meta.BatchID, q.ViewerPlayerID)
		if err != nil {
			return LeaderboardPage{}, err
		}
		if ok {
			out.MyRank = rank
			out.MyScore = score
		}
	}
	return out, nil
}
