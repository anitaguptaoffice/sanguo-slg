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

func TestSchedulerTick(t *testing.T) {
	store := NewMemStore()
	calls := 0
	src := FuncSource(func(_ context.Context, _ int32, _ RankType) ([]PlayerRow, error) {
		calls++
		return []PlayerRow{{PlayerID: 1, Score: 1}}, nil
	})
	svc := NewService(store, src)
	sch := NewScheduler(svc, time.Minute)
	sch.Configure([]int32{1}, []RankType{RankPlayerPower})
	if err := sch.Tick(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("calls=%d", calls)
	}
}
