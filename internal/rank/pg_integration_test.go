package rank

import (
	"context"
	"testing"
	"time"
)

// RANK-002: dual leaderboards on PG Store — refresh, pagination, viewer rank (parity with mem/RANK-001).
func TestPGServiceDualLeaderboards(t *testing.T) {
	pool := openRankTestDB(t)
	ctx := context.Background()
	applyRankSchema(t, pool)

	const serverID int32 = 9116
	store := NewPGStore(pool)
	src := FuncSource(func(_ context.Context, sid int32, rt RankType) ([]PlayerRow, error) {
		if sid != serverID {
			return nil, nil
		}
		switch rt {
		case RankPlayerPower:
			return []PlayerRow{
				{PlayerID: 101, DisplayName: "a", Score: 300},
				{PlayerID: 102, DisplayName: "b", Score: 500},
				{PlayerID: 103, DisplayName: "c", Score: 500},
			}, nil
		case RankPlayerResource:
			return []PlayerRow{
				{PlayerID: 201, Score: 10},
				{PlayerID: 202, Score: 20},
			}, nil
		default:
			return nil, ErrUnknownRankType
		}
	})
	svc := NewService(store, src)
	svc.now = func() time.Time { return time.Unix(1_800_000_000, 0).UTC() }

	powerMeta, err := svc.Refresh(ctx, serverID, RankPlayerPower)
	if err != nil {
		t.Fatal(err)
	}
	if powerMeta.BatchID < 1 || powerMeta.EntryCount != 3 {
		t.Fatalf("power meta %+v", powerMeta)
	}

	page1, err := svc.GetLeaderboard(ctx, LeaderboardQuery{
		ServerID: serverID, Type: RankPlayerPower, Page: 1, PageSize: 2, ViewerPlayerID: 101,
	})
	if err != nil {
		t.Fatal(err)
	}
	if page1.TotalCount != 3 || len(page1.Entries) != 2 {
		t.Fatalf("power page1 %+v", page1)
	}
	if page1.Entries[0].SubjectID != 102 || page1.Entries[1].SubjectID != 103 {
		t.Fatalf("tie-break lower player_id first: %+v", page1.Entries)
	}
	if page1.MyRank != 3 || page1.MyScore != 300 {
		t.Fatalf("viewer 101 rank=%d score=%d", page1.MyRank, page1.MyScore)
	}

	page2, err := svc.GetLeaderboard(ctx, LeaderboardQuery{
		ServerID: serverID, Type: RankPlayerPower, Page: 2, PageSize: 2,
	})
	if err != nil || len(page2.Entries) != 1 || page2.Entries[0].SubjectID != 101 {
		t.Fatalf("power page2 %+v err=%v", page2, err)
	}

	resMeta, err := svc.Refresh(ctx, serverID, RankPlayerResource)
	if err != nil {
		t.Fatal(err)
	}
	if resMeta.RankType != RankPlayerResource || resMeta.EntryCount != 2 {
		t.Fatalf("resource meta %+v", resMeta)
	}
	resPage, err := svc.GetLeaderboard(ctx, LeaderboardQuery{
		ServerID: serverID, Type: RankPlayerResource, Page: 1, PageSize: 10, ViewerPlayerID: 201,
	})
	if err != nil {
		t.Fatal(err)
	}
	if resPage.MyRank != 2 || resPage.Entries[0].SubjectID != 202 {
		t.Fatalf("resource page %+v", resPage)
	}

	powerMeta2, err := svc.Refresh(ctx, serverID, RankPlayerPower)
	if err != nil || powerMeta2.BatchID <= powerMeta.BatchID {
		t.Fatalf("second power refresh batch %+v prev=%d err=%v", powerMeta2, powerMeta.BatchID, err)
	}
	stale, total, err := store.ListEntries(ctx, serverID, RankPlayerPower, powerMeta.BatchID, 0, 10)
	if err != nil || total != 3 || len(stale) != 3 {
		t.Fatalf("old batch still readable total=%d len=%d err=%v", total, len(stale), err)
	}
	latest, err := store.LatestSnapshot(ctx, serverID, RankPlayerPower)
	if err != nil || latest.BatchID != powerMeta2.BatchID {
		t.Fatalf("latest %+v want batch %d", latest, powerMeta2.BatchID)
	}
}
