package world

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func creationPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set; isolated PostgreSQL required")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("world_creation_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
		admin.Close()
		if err != nil {
			t.Error(err)
		}
	})
	for _, file := range []string{"001_account.sql", "002_world.sql"} {
		sql, err := os.ReadFile("../../spec/db/" + file)
		if err != nil {
			t.Fatal(err)
		}
		creationSQL(t, pool, string(sql))
	}
	creationSQL(t, pool, `WITH a AS (INSERT INTO account(login_name,password_hash) VALUES ('world','unused') RETURNING account_id)
 INSERT INTO player(server_id,player_id,account_id,display_name) SELECT s,7,account_id,'world' FROM a CROSS JOIN generate_series(1,2) s`)
	for _, sid := range []int32{1, 2} {
		if err := NewPGStore(pool).SaveChunk(ctx, sid, GenerateChunk(sid, 0, 0)); err != nil {
			t.Fatal(err)
		}
	}
	return pool
}

func creationSQL(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

func creationCount(t *testing.T, pool *pgxpool.Pool, want int) {
	t.Helper()
	var got int
	if err := pool.QueryRow(context.Background(), "SELECT count(*) FROM player_city").Scan(&got); err != nil || got != want {
		t.Fatalf("cities=%d want=%d err=%v", got, want, err)
	}
}

func creationRequest(t *testing.T, sid int32, offset int) City {
	t.Helper()
	for _, cell := range GenerateChunk(sid, 0, 0) {
		if !cell.Buildable() {
			continue
		}
		if offset == 0 {
			c := newCityRequest()
			c.ServerID, c.X, c.Y = sid, cell.X, cell.Y
			return c
		}
		offset--
	}
	t.Fatal("not enough buildable tiles")
	return City{}
}

func creationBegin(t *testing.T, pool *pgxpool.Pool) pgx.Tx {
	t.Helper()
	tx, err := pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	return tx
}

func TestPGCreateCityParticipantCallerOwnsCommit(t *testing.T) {
	pool, ctx := creationPool(t), context.Background()
	svc := &Service{Store: NewPGStore(nil)}
	request := creationRequest(t, 1, 0)
	tx := creationBegin(t, pool)
	got, err := svc.CreateCityInTx(ctx, tx, request)
	if err != nil || got.CityID != 1 || request.CityID != 0 {
		t.Fatal(got, err)
	}
	creationCount(t, pool, 0) // A different connection cannot see staged state.
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	creationCount(t, pool, 0)
	tx = creationBegin(t, pool)
	got, err = svc.CreateCityInTx(ctx, tx, request)
	if err != nil || got.CityID != 1 {
		t.Fatal(got, err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	creationCount(t, pool, 1)
	tx = creationBegin(t, pool)
	if _, err := svc.CreateCityInTx(ctx, tx, request); !errors.Is(err, ErrOccupied) {
		t.Fatal("coordinate conflict", err)
	}
	_ = tx.Rollback(ctx)
	stored, err := NewPGStore(pool).CityAt(ctx, 1, request.X, request.Y)
	if err != nil || stored == nil || *stored != got {
		t.Fatal("existing row overwritten", stored, err)
	}
}

func TestPGCreateCityParticipantAuthoritativeGuards(t *testing.T) {
	pool := creationPool(t)
	base := creationRequest(t, 1, 0)
	for _, test := range []struct {
		name   string
		mutate func(*City)
		want   error
	}{
		{"missing owner", func(c *City) { c.PlayerID = 99 }, ErrCityOwnerMissing},
		{"foreign shard", func(c *City) { c.ServerID = 3 }, ErrCityOwnerMissing},
		{"missing tile", func(c *City) { c.X, c.Y = 100, 100 }, ErrBadTerrain},
		{"bad terrain", func(c *City) {
			for _, cell := range GenerateChunk(1, 0, 0) {
				if !cell.Buildable() {
					c.X, c.Y = cell.X, cell.Y
					return
				}
			}
			t.Fatal("no unbuildable tile")
		}, ErrBadTerrain},
	} {
		t.Run(test.name, func(t *testing.T) {
			request, tx := base, creationBegin(t, pool)
			test.mutate(&request)
			if _, err := NewPGStore(nil).CreateCityInTx(context.Background(), tx, request); !errors.Is(err, test.want) {
				t.Fatal(err)
			}
			_ = tx.Rollback(context.Background())
			creationCount(t, pool, 0)
		})
	}
}

func TestPGCreateCityParticipantConcurrentAllocation(t *testing.T) {
	pool := creationPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	type result struct {
		city City
		err  error
	}
	run := func(requests []City) []result {
		ch := make(chan result, len(requests))
		start := make(chan struct{})
		for _, request := range requests {
			go func(c City) {
				<-start
				tx, err := pool.Begin(ctx)
				if err != nil {
					ch <- result{err: err}
					return
				}
				defer tx.Rollback(context.Background())
				got, err := NewPGStore(nil).CreateCityInTx(ctx, tx, c)
				if err == nil {
					err = tx.Commit(ctx)
				}
				ch <- result{got, err}
			}(request)
		}
		close(start)
		out := make([]result, 0, len(requests))
		for range requests {
			out = append(out, <-ch)
		}
		return out
	}
	var requests []City
	for i := 0; i < 8; i++ {
		requests = append(requests, creationRequest(t, 1, i))
	}
	seen := map[int64]bool{}
	for _, got := range run(requests) {
		if got.err != nil || got.city.CityID < 1 || got.city.CityID > 8 || seen[got.city.CityID] {
			t.Fatal("MAX+1 race", got)
		}
		seen[got.city.CityID] = true
	}
	c := creationRequest(t, 1, 8)
	wins, occupied := 0, 0
	for _, got := range run([]City{c, c}) {
		if got.err == nil {
			wins++
		} else if errors.Is(got.err, ErrOccupied) {
			occupied++
		} else {
			t.Fatal(got.err)
		}
	}
	if wins != 1 || occupied != 1 {
		t.Fatal(wins, occupied)
	}
	creationCount(t, pool, 9)
}

// Simulates an old, uncooperative writer between MAX and INSERT.
type creationCollisionTx struct {
	pgx.Tx
	pool   *pgxpool.Pool
	legacy City
}

func (tx *creationCollisionTx) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	if strings.HasPrefix(sql, "INSERT INTO player_city") {
		c := tx.legacy
		c.CityID = args[1].(int64)
		if err := NewPGStore(tx.pool).CreateCity(ctx, c); err != nil {
			return pgconn.CommandTag{}, err
		}
	}
	return tx.Tx.Exec(ctx, sql, args...)
}

func TestPGCreateCityParticipantCannotOverwriteLegacyID(t *testing.T) {
	pool, ctx := creationPool(t), context.Background()
	legacy := creationRequest(t, 1, 1)
	legacy.Name = "legacy"
	tx := creationBegin(t, pool)
	wrapped := &creationCollisionTx{tx, pool, legacy}
	if _, err := NewPGStore(nil).CreateCityInTx(ctx, wrapped, creationRequest(t, 1, 0)); !errors.Is(err, ErrCityIDConflict) {
		t.Fatal("ID collision misclassified", err)
	}
	_ = tx.Rollback(ctx)
	legacy.CityID = 1
	stored, err := NewPGStore(pool).CityAt(ctx, 1, legacy.X, legacy.Y)
	if err != nil || stored == nil || *stored != legacy {
		t.Fatal(stored, err)
	}
	creationCount(t, pool, 1)
}

func TestPGCreateCityParticipantDeferredCommitAndShardIsolation(t *testing.T) {
	pool, ctx := creationPool(t), context.Background()
	tx1, tx2 := creationBegin(t, pool), creationBegin(t, pool)
	bounded, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	for i, tx := range []pgx.Tx{tx1, tx2} {
		got, err := NewPGStore(nil).CreateCityInTx(bounded, tx, creationRequest(t, int32(i+1), 0))
		if err != nil || got.CityID != 1 {
			t.Fatal("shards share lock or IDs", got, err)
		}
	}
	_ = tx1.Rollback(ctx)
	_ = tx2.Rollback(ctx)
	creationSQL(t, pool, `CREATE FUNCTION reject_city_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected city rejection'; END $$;
 CREATE CONSTRAINT TRIGGER reject_city_commit AFTER INSERT ON player_city DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_city_commit()`)
	tx := creationBegin(t, pool)
	if _, err := NewPGStore(nil).CreateCityInTx(ctx, tx, creationRequest(t, 1, 0)); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err == nil || !strings.Contains(err.Error(), "injected city rejection") {
		t.Fatal(err)
	}
	creationCount(t, pool, 0)
}
