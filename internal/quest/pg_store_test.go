package quest

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGStoreQuestProgressSurviveRestart(t *testing.T) {
	pool := openQuestTestDB(t)
	ctx := context.Background()
	applyQuestSchema(t, pool)

	store1 := NewPGStore(pool)
	now := time.Unix(1_700_100_000, 0).UTC()
	row := PlayerQuestRow{
		ServerID:   4,
		PlayerID:   99,
		QuestCfgID: 1001,
		State:      StateInProgress,
		Progress:   ProgressCounter{Count: 1},
		AcceptedAt: &now,
		UpdatedAt:  now,
	}
	if err := store1.UpsertPlayerQuest(ctx, row); err != nil {
		t.Fatal(err)
	}

	store2 := NewPGStore(pool)
	got, ok, err := store2.GetPlayerQuest(ctx, 4, 99, 1001)
	if err != nil || !ok {
		t.Fatalf("ok=%v err=%v", ok, err)
	}
	if got.State != StateInProgress || got.Progress.Count != 1 {
		t.Fatalf("got %+v", got)
	}
	list, err := store2.ListPlayerQuests(ctx, 4, 99)
	if err != nil || len(list) != 1 {
		t.Fatalf("list len=%d err=%v", len(list), err)
	}
}

func openQuestTestDB(t *testing.T) *pgxpool.Pool {
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

func applyQuestSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	specDir := filepath.Join("spec", "db")
	if err := db.ApplySpecs(context.Background(), pool, specDir); err != nil {
		t.Fatal(err)
	}
}
