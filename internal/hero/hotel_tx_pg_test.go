package hero

import (
	"context"
	"errors"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func txHotelCandidate(id int64, at time.Time) *HotelCandidate {
	c := GenerateHotelCandidate(rand.New(rand.NewSource(id)), 77, 3, id, at)
	c.ServerID = 1
	return c
}

func beginHotelTestTx(t *testing.T, pool *pgxpool.Pool) pgx.Tx {
	t.Helper()
	tx, err := pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	return tx
}

func TestPGHotelTxCallerOwnsPoolTickHeroAndIDs(t *testing.T) {
	store := identityStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cfg := store.Pool.Config()
	cfg.MaxConns = 1
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	port := NewPGHotelStore(pool) // Its only connection is already occupied by tx.
	if rows, err := port.ListCandidatesInTx(ctx, tx, 1, 77); err != nil || len(rows) != 0 {
		t.Fatalf("empty candidates: %v %v", rows, err)
	}
	if at, err := port.LastPoolTickInTx(ctx, tx, 1, 77); err != nil || !at.IsZero() {
		t.Fatalf("absent schedule: %v %v", at, err)
	}
	now := time.Unix(1_700_000_000, 0).UTC()
	var rows []*HotelCandidate
	var lastID int64
	for i := 0; i < 3; i++ {
		lastID, err = port.NextCandidateIDInTx(ctx, tx, 1, 77)
		if err != nil {
			t.Fatal(err)
		}
		rows = append(rows, txHotelCandidate(lastID, now))
	}
	// ID 3 is older; IDs 1 and 2 tie. Return order differs from lock order.
	rows[2].GeneratedAt = now.Add(-time.Hour)
	if err := port.ReplaceCandidatesInTx(ctx, tx, 1, 77, rows); err != nil {
		t.Fatal(err)
	}
	if err := port.SetLastPoolTickInTx(ctx, tx, 1, 77, now); err != nil {
		t.Fatal(err)
	}
	port = &PGHotelStore{} // Every subsequent operation must also work without Pool.
	got, err := port.ListCandidatesInTx(ctx, tx, 1, 77)
	if err != nil || len(got) != 3 || got[0].CandidateID != rows[2].CandidateID || got[1].CandidateID != rows[0].CandidateID {
		t.Fatalf("oldest ordering: %+v %v", got, err)
	}
	if at, err := port.LastPoolTickInTx(ctx, tx, 1, 77); err != nil || !at.Equal(now) {
		t.Fatalf("read own tick: %v %v", at, err)
	}
	for _, scope := range [][2]int64{{2, 77}, {1, 78}} {
		if other, err := port.ListCandidatesInTx(ctx, tx, int32(scope[0]), scope[1]); err != nil || len(other) != 0 {
			t.Fatalf("scope leak: %v %v", other, err)
		}
		if err := port.ConsumeCandidateInTx(ctx, tx, int32(scope[0]), scope[1], got[0].CandidateID); !errors.Is(err, ErrHotelCandidateMissing) {
			t.Fatalf("scope consume: %v", err)
		}
	}
	svc := NewService()
	svc.SetClock(func() time.Time { return now })
	plan, err := svc.PlanHotelRecruit(PlayerRef{ServerID: 1, PlayerID: 9}, CityRef{CityID: 77}, 3, 1, nil, got[0].CandidateID, got[0])
	if err != nil {
		t.Fatal(err)
	}
	if err := port.ConsumeCandidateInTx(ctx, tx, 1, 77, plan.CandidateID); err != nil {
		t.Fatal(err)
	}
	if err := port.ConsumeCandidateInTx(ctx, tx, 1, 77, plan.CandidateID); !errors.Is(err, ErrHotelCandidateMissing) {
		t.Fatalf("second consumption succeeded: %v", err)
	}
	if err := (&PGStore{}).CreateHeroInTx(ctx, tx, plan.Hero); err != nil {
		t.Fatal(err)
	}
	if plan.Hero.HeroID != 1 || plan.Hero.HeroID == plan.CandidateID {
		t.Fatalf("candidate reservation/copy contaminated hero identity: %+v", plan)
	}
	if heroes, err := (&PGStore{}).ListPlayerHeroesInTx(ctx, tx, 1, 9); err != nil || len(heroes) != 1 {
		t.Fatalf("hero draft tx: %v %v", heroes, err)
	}
	var visible int
	const countAll = `SELECT (SELECT count(*) FROM city_hotel_recruit) +
		(SELECT count(*) FROM city_hotel_schedule) + (SELECT count(*) FROM player_hero)`
	if err := store.Pool.QueryRow(ctx, countAll).Scan(&visible); err != nil || visible != 0 {
		t.Fatalf("port committed: %d %v", visible, err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if err := store.Pool.QueryRow(ctx, countAll).Scan(&visible); err != nil || visible != 0 {
		t.Fatalf("partial rollback: %d %v", visible, err)
	}
	if _, err := port.ListCandidatesInTx(ctx, tx, 1, 77); !errors.Is(err, pgx.ErrTxClosed) {
		t.Fatalf("closed transaction fallback: %v", err)
	}
	tx = beginHotelTestTx(t, pool)
	id, err := port.NextCandidateIDInTx(ctx, tx, 1, 77)
	if err != nil || id <= lastID {
		t.Fatalf("candidate rollback ID reuse: %d %v", id, err)
	}
	h := &Hero{ServerID: 1, PlayerID: 9}
	if err := store.CreateHeroInTx(ctx, tx, h); err != nil || h.HeroID <= plan.Hero.HeroID {
		t.Fatalf("hero rollback ID reuse: %+v %v", h, err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestPGHotelTxReplacementFailurePreservesCommittedPool(t *testing.T) {
	store := identityStore(t)
	ctx := context.Background()
	port, now := &PGHotelStore{}, time.Unix(1_700_000_000, 0).UTC()
	tx := beginHotelTestTx(t, store.Pool)
	id, err := port.NextCandidateIDInTx(ctx, tx, 1, 77)
	if err != nil {
		t.Fatal(err)
	}
	if err := port.ReplaceCandidatesInTx(ctx, tx, 1, 77, []*HotelCandidate{txHotelCandidate(id, now)}); err != nil {
		t.Fatal(err)
	}
	if err := port.SetLastPoolTickInTx(ctx, tx, 1, 77, now); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	if _, err := port.ListCandidatesInTx(ctx, tx, 1, 77); err != nil {
		t.Fatal(err)
	}
	if err := port.SetLastPoolTickInTx(ctx, tx, 1, 77, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	newID, err := port.NextCandidateIDInTx(ctx, tx, 1, 77)
	if err != nil {
		t.Fatal(err)
	}
	bad := txHotelCandidate(newID, now)
	bad.DisplayName = strings.Repeat("x", 65) // Insert fails after pool deletion.
	if err := port.ReplaceCandidatesInTx(ctx, tx, 1, 77, []*HotelCandidate{bad}); err == nil {
		t.Fatal("expected insert error")
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tx = beginHotelTestTx(t, store.Pool)
	rows, err := port.ListCandidatesInTx(ctx, tx, 1, 77)
	if err != nil || len(rows) != 1 || rows[0].CandidateID != id {
		t.Fatalf("committed pool lost: %+v %v", rows, err)
	}
	if tick, err := port.LastPoolTickInTx(ctx, tx, 1, 77); err != nil || !tick.Equal(now) {
		t.Fatalf("partial tick: %v %v", tick, err)
	}
}

func TestPGHotelTxExactlyOneConcurrentConsume(t *testing.T) {
	store := identityStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	port := &PGHotelStore{}
	tx := beginHotelTestTx(t, store.Pool)
	id, err := port.NextCandidateIDInTx(ctx, tx, 1, 77)
	if err != nil {
		t.Fatal(err)
	}
	if err := port.ReplaceCandidatesInTx(ctx, tx, 1, 77, []*HotelCandidate{txHotelCandidate(id, time.Now())}); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	a, b := beginHotelTestTx(t, store.Pool), beginHotelTestTx(t, store.Pool)
	if err := port.ConsumeCandidateInTx(ctx, a, 1, 77, id); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- port.ConsumeCandidateInTx(ctx, b, 1, 77, id) }()
	select {
	case err := <-done:
		t.Fatalf("second delete did not wait: %v", err)
	case <-time.After(50 * time.Millisecond):
	}
	if err := a.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err := <-done; !errors.Is(err, ErrHotelCandidateMissing) {
		t.Fatalf("second consume: %v", err)
	}
	if err := b.Commit(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestPGHotelTxSequenceFailuresDoNotFallback(t *testing.T) {
	for _, mode := range []string{"missing", "exhausted", "canceled"} {
		t.Run(mode, func(t *testing.T) {
			store := identityStore(t)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			tx := beginHotelTestTx(t, store.Pool)
			var err error
			switch mode {
			case "missing":
				_, err = tx.Exec(ctx, "DROP SEQUENCE city_hotel_candidate_id_seq")
			case "exhausted":
				_, err = tx.Exec(ctx, "SELECT setval('city_hotel_candidate_id_seq',9223372036854775807,true)")
			case "canceled":
				cancel()
			}
			if err != nil {
				t.Fatal(err)
			}
			if id, err := (&PGHotelStore{}).NextCandidateIDInTx(ctx, tx, 1, 77); err == nil || id != 0 {
				t.Fatalf("fallback ID=%d err=%v", id, err)
			}
		})
	}
}
