package report

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSaveGetListMem(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	fixed := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	svc := NewService(store)
	svc.now = func() time.Time { return fixed }

	in := battle.BaselineInputs()[0]
	rep := battle.Simulate(in)

	rec, err := svc.Save(ctx, SaveParams{
		ServerID:         1,
		ReportID:         9001,
		AttackerPlayerID: 101,
		DefenderPlayerID: 202,
		DefenderCityID:   5001,
		LocationX:        12,
		LocationY:        34,
		Report:           rep,
	})
	if err != nil {
		t.Fatal(err)
	}
	if rec.Outcome != OutcomeFromResult(rep.Result) {
		t.Fatalf("outcome %d", rec.Outcome)
	}

	got, err := svc.Get(ctx, 1, 9001)
	if err != nil {
		t.Fatal(err)
	}
	if got.Detail.Result != rep.Result || len(got.Detail.Rounds) != len(rep.Rounds) {
		t.Fatal("detail mismatch")
	}

	page, err := svc.ListForPlayer(ctx, ListParams{ServerID: 1, PlayerID: 202, Limit: 10, Offset: 0})
	if err != nil || len(page.Items) != 1 || page.Total != 1 {
		t.Fatalf("defender list: %+v err=%v", page, err)
	}

	page2, err := svc.ListForPlayer(ctx, ListParams{ServerID: 1, PlayerID: 999, Limit: 10})
	if err != nil || len(page2.Items) != 0 {
		t.Fatalf("empty list: %+v", page2)
	}

	_, err = svc.Get(ctx, 1, 404)
	if err != ErrNotFound {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestListPaginationMem(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	svc := NewService(store)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return base }

	rep := battle.Simulate(battle.BattleInput{
		BattleID:   "p",
		AttackerID: "a",
		DefenderID: "d",
		Attacker:   battle.Army{Troops: map[battle.TroopType]int{battle.TroopInfantry: 50}},
		Defender:   battle.Army{Troops: map[battle.TroopType]int{battle.TroopInfantry: 40}},
	})

	for i := 0; i < 5; i++ {
		svc.now = func() time.Time { return base.Add(time.Duration(i) * time.Hour) }
		_, err := svc.Save(ctx, SaveParams{
			ServerID:         1,
			ReportID:         int64(100 + i),
			AttackerPlayerID: 42,
			Report:           rep,
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	page, err := svc.ListForPlayer(ctx, ListParams{ServerID: 1, PlayerID: 42, Limit: 2, Offset: 0})
	if err != nil || page.Total != 5 || len(page.Items) != 2 || page.Items[0].ReportID != 104 {
		t.Fatalf("page1: %+v err=%v", page, err)
	}
	page, err = svc.ListForPlayer(ctx, ListParams{ServerID: 1, PlayerID: 42, Limit: 2, Offset: 2})
	if err != nil || len(page.Items) != 2 || page.Items[0].ReportID != 102 {
		t.Fatalf("page2: %+v err=%v", page, err)
	}
}

func TestPGStoreSaveGetList(t *testing.T) {
	pool := openTestDB(t)
	ctx := context.Background()
	applyMilitarySchema(t, pool)

	store := NewPGStore(pool)
	fixed := time.Date(2026, 4, 1, 8, 0, 0, 0, time.UTC)
	svc := NewService(store)
	svc.now = func() time.Time { return fixed }

	rep := battle.Simulate(battle.BaselineInputs()[3])
	_, err := svc.Save(ctx, SaveParams{
		ServerID:         7,
		ReportID:         77,
		AttackerPlayerID: 1000,
		DefenderPlayerID: 2000,
		LocationX:        1,
		LocationY:        2,
		Report:           rep,
	})
	if err != nil {
		t.Fatal(err)
	}

	got, err := svc.Get(ctx, 7, 77)
	if err != nil {
		t.Fatal(err)
	}
	if got.Detail.FinalAttacker[battle.TroopInfantry] != rep.FinalAttacker[battle.TroopInfantry] {
		t.Fatal("round-trip detail")
	}

	page, err := svc.ListForPlayer(ctx, ListParams{ServerID: 7, PlayerID: 1000, Limit: 5})
	if err != nil || page.Total != 1 {
		t.Fatalf("list: %+v err=%v", page, err)
	}
}

func openTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := db.Open(ctx, url)
	if err != nil {
		t.Fatalf("db: %v", err)
	}
	return pool
}

func applyMilitarySchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	root := filepath.Join("..", "..", "spec", "db", "004_military.sql")
	sql, err := os.ReadFile(root)
	if err != nil {
		t.Fatalf("read schema: %v", err)
	}
	_, err = pool.Exec(context.Background(), string(sql))
	if err != nil {
		t.Fatalf("apply schema: %v", err)
	}
}
