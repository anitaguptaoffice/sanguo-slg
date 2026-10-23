package rank

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGStoreWriteAndQuery(t *testing.T) {
	pool := openRankTestDB(t)
	ctx := context.Background()
	applyRankSchema(t, pool)
	store := NewPGStore(pool)

	entries := []Entry{
		{Position: 1, SubjectID: 2, DisplayName: "b", Score: 200},
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
	if err != nil || total != 2 || len(page) != 2 || page[0].SubjectID != 2 {
		t.Fatalf("list total=%d page=%+v err=%v", total, page, err)
	}
	rank, score, ok, err := store.LookupSubject(ctx, 1, RankPlayerPower, meta.BatchID, 1)
	if err != nil || !ok || rank != 2 || score != 100 {
		t.Fatalf("lookup rank=%d score=%d ok=%v err=%v", rank, score, ok, err)
	}
}

func openRankTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	return pool
}

func applyRankSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	specDir := filepath.Join("spec", "db")
	if err := db.ApplySpecs(context.Background(), pool, specDir); err != nil {
		t.Fatal(err)
	}
}
