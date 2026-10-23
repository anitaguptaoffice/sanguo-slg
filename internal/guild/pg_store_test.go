package guild

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGStoreGuildLifecycle(t *testing.T) {
	pool := openGuildTestDB(t)
	ctx := context.Background()
	applyGuildSchema(t, pool)
	store := NewPGStore(pool)

	now := time.Unix(1_700_000_200, 0).UTC()
	g := Guild{
		ServerID:       9,
		Name:           "pg-guild",
		LeaderPlayerID: 100,
		MemberLimit:    DefaultMemberLimit,
		CreatedAt:      now,
	}
	leader := Member{PlayerID: 100, Role: RoleLeader, JoinedAt: now}
	if err := store.CreateGuild(ctx, g, leader); err != nil {
		t.Fatal(err)
	}
	created, err := store.GetGuild(ctx, 9, 1)
	if err != nil || created.Name != "pg-guild" || created.MemberCount != 1 {
		t.Fatalf("guild %+v err=%v", created, err)
	}
	if err := store.AddMember(ctx, 9, 1, Member{PlayerID: 101}); err != nil {
		t.Fatal(err)
	}
	rows, total, err := store.ListMembers(ctx, 9, 1, 0, 10)
	if err != nil || total != 2 || len(rows) != 2 {
		t.Fatalf("members total=%d rows=%d err=%v", total, len(rows), err)
	}
	if err := store.RemoveMember(ctx, 9, 101); err != nil {
		t.Fatal(err)
	}
	updated, _ := store.GetGuild(ctx, 9, 1)
	if updated.MemberCount != 1 {
		t.Fatalf("count=%d", updated.MemberCount)
	}
}

func openGuildTestDB(t *testing.T) *pgxpool.Pool {
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

func applyGuildSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	specDir := filepath.Join("spec", "db")
	if err := db.ApplySpecs(context.Background(), pool, specDir); err != nil {
		t.Fatal(err)
	}
}
