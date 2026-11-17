package world

import (
	"context"
	"crypto/rand"
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

// Only the ordering test reads this trace, after its synchronous LoadChunk.
type chunkQueryTrace struct {
	sql  string
	args []any
}

func (q *chunkQueryTrace) TraceQueryStart(ctx context.Context, _ *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	if strings.Contains(d.SQL, "SELECT x,y,terrain,COALESCE(resource_type,0)") {
		q.sql, q.args = d.SQL, append([]any(nil), d.Args...)
	}
	return ctx
}
func (*chunkQueryTrace) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

func chunkPersistencePG(t *testing.T) (context.Context, *pgxpool.Pool, *pgx.Conn) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; owned PostgreSQL 17 test database required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancel)
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = admin.Close(context.Background()) })
	var nonce [12]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		t.Fatal(err)
	}
	schema := pgx.Identifier{fmt.Sprintf("world_chunk_%x", nonce)}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		if _, err := admin.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	})
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 1
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	// Supported planner controls force real heap order, not a mocked result.
	for k, v := range map[string]string{"enable_seqscan": "on", "enable_indexscan": "off", "enable_indexonlyscan": "off", "enable_bitmapscan": "off", "max_parallel_workers_per_gather": "0", "synchronize_seqscans": "off", "statement_timeout": "20000"} {
		cfg.ConnConfig.RuntimeParams[k] = v
	}
	observer, err := pgx.ConnectConfig(ctx, cfg.ConnConfig.Copy())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = observer.Close(context.Background()) })
	cfg.ConnConfig.Tracer = &chunkQueryTrace{}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	ddl, err := os.ReadFile("../../spec/db/002_world.sql")
	if err != nil {
		t.Fatal(err)
	}
	chunkSQL(t, ctx, observer, string(ddl))
	var version int
	if err := observer.QueryRow(ctx, "SELECT current_setting('server_version_num')::int").Scan(&version); err != nil || version/10000 != 17 {
		t.Fatal("PostgreSQL 17 required", version, err)
	}
	var writerPID, observerPID int
	if err := pool.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&writerPID); err != nil {
		t.Fatal(err)
	}
	if err := observer.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&observerPID); err != nil || writerPID == observerPID {
		t.Fatal("independent observer required", writerPID, observerPID, err)
	}
	t.Logf("PG=%d writer=%d observer=%d schema=%s", version, writerPID, observerPID, schema)
	return ctx, pool, observer
}

func chunkSQL(t *testing.T, ctx context.Context, conn *pgx.Conn, sql string) {
	t.Helper()
	if _, err := conn.Exec(ctx, sql); err != nil {
		t.Fatal(err)
	}
}

func chunkCount(t *testing.T, ctx context.Context, observer *pgx.Conn) int {
	t.Helper()
	var n int
	if err := observer.QueryRow(ctx, "SELECT count(*) FROM map_cell").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestPGChunkSaveFailureAtomicRestart(t *testing.T) {
	ctx, pool, observer := chunkPersistencePG(t)
	cells := GenerateChunk(7, 0, 0)
	chunkSQL(t, ctx, observer, `CREATE FUNCTION chunk_fault() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF NEW.x=0 AND NEW.y=25 THEN RAISE EXCEPTION 'chunk witness failure' USING ERRCODE='P0001'; END IF;
 RETURN NEW; END $$;
 CREATE TRIGGER chunk_fault BEFORE INSERT ON map_cell FOR EACH ROW EXECUTE FUNCTION chunk_fault()`)
	err := NewPGStore(pool).SaveChunk(ctx, 7, cells)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "P0001" || pgErr.Message != "chunk witness failure" {
		t.Fatal("did not reach real mid-save failure", err)
	}
	committed := chunkCount(t, ctx, observer)
	retained, found, err := NewPGStore(pool).LoadChunk(ctx, 7, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	chunkSQL(t, ctx, observer, "DROP TRIGGER chunk_fault ON map_cell")
	// A fresh Loader has no cache and takes the actual restart/missing path.
	restarted, err := NewLoader(NewPGStore(pool), 1).Cells(ctx, 7, 0, 0)
	if err != nil {
		t.Fatal("restart", err)
	}
	t.Logf("after failure: committed=%d loaded=%d found=%t; fresh Loader=%d", committed, len(retained), found, len(restarted))
	if committed != 0 || found || len(retained) != 0 {
		t.Errorf("partial save persisted: committed=%d loaded=%d found=%t", committed, len(retained), found)
	}
	if len(restarted) != len(cells) {
		t.Errorf("restart reused partial chunk: got=%d want=%d", len(restarted), len(cells))
	}
}

func TestPGChunkSaveCancellationAtomic(t *testing.T) {
	ctx, pool, observer := chunkPersistencePG(t)
	var writerPID, blockerPID int
	if err := pool.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&writerPID); err != nil {
		t.Fatal(err)
	}
	if err := observer.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&blockerPID); err != nil {
		t.Fatal(err)
	}
	blocker, err := observer.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	saveCtx, cancel := context.WithCancel(ctx)
	done := make(chan error, 1)
	started, joined := false, false
	defer func() {
		cancel()
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		_ = blocker.Rollback(cleanup)
		if started && !joined {
			select {
			case <-done:
			case <-cleanup.Done():
				t.Error("owned SaveChunk did not stop after cancellation and blocker release")
			}
		}
	}()
	if _, err := blocker.Exec(ctx, "SELECT pg_advisory_xact_lock(1128812107,$1::integer)", blockerPID); err != nil {
		t.Fatal(err)
	}
	// Create outside the blocker transaction so the writer sees the trigger.
	if _, err := pool.Exec(ctx, fmt.Sprintf(`CREATE FUNCTION chunk_wait() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF NEW.x=0 AND NEW.y=25 THEN PERFORM pg_advisory_xact_lock(1128812107,%d); END IF;
 RETURN NEW; END $$;
 CREATE TRIGGER chunk_wait BEFORE INSERT ON map_cell FOR EACH ROW EXECUTE FUNCTION chunk_wait()`, blockerPID)); err != nil {
		t.Fatal(err)
	}
	started = true
	go func() { done <- NewPGStore(pool).SaveChunk(saveCtx, 7, GenerateChunk(7, 0, 0)) }()
	deadline, stop := context.WithTimeout(ctx, 10*time.Second)
	defer stop()
	for {
		var waiting bool
		if err := observer.QueryRow(deadline, "SELECT $1::integer=ANY(pg_blocking_pids($2))", blockerPID, writerPID).Scan(&waiting); err != nil {
			t.Fatal("observe actual mid-save wait", err)
		}
		if waiting {
			break
		}
		select {
		case err := <-done:
			joined = true
			t.Fatal("SaveChunk ended before observed wait", err)
		case <-deadline.Done():
			t.Fatal("no actual mid-save wait", deadline.Err())
		case <-time.After(time.Millisecond):
		}
	}
	visibleWhileBlocked := chunkCount(t, ctx, observer)
	cancel()
	select {
	case err = <-done:
		joined = true
	case <-deadline.Done():
		t.Fatal("canceled SaveChunk did not return", deadline.Err())
	}
	if !errors.Is(err, context.Canceled) {
		t.Fatal("expected canceled SaveChunk", err)
	}
	if err := blocker.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	// A canceled client call can finish before PostgreSQL notices disconnect.
	// Release the blocker first, then observe transaction end on fresh snapshots.
	endedCtx, endStop := context.WithTimeout(ctx, 25*time.Second)
	defer endStop()
	for {
		var ended bool
		if err := observer.QueryRow(endedCtx, `SELECT NOT EXISTS (
 SELECT FROM pg_stat_activity WHERE pid=$1 AND (state IS DISTINCT FROM 'idle' OR xact_start IS NOT NULL))`, writerPID).Scan(&ended); err != nil {
			t.Fatal("observe writer transaction end", err)
		}
		if ended {
			break
		}
		select {
		case <-endedCtx.Done():
			t.Fatal("writer transaction remained active", endedCtx.Err())
		case <-time.After(time.Millisecond):
		}
	}
	committed := chunkCount(t, ctx, observer)
	chunkSQL(t, ctx, observer, "DROP TRIGGER chunk_wait ON map_cell")
	restarted, err := NewLoader(NewPGStore(pool), 1).Cells(ctx, 7, 0, 0)
	if err != nil {
		t.Fatal("restart after cancellation", err)
	}
	t.Logf("observed writer %d blocked by %d; visible=%d after cancel=%d fresh Loader=%d", writerPID, blockerPID, visibleWhileBlocked, committed, len(restarted))
	if visibleWhileBlocked != 0 || committed != 0 {
		t.Errorf("partial canceled save: visible=%d committed=%d", visibleWhileBlocked, committed)
	}
	if len(restarted) != ChunkSize*ChunkSize {
		t.Errorf("restart reused canceled partial chunk: got=%d", len(restarted))
	}
}

func TestPGChunkLoadCanonicalHeapOrder(t *testing.T) {
	ctx, pool, observer := chunkPersistencePG(t)
	want := GenerateChunk(7, 2, 3)
	rows := make([][]any, 0, len(want))
	for i := len(want) - 1; i >= 0; i-- {
		c := want[i]
		var resource any
		if c.ResourceType != 0 {
			resource = c.ResourceType
		}
		rows = append(rows, []any{int32(7), c.X, c.Y, int16(c.Terrain), resource, c.ResourceLevel})
	}
	if n, err := observer.CopyFrom(ctx, pgx.Identifier{"map_cell"}, []string{"server_id", "x", "y", "terrain", "resource_type", "resource_level"}, pgx.CopyFromRows(rows)); err != nil || n != int64(len(want)) {
		t.Fatal("reverse heap fixture", n, err)
	}
	got, found, err := NewPGStore(pool).LoadChunk(ctx, 7, 2, 3)
	if err != nil || !found || len(got) != len(want) {
		t.Fatal("actual LoadChunk", len(got), found, err)
	}
	trace := pool.Config().ConnConfig.Tracer.(*chunkQueryTrace)
	if trace.sql == "" {
		t.Fatal("actual LoadChunk SQL was not observed")
	}
	plan, err := observer.Query(ctx, "EXPLAIN "+trace.sql, trace.args...)
	if err != nil {
		t.Fatal(err)
	}
	var lines []string
	for plan.Next() {
		var line string
		if err := plan.Scan(&line); err != nil {
			plan.Close()
			t.Fatal(err)
		}
		lines = append(lines, line)
	}
	plan.Close()
	if err := plan.Err(); err != nil || !strings.Contains(strings.Join(lines, "\n"), "Seq Scan") {
		t.Fatal("real sequential plan required", lines, err)
	}
	t.Logf("actual query plan: %s; first coordinate=(%d,%d)", strings.Join(lines, " | "), got[0].X, got[0].Y)
	for i, expected := range want {
		if got[i] != expected {
			t.Errorf("noncanonical row %d: got=%+v want=%+v", i, got[i], expected)
			break
		}
	}
	cell, ok := cellAt(got, want[0].X, want[0].Y)
	if !ok || cell != want[0] {
		t.Errorf("cellAt selected wrong cell: got=%+v want=%+v ok=%t", cell, want[0], ok)
	}
}
