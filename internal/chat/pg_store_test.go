package chat

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func openChatTestDB(t *testing.T) *pgxpool.Pool {
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

func applyChatSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	specDir, err := chatTestSpecDir(".")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.ApplySpecs(context.Background(), pool, specDir); err != nil {
		t.Fatal(err)
	}
}

// chatTestSpecDir mirrors runtime.RepoRoot's go.mod ascent without importing
// runtime, which imports this domain through api and would create a test cycle.
func chatTestSpecDir(startDir string) (string, error) {
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

func TestChatSchemaSpecDir(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "go.mod"), []byte("module fixture\n"), 0600); err != nil {
		t.Fatal(err)
	}
	packageDir := filepath.Join(root, "internal", "chat")
	if err := os.MkdirAll(packageDir, 0700); err != nil {
		t.Fatal(err)
	}
	for name, startDir := range map[string]string{"module root": root, "package directory": packageDir} {
		t.Run(name, func(t *testing.T) {
			got, err := chatTestSpecDir(startDir)
			want := filepath.Join(root, "spec", "db")
			if err != nil || got != want {
				t.Fatalf("spec directory = %q, %v; want %q", got, err, want)
			}
		})
	}
	t.Run("missing module root", func(t *testing.T) {
		if _, err := chatTestSpecDir(filepath.VolumeName(root) + string(filepath.Separator)); err == nil {
			t.Fatal("expected an error without a go.mod ancestor")
		}
	})
}
