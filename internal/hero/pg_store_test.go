package hero

import (
	"context"
	"os"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGStoreRecruitSurvivesRestart(t *testing.T) {
	pool := openHeroTestDB(t)
	ctx := context.Background()
	applyHeroSchema(t, pool)
	store := NewPGStore(pool)

	ps := &PlayerState{
		ServerID: 1, PlayerID: 42,
		Wallet: Resources{10000, 10000, 10000, 10000},
		Items:  map[int32]int32{RecruitScrollID: 5},
	}
	svc1 := NewService()
	svc1.UseStore(store)
	res, err := svc1.RecruitAndPersist(ctx, ps, RecruitRequest{TemplateCfgID: 1002})
	if err != nil {
		t.Fatal(err)
	}

	svc2 := NewService()
	svc2.UseStore(store)
	got, err := svc2.Store.GetHero(ctx, 1, res.Hero.HeroID)
	if err != nil || got == nil || got.TemplateCfgID != 1002 {
		t.Fatalf("reload hero: %+v err=%v", got, err)
	}
	heroes, err := store.ListPlayerHeroes(ctx, 1, 42)
	if err != nil || len(heroes) != 1 {
		t.Fatalf("list: %+v err=%v", heroes, err)
	}
}

func openHeroTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	pool, err := db.Open(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	return pool
}

func applyHeroSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	if err := db.ApplySpecs(context.Background(), pool, "spec/db"); err != nil {
		t.Fatal(err)
	}
}
