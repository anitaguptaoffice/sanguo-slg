package rank

import (
	"context"
	"testing"
	"time"
)

func TestServiceRefreshAndQuery(t *testing.T) {
	store := NewMemStore()
	src := FuncSource(func(_ context.Context, _ int32, rt RankType) ([]PlayerRow, error) {
		if rt == RankPlayerPower {
			return []PlayerRow{
				{PlayerID: 10, DisplayName: "p10", Score: 500},
				{PlayerID: 20, DisplayName: "p20", Score: 900},
				{PlayerID: 30, DisplayName: "p30", Score: 700},
			}, nil
		}
		return nil, ErrUnknownRankType
	})
	svc := NewService(store, src)
	svc.now = func() time.Time { return time.Unix(1_700_000_000, 0) }

	meta, err := svc.Refresh(context.Background(), 1, RankPlayerPower)
	if err != nil {
		t.Fatal(err)
	}
	if meta.BatchID != 1 || meta.EntryCount != 3 {
		t.Fatalf("meta: %+v", meta)
	}

	page, err := svc.GetLeaderboard(context.Background(), LeaderboardQuery{
		ServerID: 1, Type: RankPlayerPower, Page: 1, PageSize: 2, ViewerPlayerID: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	if page.TotalCount != 3 || len(page.Entries) != 2 {
		t.Fatalf("page entries: total=%d len=%d", page.TotalCount, len(page.Entries))
	}
	if page.Entries[0].SubjectID != 20 || page.Entries[1].SubjectID != 30 {
		t.Fatalf("order: %+v", page.Entries)
	}
	if page.MyRank != 3 || page.MyScore != 500 {
		t.Fatalf("my rank: %d score %d", page.MyRank, page.MyScore)
	}
	if page.SnapshotVersion != 1 {
		t.Fatalf("version %d", page.SnapshotVersion)
	}

	meta2, err := svc.Refresh(context.Background(), 1, RankPlayerPower)
	if err != nil || meta2.BatchID != 2 {
		t.Fatalf("second batch: %+v err=%v", meta2, err)
	}
}

func TestServiceResourceLeaderboard(t *testing.T) {
	store := NewMemStore()
	src := FuncSource(func(_ context.Context, _ int32, rt RankType) ([]PlayerRow, error) {
		if rt != RankPlayerResource {
			return nil, ErrUnknownRankType
		}
		return []PlayerRow{
			{PlayerID: 5, DisplayName: "rich", Score: 9000},
			{PlayerID: 6, DisplayName: "poor", Score: 100},
		}, nil
	})
	svc := NewService(store, src)
	if _, err := svc.Refresh(context.Background(), 1, RankPlayerResource); err != nil {
		t.Fatal(err)
	}
	page, err := svc.GetLeaderboard(context.Background(), LeaderboardQuery{
		ServerID: 1, Type: RankPlayerResource, Page: 1, PageSize: 10, ViewerPlayerID: 6,
	})
	if err != nil {
		t.Fatal(err)
	}
	if page.TotalCount != 2 || page.Entries[0].SubjectID != 5 {
		t.Fatalf("page %+v", page)
	}
	if page.MyRank != 2 || page.MyScore != 100 {
		t.Fatalf("viewer rank=%d score=%d", page.MyRank, page.MyScore)
	}
}

func TestServiceRefreshTopNAndTieBreak(t *testing.T) {
	store := NewMemStore()
	src := FuncSource(func(_ context.Context, _ int32, _ RankType) ([]PlayerRow, error) {
		return []PlayerRow{
			{PlayerID: 3, Score: 50},
			{PlayerID: 1, Score: 100},
			{PlayerID: 2, Score: 50},
		}, nil
	})
	svc := NewService(store, src)
	svc.SetTopN(2)
	meta, err := svc.Refresh(context.Background(), 1, RankPlayerPower)
	if err != nil {
		t.Fatal(err)
	}
	if meta.EntryCount != 2 {
		t.Fatalf("topN meta %+v", meta)
	}
	page, err := svc.GetLeaderboard(context.Background(), LeaderboardQuery{
		ServerID: 1, Type: RankPlayerPower, Page: 1, PageSize: 10, ViewerPlayerID: 3,
	})
	if err != nil {
		t.Fatal(err)
	}
	if page.Entries[0].SubjectID != 1 || page.Entries[1].SubjectID != 2 {
		t.Fatalf("tie order %+v", page.Entries)
	}
	if page.MyRank != 0 {
		t.Fatalf("player 3 truncated from topN should not appear on board, my_rank=%d", page.MyRank)
	}
}
