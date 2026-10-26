package quest

import (
	"context"
	"fmt"
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
	specDir, err := questTestSpecDir(".")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.ApplySpecs(context.Background(), pool, specDir); err != nil {
		t.Fatal(err)
	}
}

// questTestSpecDir mirrors runtime.RepoRoot's go.mod ascent without importing
// runtime, which imports this domain through api and would create a test cycle.
func questTestSpecDir(startDir string) (string, error) {
	dir, err := filepath.Abs(startDir)
	if err != nil {
		return "", fmt.Errorf("resolve schema root: %w", err)
	}
	for {
		if info, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil && !info.IsDir() {
			return filepath.Join(dir, "spec", "db"), nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("resolve schema root from %q: go.mod not found", startDir)
		}
		dir = parent
	}
}

func TestQuestSchemaSpecDir(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "go.mod"), []byte("module fixture\n"), 0600); err != nil {
		t.Fatal(err)
	}
	packageDir := filepath.Join(root, "internal", "quest")
	if err := os.MkdirAll(packageDir, 0700); err != nil {
		t.Fatal(err)
	}
	for name, startDir := range map[string]string{"module root": root, "package directory": packageDir} {
		t.Run(name, func(t *testing.T) {
			got, err := questTestSpecDir(startDir)
			want := filepath.Join(root, "spec", "db")
			if err != nil || got != want {
				t.Fatalf("spec directory = %q, %v; want %q", got, err, want)
			}
		})
	}
	t.Run("missing module root", func(t *testing.T) {
		if _, err := questTestSpecDir(filepath.VolumeName(root) + string(filepath.Separator)); err == nil {
			t.Fatal("expected an error without a go.mod ancestor")
		}
	})
}
