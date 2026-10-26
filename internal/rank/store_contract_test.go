package rank

import (
	"context"
	"testing"
	"time"
)

func TestMemStoreContract(t *testing.T) {
	runRankStoreContract(t, NewMemStore())
}

func TestPGStoreContract(t *testing.T) {
	pool := openRankTestDB(t)
	ctx := context.Background()
	applyRankSchema(t, pool)

	store1 := NewPGStore(pool)
	runRankStoreContract(t, store1)

	store2 := NewPGStore(pool)
	meta, err := store2.LatestSnapshot(ctx, 1, RankPlayerPower)
	if err != nil {
		t.Fatal(err)
	}
	if meta.BatchID != 2 || meta.EntryCount != 1 {
		t.Fatalf("reload meta %+v", meta)
	}
	page, total, err := store2.ListEntries(ctx, 1, RankPlayerPower, meta.BatchID, 0, 10)
	if err != nil || total != 1 || len(page) != 1 || page[0] != (Entry{Position: 1, SubjectID: 9, Score: 999}) {
		t.Fatalf("reload latest list total=%d page=%+v err=%v", total, page, err)
	}

	// Reopening must preserve both the latest replacement and the older batch.
	page, total, err = store2.ListEntries(ctx, 1, RankPlayerPower, 1, 0, 10)
	wantFirst := Entry{Position: 1, SubjectID: 2, DisplayName: "b", Score: 200, GuildName: "G"}
	wantSecond := Entry{Position: 2, SubjectID: 1, DisplayName: "a", Score: 100}
	if err != nil || total != 2 || len(page) != 2 || page[0] != wantFirst || page[1] != wantSecond {
		t.Fatalf("reload older list total=%d page=%+v err=%v", total, page, err)
	}
}

func runRankStoreContract(t *testing.T, store Store) {
	ctx := context.Background()
	entries := []Entry{
		{Position: 1, SubjectID: 2, DisplayName: "b", Score: 200, GuildName: "G"},
		{Position: 2, SubjectID: 1, DisplayName: "a", Score: 100},
	}
	at := time.Unix(1_700_000_100, 0).UTC()
	if err := store.WriteSnapshot(ctx, SnapshotMeta{ServerID: 1, RankType: RankPlayerPower, RefreshedAt: at}, entries); err != nil {
		t.Fatal(err)
	}
	meta, err := store.LatestSnapshot(ctx, 1, RankPlayerPower)
	if err != nil {
		t.Fatal(err)
	}
	if meta.BatchID != 1 || meta.EntryCount != 2 {
		t.Fatalf("meta %+v", meta)
	}
	page, total, err := store.ListEntries(ctx, 1, RankPlayerPower, meta.BatchID, 0, 10)
	if err != nil || total != 2 || len(page) != 2 || page[0].SubjectID != 2 || page[0].GuildName != "G" {
		t.Fatalf("list total=%d page=%+v err=%v", total, page, err)
	}
	rank, score, ok, err := store.LookupSubject(ctx, 1, RankPlayerPower, meta.BatchID, 1)
	if err != nil || !ok || rank != 2 || score != 100 {
		t.Fatalf("lookup rank=%d score=%d ok=%v err=%v", rank, score, ok, err)
	}

	entries2 := []Entry{{Position: 1, SubjectID: 9, Score: 999}}
	at2 := at.Add(time.Minute)
	if err := store.WriteSnapshot(ctx, SnapshotMeta{ServerID: 1, RankType: RankPlayerPower, RefreshedAt: at2}, entries2); err != nil {
		t.Fatal(err)
	}
	meta2, err := store.LatestSnapshot(ctx, 1, RankPlayerPower)
	if err != nil || meta2.BatchID != 2 || meta2.EntryCount != 1 {
		t.Fatalf("second batch meta %+v err=%v", meta2, err)
	}

	// Older batch remains readable by explicit batch_id; latest must not alias stale rows.
	stalePage, staleTotal, err := store.ListEntries(ctx, 1, RankPlayerPower, meta.BatchID, 0, 10)
	if err != nil || staleTotal != 2 || len(stalePage) != 2 || stalePage[0].SubjectID != 2 {
		t.Fatalf("stale batch list total=%d page=%+v err=%v", staleTotal, stalePage, err)
	}
	freshPage, freshTotal, err := store.ListEntries(ctx, 1, RankPlayerPower, meta2.BatchID, 0, 10)
	if err != nil || freshTotal != 1 || len(freshPage) != 1 || freshPage[0].SubjectID != 9 {
		t.Fatalf("latest batch list total=%d page=%+v err=%v", freshTotal, freshPage, err)
	}
	_, _, okOld, err := store.LookupSubject(ctx, 1, RankPlayerPower, meta.BatchID, 1)
	if err != nil || !okOld {
		t.Fatalf("stale lookup should still find subject in batch 1 ok=%v err=%v", okOld, err)
	}
	_, _, okNew, err := store.LookupSubject(ctx, 1, RankPlayerPower, meta2.BatchID, 1)
	if err != nil || okNew {
		t.Fatalf("subject dropped in batch 2 should not appear ok=%v err=%v", okNew, err)
	}
}
