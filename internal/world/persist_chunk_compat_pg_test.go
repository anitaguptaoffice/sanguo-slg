package world

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func compatOK(t testing.TB, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func compatExec(t testing.TB, ctx context.Context, c *pgx.Conn, sql string) {
	t.Helper()
	_, err := c.Exec(ctx, sql)
	compatOK(t, err)
}

func compatPG(t testing.TB, trace *compatTrace) (context.Context, *PGStore, *pgx.Conn) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; owned PostgreSQL 17 database required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	t.Cleanup(cancel)
	observer, err := pgx.Connect(ctx, dsn)
	compatOK(t, err)
	t.Cleanup(func() {
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		compatOK(t, observer.Close(cleanup))
	})
	var nonce [12]byte
	_, err = rand.Read(nonce[:])
	compatOK(t, err)
	schema := pgx.Identifier{fmt.Sprintf("world_compat_%x", nonce)}.Sanitize()
	compatExec(t, ctx, observer, "CREATE SCHEMA "+schema)
	t.Cleanup(func() {
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		compatExec(t, cleanup, observer, "DROP SCHEMA "+schema+" CASCADE")
	})
	compatExec(t, ctx, observer, "SET search_path TO "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	compatOK(t, err)
	cfg.MaxConns = 1
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "20000"
	if trace != nil {
		cfg.ConnConfig.Tracer = trace
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	compatOK(t, err)
	t.Cleanup(pool.Close)
	ddl, err := os.ReadFile("../../spec/db/002_world.sql")
	compatOK(t, err)
	compatExec(t, ctx, observer, string(ddl))
	var version, writerPID, observerPID int
	compatOK(t, observer.QueryRow(ctx, "SELECT current_setting('server_version_num')::int,pg_backend_pid()").Scan(&version, &observerPID))
	compatOK(t, pool.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&writerPID))
	if version/10000 != 17 || writerPID == observerPID {
		t.Fatal("PG17 and independent observer required", version, writerPID, observerPID)
	}
	t.Logf("PG=%d writer=%d observer=%d schema=%s", version, writerPID, observerPID, schema)
	return ctx, NewPGStore(pool), observer
}

// Physical identity is checked only when no committed change is expected.
func compatImage(t testing.TB, ctx context.Context, c *pgx.Conn) string {
	t.Helper()
	var image string
	compatOK(t, c.QueryRow(ctx, `SELECT jsonb_build_array(
 (SELECT jsonb_agg(jsonb_build_array(to_jsonb(m),m.ctid::text,m.xmin::text) ORDER BY server_id,y,x) FROM map_cell m),
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY server_id,y,x) FROM resource_node_state r),
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY server_id,city_id) FROM player_city p))::text`).Scan(&image))
	return image
}

func compatObserved(t testing.TB, ctx context.Context, c *pgx.Conn) []Cell {
	t.Helper()
	rows, err := c.Query(ctx, `SELECT x,y,terrain,COALESCE(resource_type,0),resource_level
 FROM map_cell WHERE server_id=7 AND x>=100 AND x<150 AND y>=150 AND y<200 ORDER BY y,x`)
	compatOK(t, err)
	defer rows.Close()
	got := []Cell{}
	for rows.Next() {
		var cell Cell
		compatOK(t, rows.Scan(&cell.X, &cell.Y, &cell.Terrain, &cell.ResourceType, &cell.ResourceLevel))
		got = append(got, cell)
	}
	compatOK(t, rows.Err())
	return got
}

func compatCells(t testing.TB, ctx context.Context, s *PGStore, c *pgx.Conn, want []Cell) []Cell {
	t.Helper()
	got := compatObserved(t, ctx, c)
	loaded, found, err := s.LoadChunk(ctx, 7, 2, 3)
	compatOK(t, err)
	if !found || !reflect.DeepEqual(got, want) || !reflect.DeepEqual(loaded, want) {
		t.Fatalf("observer/load differ from exact expected image: observer=%d loaded=%d want=%d found=%t", len(got), len(loaded), len(want), found)
	}
	return loaded
}

func compatUnrelated(t testing.TB, ctx context.Context, c *pgx.Conn) string {
	t.Helper()
	var image string
	compatOK(t, c.QueryRow(ctx, `SELECT jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY server_id,y,x) FROM resource_node_state r),
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY server_id,city_id) FROM player_city p))::text`).Scan(&image))
	return image
}

func TestPGChunkCompatibilitySparseAndLegacy(t *testing.T) {
	ctx, s, observer := compatPG(t, nil)
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	compatOK(t, s.SaveChunk(canceled, 7, nil))
	compatOK(t, s.SaveChunk(canceled, 7, []Cell{}))
	cells, found, err := s.LoadChunk(ctx, 7, 2, 3)
	if err != nil || found || len(cells) != 0 {
		t.Fatal("empty load", cells, found, err)
	}
	want := []Cell{{100, 150, TerrainPlain, 0, 4}, {149, 150, TerrainWater, 2, 3}, {100, 199, TerrainMountain, 0, 1}, {149, 199, TerrainPlain, 3, 2}}
	input := []Cell{want[3], want[1], want[2], {100, 150, TerrainWater, 4, 5}, want[0], {-1, 501, TerrainMountain, 0, 0}, {501, -1, TerrainWater, 0, 0}, {99, 150, TerrainWater, 0, 0}, {150, 150, TerrainWater, 0, 0}, {100, 149, TerrainWater, 0, 0}, {100, 200, TerrainWater, 0, 0}}
	beforeInput := append([]Cell(nil), input...)
	compatOK(t, s.SaveChunk(ctx, 7, input))
	compatOK(t, s.SaveChunk(ctx, 8, []Cell{{100, 150, TerrainMountain, 1, 5}}))
	if !reflect.DeepEqual(input, beforeInput) {
		t.Fatal("SaveChunk mutated input")
	}
	compatCells(t, ctx, s, observer, want)
	var total, nulls int
	compatOK(t, observer.QueryRow(ctx, "SELECT count(*),count(*) FILTER (WHERE resource_type IS NULL) FROM map_cell").Scan(&total, &nulls))
	if total != 11 || nulls != 8 {
		t.Fatal("arbitrary coordinates, duplicates, shard or NULL mapping", total, nulls)
	}
	before := compatImage(t, ctx, observer)
	loaded, err := NewLoader(s, 1).Cells(ctx, 7, 100, 150)
	compatOK(t, err)
	if !reflect.DeepEqual(loaded, want) || compatImage(t, ctx, observer) != before {
		t.Fatal("Loader repaired or changed a legacy partial chunk")
	}
	// One legacy row in every chunk makes InitServerMap's no-repair path bounded.
	compatExec(t, ctx, observer, `INSERT INTO map_cell(server_id,x,y,terrain)
 SELECT 7,x*50,y*50,0 FROM generate_series(0,9) x CROSS JOIN generate_series(0,9) y ON CONFLICT DO NOTHING`)
	before = compatImage(t, ctx, observer)
	compatOK(t, InitServerMap(ctx, s, 7))
	if compatImage(t, ctx, observer) != before {
		t.Fatal("InitServerMap changed found legacy chunks")
	}
}

func TestPGChunkCompatibilityUpdateRollbackAndCommit(t *testing.T) {
	ctx, s, observer := compatPG(t, nil)
	original := GenerateChunk(7, 2, 3)
	compatOK(t, s.SaveChunk(ctx, 7, original))
	compatCells(t, ctx, s, observer, original)
	compatExec(t, ctx, observer, `ALTER TABLE map_cell ADD COLUMN compat_note text NOT NULL DEFAULT 'new';
 UPDATE map_cell SET compat_note='kept';
 INSERT INTO resource_node_state(server_id,x,y,occupier_player_id,gather_rate) VALUES(7,100,150,91,4);
 INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(7,1,91,'fixture',100,150);
 CREATE SEQUENCE compat_attempts;
 CREATE FUNCTION compat_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM nextval('compat_attempts');
 IF NEW.x=100 AND NEW.y=175 THEN RAISE EXCEPTION 'compat midway update' USING ERRCODE='23514'; END IF;
 RETURN NEW; END $$;
 CREATE TRIGGER compat_fault BEFORE UPDATE ON map_cell FOR EACH ROW EXECUTE FUNCTION compat_fault()`)
	before := compatImage(t, ctx, observer)
	unrelated := compatUnrelated(t, ctx, observer)
	updated := append([]Cell(nil), original...)
	for i := range updated {
		updated[i].Terrain = Terrain((int(updated[i].Terrain) + 1) % 3)
		updated[i].ResourceType, updated[i].ResourceLevel = int16(i%5), int16(i%6)
	}
	err := s.SaveChunk(ctx, 7, updated)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23514" || pgErr.Message != "compat midway update" {
		t.Fatal("did not reach injected mid-update failure", err)
	}
	var attempts int
	compatOK(t, observer.QueryRow(ctx, "SELECT last_value FROM compat_attempts").Scan(&attempts))
	if attempts != 1251 || compatImage(t, ctx, observer) != before {
		t.Fatal("partial update, changed row identity or automatic retry", attempts)
	}
	compatCells(t, ctx, s, observer, original)
	compatExec(t, ctx, observer, "DROP TRIGGER compat_fault ON map_cell")
	compatOK(t, s.SaveChunk(ctx, 7, updated))
	loaded := compatCells(t, ctx, s, observer, updated)
	for _, want := range updated {
		got, ok := cellAt(loaded, want.X, want.Y)
		if !ok || got != want {
			t.Fatal("complete image cannot be indexed", want, got)
		}
	}
	var preserved, nulls, occupied, cities int
	compatOK(t, observer.QueryRow(ctx, `SELECT count(*) FILTER (WHERE compat_note='kept'),
 count(*) FILTER (WHERE resource_type IS NULL),
 (SELECT count(*) FROM resource_node_state WHERE occupier_player_id=91 AND gather_rate=4),
 (SELECT count(*) FROM player_city WHERE player_id=91 AND name='fixture') FROM map_cell`).Scan(&preserved, &nulls, &occupied, &cities))
	if preserved != 2500 || nulls != 500 || occupied != 1 || cities != 1 || compatUnrelated(t, ctx, observer) != unrelated {
		t.Fatal("upsert changed unrelated fields/tables or NULL mapping", preserved, nulls, occupied, cities)
	}
}

func TestPGChunkCompatibilityRefreshBoundary(t *testing.T) {
	ctx, s, observer := compatPG(t, nil)
	original := []Cell{{100, 150, TerrainPlain, 1, 1}, {101, 150, TerrainPlain, 2, 4}, {102, 150, TerrainPlain, 3, 5}, {103, 150, TerrainPlain, 0, 0}}
	compatOK(t, s.SaveChunk(ctx, 7, original))
	compatOK(t, s.SaveChunk(ctx, 8, original))
	compatExec(t, ctx, observer, `INSERT INTO resource_node_state(server_id,x,y,occupier_player_id,gather_rate)
 SELECT s,x,150,91,4 FROM generate_series(7,8) s CROSS JOIN generate_series(100,103) x;
 CREATE FUNCTION compat_refresh_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.x=101 THEN RAISE EXCEPTION 'compat refresh failure' USING ERRCODE='23514'; END IF;
 RETURN NEW; END $$;
 CREATE TRIGGER compat_refresh_fault BEFORE UPDATE ON map_cell FOR EACH ROW EXECUTE FUNCTION compat_refresh_fault()`)
	n, err := NewService(s).RefreshWildResources(ctx, 7)
	var pgErr *pgconn.PgError
	if n != 2 || !errors.As(err, &pgErr) || pgErr.Code != "23514" || pgErr.Message != "compat refresh failure" {
		t.Fatal("refresh did not reach expected SaveChunk failure", n, err)
	}
	compatCells(t, ctx, s, observer, original)
	var cleared, retained, foreign int
	compatOK(t, observer.QueryRow(ctx, `SELECT
 count(*) FILTER (WHERE server_id=7 AND x<102 AND occupier_player_id IS NULL AND gather_rate=0),
 count(*) FILTER (WHERE server_id=7 AND x>=102 AND occupier_player_id=91 AND gather_rate=4),
 count(*) FILTER (WHERE server_id=8 AND occupier_player_id=91 AND gather_rate=4)
 FROM resource_node_state`).Scan(&cleared, &retained, &foreign))
	if cleared != 2 || retained != 2 || foreign != 4 {
		t.Fatal("separate occupancy/shard boundary changed", cleared, retained, foreign)
	}
	compatExec(t, ctx, observer, "DROP TRIGGER compat_refresh_fault ON map_cell")
	n, err = NewService(s).RefreshWildResources(ctx, 7)
	compatOK(t, err)
	original[0].ResourceLevel, original[1].ResourceLevel = 2, 5
	compatCells(t, ctx, s, observer, original)
	other, found, err := s.LoadChunk(ctx, 8, 2, 3)
	compatOK(t, err)
	if n != 2 || !found || len(other) != 4 || other[0].ResourceLevel != 1 || other[1].ResourceLevel != 4 {
		t.Fatal("refresh changed another shard or wrong resource levels", n, other)
	}
}

// These are pgx callback counts, not wire round trips or implicit server commits.
type compatTrace struct{ queries, batches, statements, commits atomic.Int64 }

func (c *compatTrace) TraceQueryStart(ctx context.Context, _ *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	c.queries.Add(1)
	if strings.EqualFold(d.SQL, "commit") {
		c.commits.Add(1)
	}
	return ctx
}
func (*compatTrace) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}
func (c *compatTrace) TraceBatchStart(ctx context.Context, _ *pgx.Conn, _ pgx.TraceBatchStartData) context.Context {
	c.batches.Add(1)
	return ctx
}
func (c *compatTrace) TraceBatchQuery(context.Context, *pgx.Conn, pgx.TraceBatchQueryData) {
	c.statements.Add(1)
}
func (*compatTrace) TraceBatchEnd(context.Context, *pgx.Conn, pgx.TraceBatchEndData) {}

func BenchmarkPGChunkSave(b *testing.B) {
	for _, mode := range []string{"insert", "update"} {
		b.Run(mode, func(b *testing.B) {
			trace := &compatTrace{}
			ctx, s, observer := compatPG(b, trace)
			cells := GenerateChunk(7, 2, 3)
			// Warm the same writer, SQL cache and fixture in both source versions.
			compatOK(b, s.SaveChunk(ctx, 7, cells))
			trace.queries.Store(0)
			trace.batches.Store(0)
			trace.statements.Store(0)
			trace.commits.Store(0)
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				b.StopTimer()
				if mode == "insert" {
					compatExec(b, ctx, observer, "TRUNCATE map_cell")
				}
				b.StartTimer()
				err := s.SaveChunk(ctx, 7, cells)
				b.StopTimer()
				compatOK(b, err)
			}
			for name, n := range map[string]int64{"query_callbacks/op": trace.queries.Load(), "batch_callbacks/op": trace.batches.Load(), "batch_statements/op": trace.statements.Load(), "explicit_commit_callbacks/op": trace.commits.Load()} {
				b.ReportMetric(float64(n)/float64(b.N), name)
			}
			// Observer only: old LoadChunk ordering is intentionally not a benchmark gate.
			if !reflect.DeepEqual(compatObserved(b, ctx, observer), cells) {
				b.Fatal("benchmark committed a different image")
			}
		})
	}
}
