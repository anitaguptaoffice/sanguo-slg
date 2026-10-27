package world

import (
	"context"
	"errors"
	"math"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func sequenceOwner(t *testing.T, b *recruittx.Binding, ctx context.Context) (*recruittx.Owner, *recruittx.Access) {
	t.Helper()
	o, err := b.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		clean, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = o.Rollback(clean)
	})
	return o, o.Access()
}

func sequenceFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, string) {
	t.Helper()
	pool := creationPool(t)
	var schema string
	var version int
	if err := pool.QueryRow(context.Background(), "SELECT current_schema(),current_setting('server_version_num')::integer/10000").Scan(&schema, &version); err != nil || version != 17 {
		t.Fatal("PG17 required", err)
	}
	creationSQL(t, pool, "CREATE SEQUENCE "+pgx.Identifier{schema, "player_city_id_seq"}.Sanitize()+" AS bigint START 1 MINVALUE 1 MAXVALUE 9223372036854775807 INCREMENT 1 CACHE 1 NO CYCLE OWNED BY NONE")
	b, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	return pool, b, schema
}

func TestPGCitySequenceLifetime(t *testing.T) {
	pool, b, schema := sequenceFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	o, a := sequenceOwner(t, b, ctx)
	s, err := captureCitySequence(ctx, a, b, schema)
	if err != nil {
		t.Fatal(err)
	}
	if id, err := s.next(ctx, a); err != nil || id != 1 {
		t.Fatal("first", id, err)
	}
	if err = o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if id, err := s.next(ctx, a); !errors.Is(err, recruittx.ErrInactive) || id != 0 {
		t.Fatal("ended", id, err)
	}
	o2, a2 := sequenceOwner(t, b, ctx)
	if id, err := s.next(ctx, a2); err != nil || id != 2 {
		t.Fatal("rollback rewound", id, err)
	}
	if err = o2.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	foreign, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	_, wrong := sequenceOwner(t, foreign, ctx)
	if id, err := s.next(ctx, wrong); !errors.Is(err, recruittx.ErrBinding) || id != 0 {
		t.Fatal("wrong binding", id, err)
	}
	other, err := pgxpool.NewWithConfig(ctx, pool.Config())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(other.Close)
	otherBinding, err := recruittx.NewBinding(other)
	if err != nil {
		t.Fatal(err)
	}
	_, otherAccess := sequenceOwner(t, otherBinding, ctx)
	if id, err := s.next(ctx, otherAccess); !errors.Is(err, recruittx.ErrBinding) || id != 0 {
		t.Fatal("foreign pool", id, err)
	}
	_, a3 := sequenceOwner(t, b, ctx)
	if id, err := s.next(ctx, a3); err != nil || id != 3 {
		t.Fatal("failed call consumed or retired", id, err)
	}
}

func TestPGCitySequenceDrift(t *testing.T) {
	for _, kind := range []string{"missing", "table", "oid", "increment", "cache", "cycle", "owned", "default"} {
		t.Run(kind, func(t *testing.T) {
			pool, b, schema := sequenceFixture(t)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			o, a := sequenceOwner(t, b, ctx)
			s, err := captureCitySequence(ctx, a, b, schema)
			if err != nil {
				t.Fatal(err)
			}
			if err = o.Rollback(ctx); err != nil {
				t.Fatal(err)
			} // do not mutate under an open allocator transaction
			switch kind {
			case "missing":
				creationSQL(t, pool, "DROP SEQUENCE player_city_id_seq")
			case "table":
				creationSQL(t, pool, "DROP SEQUENCE player_city_id_seq; CREATE TABLE player_city_id_seq(unexpected integer)")
			case "oid":
				creationSQL(t, pool, "ALTER SEQUENCE player_city_id_seq RENAME TO old_city_seq; CREATE SEQUENCE player_city_id_seq AS bigint MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE")
			case "increment":
				creationSQL(t, pool, "ALTER SEQUENCE player_city_id_seq INCREMENT BY 2")
			case "cache":
				creationSQL(t, pool, "ALTER SEQUENCE player_city_id_seq CACHE 2")
			case "cycle":
				creationSQL(t, pool, "ALTER SEQUENCE player_city_id_seq CYCLE")
			case "owned":
				creationSQL(t, pool, "CREATE TABLE sequence_fixture(id bigint); ALTER SEQUENCE player_city_id_seq OWNED BY sequence_fixture.id")
			case "default":
				creationSQL(t, pool, "CREATE TABLE sequence_fixture(id bigint DEFAULT nextval('player_city_id_seq'))")
			}
			_, access := sequenceOwner(t, b, ctx)
			if id, err := s.next(ctx, access); !errors.Is(err, errCitySequence) || id != 0 || !s.retired.Load() {
				t.Fatal("drift accepted", id, err)
			}
			if kind == "increment" {
				creationSQL(t, pool, "ALTER SEQUENCE player_city_id_seq INCREMENT BY 1")
				if id, err := s.next(ctx, access); !errors.Is(err, errCitySequence) || id != 0 {
					t.Fatal("automatic reopen", id, err)
				}
			}
		})
	}
}

func TestPGCitySequenceSchemaAndBounds(t *testing.T) {
	pool, b, _ := sequenceFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	schema := "City_Seq_\"quoted"
	creationSQL(t, pool, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize())
	t.Cleanup(func() { creationSQL(t, pool, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE") })
	name := pgx.Identifier{schema, "player_city_id_seq"}.Sanitize()
	creationSQL(t, pool, "CREATE SEQUENCE "+name+" AS bigint MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE")
	o, a := sequenceOwner(t, b, ctx)
	s, err := captureCitySequence(ctx, a, b, schema)
	if err != nil {
		t.Fatal("literal schema", err)
	}
	if _, err = captureCitySequence(ctx, a, b, schema+strings.Repeat("x", 80)); err == nil {
		t.Fatal("retargeted long schema")
	}
	if err = o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	// setval is fixture-only setup; production mechanism never sets or rewinds.
	creationSQL(t, pool, "SELECT setval($1::regclass,$2,false)", name, int64(math.MaxInt64))
	o2, a2 := sequenceOwner(t, b, ctx)
	if id, err := s.next(ctx, a2); err != nil || id != math.MaxInt64 {
		t.Fatal("last valid ID", id, err)
	}
	if err = o2.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	_, a3 := sequenceOwner(t, b, ctx)
	if id, err := s.next(ctx, a3); err == nil || id != 0 || !s.retired.Load() {
		t.Fatal("exhaustion wrapped", id, err)
	}
}

func TestPGCitySequenceConcurrent(t *testing.T) {
	_, b, schema := sequenceFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	o, a := sequenceOwner(t, b, ctx)
	s, err := captureCitySequence(ctx, a, b, schema)
	if err != nil {
		t.Fatal(err)
	}
	if err = o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	type result struct {
		id  int64
		err error
	}
	out := make(chan result, 8)
	var group sync.WaitGroup
	for i := 0; i < 8; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			owner, err := b.Begin(ctx)
			if err != nil {
				out <- result{err: err}
				return
			}
			defer func() {
				clean, c := context.WithTimeout(context.Background(), 5*time.Second)
				defer c()
				_ = owner.Rollback(clean)
			}()
			id, err := s.next(ctx, owner.Access())
			out <- result{id, err}
		}()
	}
	group.Wait()
	close(out)
	seen := map[int64]bool{}
	for r := range out {
		if r.err != nil || r.id < 1 || r.id > 8 || seen[r.id] {
			t.Fatal("duplicate/invalid sequence", r)
		}
		seen[r.id] = true
	}
	if len(seen) != 8 {
		t.Fatal("missing result")
	}
}
