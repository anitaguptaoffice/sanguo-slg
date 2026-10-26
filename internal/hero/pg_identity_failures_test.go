package hero

import (
	"context"
	"errors"
	"math"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGCreateConcurrentAcrossStores(t *testing.T) {
	ctx := context.Background()
	first := identityStore(t)
	otherPool, err := pgxpool.NewWithConfig(ctx, first.Pool.Config())
	if err != nil {
		t.Fatal(err)
	}
	defer otherPool.Close()
	stores := []*PGStore{first, NewPGStore(otherPool)}
	const count = 40
	var wg sync.WaitGroup
	ids := make(chan int64, count)
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			h := &Hero{ServerID: int32(i%3 + 1), PlayerID: int64(i + 1)}
			if err := stores[i%2].CreateHero(ctx, h); err != nil {
				t.Error(err)
				return
			}
			ids <- h.HeroID
		}(i)
	}
	wg.Wait()
	close(ids)
	seen := map[int64]bool{}
	for id := range ids {
		if id <= 0 || seen[id] {
			t.Fatalf("invalid or duplicate ID %d", id)
		}
		seen[id] = true
	}
	var rows int
	if err := first.Pool.QueryRow(ctx, "SELECT count(*) FROM player_hero").Scan(&rows); err != nil || rows != count || len(seen) != count {
		t.Fatalf("rows=%d unique=%d err=%v", rows, len(seen), err)
	}
}

func TestPGCreationFailuresNeverOverwrite(t *testing.T) {
	ctx := context.Background()
	store := identityStore(t)
	old := &Hero{ServerID: 1, PlayerID: 22, TemplateCfgID: 1001, DisplayName: "preserve", Loyalty: 70, Status: StatusMarch}
	if err := store.CreateHero(ctx, old); err != nil {
		t.Fatal(err)
	}
	// Deliberately corrupt only this isolated test sequence to exercise the hard
	// failure boundary; application writers must never setval/reset the allocator.
	if _, err := store.Pool.Exec(ctx, "SELECT setval('player_hero_id_seq',$1,false)", old.HeroID); err != nil {
		t.Fatal(err)
	}
	attempt := &Hero{ServerID: 1, PlayerID: 33, TemplateCfgID: 1002}
	err := store.CreateHero(ctx, attempt)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" || pgErr.ConstraintName != "player_hero_pkey" || attempt.HeroID != 0 {
		t.Fatalf("identity collision not preserved: %+v %v", attempt, err)
	}
	got, err := store.GetHero(ctx, old.ServerID, old.HeroID)
	if err != nil || got == nil || *got != *old {
		t.Fatalf("existing row overwritten: %+v %v", got, err)
	}
	duplicate := &Hero{ServerID: 1, PlayerID: old.PlayerID, TemplateCfgID: old.TemplateCfgID}
	err = store.CreateHero(ctx, duplicate)
	if !errors.As(err, &pgErr) || pgErr.ConstraintName != "uq_player_hero_template_once" || duplicate.HeroID != 0 {
		t.Fatalf("template conflict confused with identity: %+v %v", duplicate, err)
	}
	if _, err := store.Pool.Exec(ctx, "SELECT setval('player_hero_id_seq',$1,true)", int64(math.MaxInt64)); err != nil {
		t.Fatal(err)
	}
	if err := store.CreateHero(ctx, attempt); err == nil || attempt.HeroID != 0 {
		t.Fatalf("exhausted sequence fell back: %+v %v", attempt, err)
	}
	if _, err := store.Pool.Exec(ctx, "DROP SEQUENCE player_hero_id_seq"); err != nil {
		t.Fatal(err)
	}
	if err := store.CreateHero(ctx, attempt); err == nil || attempt.HeroID != 0 {
		t.Fatalf("missing sequence fell back: %+v %v", attempt, err)
	}
	var count int
	if err := store.Pool.QueryRow(ctx, "SELECT count(*) FROM player_hero").Scan(&count); err != nil || count != 1 {
		t.Fatalf("failed attempts added rows: %d %v", count, err)
	}
}

func TestPGCallerCommitPublishesOnlyInsertedID(t *testing.T) {
	ctx := context.Background()
	store := identityStore(t)
	tx, err := store.Pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	h := &Hero{ServerID: 2, PlayerID: 4, Level: 1, Loyalty: 70, Status: StatusIdle}
	if err := (&PGStore{}).CreateHeroInTx(ctx, tx, h); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	got, err := store.GetHero(ctx, h.ServerID, h.HeroID)
	if err != nil || got == nil || *got != *h {
		t.Fatalf("commit reload: %+v %v", got, err)
	}
	if err := store.CreateHero(ctx, h); !errors.Is(err, ErrHeroIdentity) {
		t.Fatalf("reuse of assigned input: %v", err)
	}
}

func TestCreationRejectsInvalidInputBeforeDatabase(t *testing.T) {
	ctx := context.Background()
	for _, store := range []Store{NewMemStore(), &PGStore{}} {
		for _, h := range []*Hero{nil, {HeroID: 99}} {
			if err := store.CreateHero(ctx, h); !errors.Is(err, ErrHeroIdentity) {
				t.Fatalf("explicit identity accepted: %v", err)
			}
		}
		for _, h := range []*Hero{{ForceAdd: 1}, {IntelAdd: 1}, {PoliticsAdd: 1}} {
			if err := store.CreateHero(ctx, h); !errors.Is(err, ErrHeroCreatePoints) {
				t.Fatalf("allocated points accepted: %v", err)
			}
		}
	}
}

func TestPGHistoricalSameIDsRemainIndependent(t *testing.T) {
	ctx := context.Background()
	store := identityStore(t)
	// Test-only import of legal legacy identities; never use SaveHero to insert.
	if _, err := store.Pool.Exec(ctx, `INSERT INTO player_hero
		(server_id, hero_id, player_id, template_cfg_id) VALUES (1,55,1,1001),(2,55,2,1001)`); err != nil {
		t.Fatal(err)
	}
	h, err := store.GetHero(ctx, 1, 55)
	if err != nil || h == nil {
		t.Fatalf("legacy reload: %+v %v", h, err)
	}
	h.PlayerID, h.Status = 3, StatusComing
	if err := store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	other, err := store.GetHero(ctx, 2, 55)
	if err != nil || other == nil || other.PlayerID != 2 || other.Status != StatusIdle {
		t.Fatalf("other shard changed: %+v %v", other, err)
	}
	if err := store.DeleteHero(ctx, 1, 55); err != nil {
		t.Fatal(err)
	}
	other, err = store.GetHero(ctx, 2, 55)
	if err != nil || other == nil || other.PlayerID != 2 {
		t.Fatalf("other shard deleted: %+v %v", other, err)
	}
}
