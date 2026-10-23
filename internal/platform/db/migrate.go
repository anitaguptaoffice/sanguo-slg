package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ApplySpecs runs spec/db/*.sql in lexical order, recording names in schema_migrations.
func ApplySpecs(ctx context.Context, pool *pgxpool.Pool, specDir string) error {
	if err := ensureMigrationsTable(ctx, pool); err != nil {
		return err
	}
	entries, err := os.ReadDir(specDir)
	if err != nil {
		return fmt.Errorf("read spec db dir: %w", err)
	}
	var names []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Strings(names)
	for _, name := range names {
		applied, err := migrationApplied(ctx, pool, name)
		if err != nil {
			return err
		}
		if applied {
			continue
		}
		body, err := os.ReadFile(filepath.Join(specDir, name))
		if err != nil {
			return err
		}
		if _, err := pool.Exec(ctx, string(body)); err != nil {
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO schema_migrations (name) VALUES ($1)`, name); err != nil {
			return err
		}
	}
	return nil
}

func ensureMigrationsTable(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`)
	return err
}

func migrationApplied(ctx context.Context, pool *pgxpool.Pool, name string) (bool, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT COUNT(1) FROM schema_migrations WHERE name = $1`, name).Scan(&n)
	return n > 0, err
}
