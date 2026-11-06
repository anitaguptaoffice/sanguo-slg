package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"os"
	"os/exec"
	"regexp"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/puddle/v2"
)

const recruitPanicChild = "SANGUO_RECRUIT_CLEANUP_PANIC_CHILD"
const recruitPanicOwned = "RECRUIT_CLEANUP_PANIC_OWNED "
const recruitPanicWitness = "RECRUIT_CLEANUP_PANIC_WITNESS "
const recruitPanicComplete = "primary-live-unknown-retained-server-ended-schema-dropped-closed-pool-blocked"

type recruitPanicBackend struct {
	PID   uint32
	Start time.Time
}

func (b recruitPanicBackend) valid() bool { return b.PID != 0 && !b.Start.IsZero() }
func (b recruitPanicBackend) same(other recruitPanicBackend) bool {
	return b.PID == other.PID && b.Start.Equal(other.Start)
}

type recruitPanicEvidence struct {
	Schema   string
	Original recruitPanicBackend
	Spares   []recruitPanicBackend
	Verified string
}

func recruitPanicEmit(prefix string, evidence recruitPanicEvidence) {
	encoded, err := json.Marshal(evidence)
	if err != nil {
		panic(err)
	}
	fmt.Printf("%s%s\n", prefix, encoded)
}

type recruitCleanupPanicTrace struct {
	*returnLifetimeTrace
	primary, cleanup       error
	pool                   *pgxpool.Pool
	conn, observer         *pgx.Conn
	evidence               recruitPanicEvidence
	acquires, primaryCalls int
	cleanupCalls, ends     int
	ownership              sync.Mutex
	connections            []*pgx.Conn
}

func (r *recruitCleanupPanicTrace) afterConnect(ctx context.Context, conn *pgx.Conn) error {
	r.ownership.Lock()
	defer r.ownership.Unlock()
	r.connections = append(r.connections, conn)
	if len(r.connections) == 1 {
		return nil // The initial identity is captured exactly once at BEGIN.
	}
	id := recruitPanicBackend{PID: conn.PgConn().PID()}
	if err := r.observer.QueryRow(ctx, "SELECT backend_start FROM pg_catalog.pg_stat_activity WHERE pid=$1", id.PID).Scan(&id.Start); err != nil {
		return err
	}
	if !id.valid() || !r.evidence.Original.valid() || id.same(r.evidence.Original) {
		return errors.New("invalid spare ownership")
	}
	r.evidence.Spares = append(r.evidence.Spares, id)
	recruitPanicEmit(recruitPanicOwned, r.evidence)
	return nil
}
func (r *recruitCleanupPanicTrace) TraceAcquireStart(ctx context.Context, pool *pgxpool.Pool, _ pgxpool.TraceAcquireStartData) context.Context {
	if r.pool == nil {
		r.pool = pool
	}
	r.acquires++
	return ctx
}
func (*recruitCleanupPanicTrace) TraceAcquireEnd(context.Context, *pgxpool.Pool, pgxpool.TraceAcquireEndData) {
}
func (r *recruitCleanupPanicTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	// Spare health Pings are pool probes, never participant SQL.
	if r.conn != nil && conn != r.conn {
		if data.SQL != "" {
			panic("unexpected spare SQL")
		}
		return ctx
	}
	ctx = r.returnLifetimeTrace.TraceQueryStart(ctx, conn, data)
	if strings.HasPrefix(data.SQL, "begin") {
		if r.conn != nil {
			panic("second BEGIN cannot replace owned identity")
		}
		r.conn = conn
		id := recruitPanicBackend{PID: conn.PgConn().PID()}
		if err := r.observer.QueryRow(ctx, "SELECT backend_start FROM pg_catalog.pg_stat_activity WHERE pid=$1", id.PID).Scan(&id.Start); err != nil {
			panic(err)
		}
		if !id.valid() || id.PID == r.observer.PgConn().PID() {
			panic("invalid initial ownership")
		}
		r.evidence.Original = id
		recruitPanicEmit(recruitPanicOwned, r.evidence)
	} else if data.SQL == "rollback" {
		r.cleanupCalls++
		panic(r.cleanup)
	} else if conn == r.conn {
		r.primaryCalls++
		panic(r.primary)
	}
	return ctx
}
func (r *recruitCleanupPanicTrace) TraceQueryEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryEndData) {
	if conn != r.conn {
		return
	}
	r.ends++
	r.returnLifetimeTrace.TraceQueryEnd(ctx, conn, data)
}

func recruitPanicAbsence(ctx context.Context, observer *pgx.Conn, id recruitPanicBackend) error {
	if !id.valid() {
		return errors.New("absence has no owned identity")
	}
	for {
		var count int
		if err := observer.QueryRow(ctx, "SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2", id.PID, id.Start).Scan(&count); err != nil {
			return err
		}
		if count == 0 {
			return nil
		}
		select {
		case <-time.After(10 * time.Millisecond):
		case <-ctx.Done():
			return fmt.Errorf("owned backend %v still exists: %w", id, ctx.Err())
		}
	}
}

func TestRecruitPanicAbsenceRejectsInvalidIdentity(t *testing.T) {
	for _, id := range []recruitPanicBackend{{}, {PID: 1}, {Start: time.Unix(1, 0)}} {
		// No observer exists: invalid ownership must fail before any database action.
		if recruitPanicAbsence(context.Background(), nil, id) == nil {
			t.Fatal("invalid identity accepted", id)
		}
	}
}

func TestPGRecruitGenerationConstructorCleanupPanic(t *testing.T) {
	if os.Getenv(recruitPanicChild) == "1" {
		recruitCleanupPanicChild(t)
		return
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned isolated PG17 and host psql required")
	}
	executable, err := os.Executable()
	returnPGOK(t, err)
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()
	// Only this compiled executable, exact case and existing race instrumentation.
	cmd := exec.CommandContext(ctx, executable, "-test.run=^TestPGRecruitGenerationConstructorCleanupPanic$", "-test.v", "-test.timeout=30s", "-test.paniconexit0=false")
	cmd.Env = append(os.Environ(), recruitPanicChild+"=1")
	cmd.WaitDelay = 2 * time.Second
	output, childErr := cmd.CombinedOutput()
	var evidence, owned recruitPanicEvidence
	witnesses, owners, malformed := 0, 0, false
	for _, line := range strings.Split(string(output), "\n") {
		if strings.HasPrefix(line, recruitPanicOwned) {
			var next recruitPanicEvidence
			bad := json.Unmarshal([]byte(strings.TrimPrefix(line, recruitPanicOwned)), &next) != nil
			bad = bad || !regexp.MustCompile(`^api_return_[0-9]+_"Q$`).MatchString(next.Schema) || next.Verified != ""
			if owners == 0 {
				bad = bad || next.Original != (recruitPanicBackend{}) || len(next.Spares) != 0
			} else {
				bad = bad || next.Schema != owned.Schema || !next.Original.valid()
				if owners > 1 {
					bad = bad || !next.Original.same(owned.Original) || len(next.Spares) != len(owned.Spares)+1
				} else {
					bad = bad || len(next.Spares) != 0
				}
				for i, id := range next.Spares {
					bad = bad || !id.valid() || id.same(next.Original)
					for _, earlier := range next.Spares[:i] {
						bad = bad || id.same(earlier)
					}
					if i < len(owned.Spares) {
						bad = bad || !id.same(owned.Spares[i])
					}
				}
			}
			malformed = malformed || bad
			if !malformed {
				owned = next
			}
			owners++
		}
		if strings.HasPrefix(line, recruitPanicWitness) {
			witnesses++
			malformed = malformed || json.Unmarshal([]byte(strings.TrimPrefix(line, recruitPanicWitness)), &evidence) != nil
		}
	}
	// Do not invent cleanup targets after missing, malformed or conflicting ownership.
	returnLifetimeCheck(t, !malformed && owners >= 2 && owned.Original.valid() && cmd.ProcessState != nil, "child ownership incomplete; cleanup unverified", childErr, string(output))
	clean, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()
	observer, err := pgx.Connect(clean, dsn)
	returnLifetimeCheck(t, err == nil, "owned cleanup unverified: observer connection failed", err, childErr)
	defer func() { returnPGOK(t, observer.Close(clean)) }()
	complete := witnesses == 1 && evidence.Schema == owned.Schema && evidence.Original.same(owned.Original) &&
		slices.EqualFunc(evidence.Spares, owned.Spares, recruitPanicBackend.same) && len(evidence.Spares) > 0 && evidence.Verified == recruitPanicComplete
	failed := childErr != nil || ctx.Err() != nil || !complete || strings.Contains(string(output), "WARNING: DATA RACE") ||
		strings.Contains(string(output), "--- FAIL:") || strings.Contains(string(output), "--- SKIP:")
	// CombinedOutput has reaped this child (including signal exit). Observe only;
	// never signal historical PIDs, even after a backend_start predicate matches.
	for _, id := range append([]recruitPanicBackend{owned.Original}, owned.Spares...) {
		if err := recruitPanicAbsence(clean, observer, id); err != nil {
			t.Fatalf("owned cleanup unverified; schema not cleaned: %v; child=%v\n%s", err, childErr, output)
		}
	}
	if failed {
		_, err := observer.Exec(clean, "DROP SCHEMA IF EXISTS "+pgx.Identifier{owned.Schema}.Sanitize()+" CASCADE")
		returnLifetimeCheck(t, err == nil, "owned schema cleanup unverified after backend absence", err, childErr)
	}
	var schemas int
	err = observer.QueryRow(clean, "SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname=$1", owned.Schema).Scan(&schemas)
	returnLifetimeCheck(t, err == nil && schemas == 0, "owned schema absence unverified", err, schemas)
	if failed {
		t.Fatalf("panic child failed: %v / %v; complete=%v; emitted backend/schema absence verified\n%s", childErr, ctx.Err(), complete, output)
	}
	t.Log("verified primary/live/unknown/retained slot, actual pool closing and isolated teardown; not graceful drain")
}

func recruitCleanupPanicChild(t *testing.T) {
	trace := &recruitCleanupPanicTrace{returnLifetimeTrace: returnLifetimeTracer(""),
		primary: errors.New("Recruit primary constructor panic"), cleanup: errors.New("Recruit cleanup rollback panic")}
	trace.release() // Empty SQL from an incidental pool Ping must not block the trace gate.
	observer, binding, profile := recruitPGFixture(t, &trace.returnPGTrace, func(cfg *pgxpool.Config) {
		cfg.MaxConns, cfg.MinConns, cfg.MinIdleConns = 2, 0, 0
		cfg.MaxConnLifetime, cfg.MaxConnIdleTime, cfg.HealthCheckPeriod = time.Hour, time.Hour, time.Hour
		cfg.ConnConfig.Tracer, cfg.AfterConnect = trace, trace.afterConnect
	})
	trace.observer, trace.evidence.Schema = observer, profile.SchemaName
	recruitPanicEmit(recruitPanicOwned, trace.evidence)
	ctx := returnPGContext(t)
	before := returnPGSnapshot(t, ctx, observer, profile)
	g, err := newRecruitGeneration(binding, profile, returnPGCatalog(t))
	returnPGOK(t, err)
	var fault any
	func() {
		defer func() { fault = recover() }()
		err = g.initialize(ctx)
	}()
	returnLifetimeCheck(t, fault == trace.primary && err == nil, "primary panic identity replaced", fault, err)
	returnLifetimeCheck(t, trace.acquires == 1 && trace.primaryCalls == 1 && trace.cleanupCalls == 1 && trace.ends == 1,
		"actual query start/end counts changed", trace.acquires, trace.primaryCalls, trace.cleanupCalls, trace.ends)
	queries := trace.events()
	returnLifetimeCheck(t, len(queries) == 3 && recruitPGSQLKind(queries[0].sql, profile) == 1 && queries[0].err == nil &&
		recruitPGSQLKind(queries[1].sql, profile) == 4 && queries[2].sql == "rollback", "unexpected panic SQL")
	trace.guard.Lock()
	bounded := trace.bounded
	trace.guard.Unlock()
	returnLifetimeCheck(t, bounded && g.s.phase == "account constructor" && g.s.cause != nil, "panic phase/cleanup bound lost")
	returnLifetimeCheck(t, strings.Contains(g.s.cause.Error(), "panic at account constructor: "+trace.primary.Error()) &&
		strings.Contains(g.s.cause.Error(), "recruit validation cleanup panic: "+trace.cleanup.Error()), "primary/cleanup diagnostics lost", g.s.cause)
	recruitLifetimeClosed(t, g, trace.returnLifetimeTrace, 1)
	returnLifetimeCheck(t, trace.acquires == 1, "closed initializer acquired again")
	id := trace.evidence.Original // Never resample or replace this identity.
	returnLifetimeCheck(t, id.valid() && trace.conn != nil && id.PID == trace.conn.PgConn().PID() &&
		queries[0].pid == id.PID && queries[1].pid == id.PID && queries[2].pid == id.PID, "not original owned backend")
	var live bool
	var state string
	returnPGOK(t, observer.QueryRow(ctx, "SELECT xact_start IS NOT NULL,state FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2", id.PID, id.Start).Scan(&live, &state))
	returnLifetimeCheck(t, live && state == "idle in transaction" && trace.conn.PgConn().TxStatus() == 'T', "cleanup panic did not leave live transaction", live, state)
	returnLifetimeCheck(t, trace.pool.Stat().AcquiredConns() == 1, "cleanup panic did not retain pool slot")
	returnLifetimeCheck(t, maps.Equal(before, returnPGSnapshot(t, ctx, observer, profile)), "panic changed fixture before teardown")
	// Prewarm the second slot. Every successful probe is immediately released.
	spare, err := trace.pool.Acquire(ctx)
	returnPGOK(t, err)
	spare.Release()
	returnLifetimeCheck(t, trace.pool.Stat().AcquiredConns() == 1 && trace.pool.Stat().IdleConns() == 1, "spare capacity not available")
	clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	// Close the held transport, never a remote backend selected by historical PID.
	returnPGOK(t, trace.conn.Close(clean))
	select {
	case <-trace.conn.PgConn().CleanupDone():
	case <-clean.Done():
		t.Fatal("original CleanupDone exceeded bound")
	}
	returnPGOK(t, recruitPanicAbsence(clean, observer, id))
	recruitPGReleased(t, ctx, observer, profile)
	returnLifetimeCheck(t, maps.Equal(before, returnPGSnapshot(t, ctx, observer, profile)), "teardown changed fixture rows/allocators")
	recruitLifetimeClosed(t, g, trace.returnLifetimeTrace, 1)
	returnLifetimeCheck(t, trace.acquires == 2 && trace.pool.Stat().AcquiredConns() == 1, "raw Close released slot or initialization retried")
	closed := make(chan struct{})
	go func() { trace.pool.Close(); close(closed) }()
	probe, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for {
		conn, err := trace.pool.Acquire(probe)
		if err == puddle.ErrClosedPool {
			break // Only this exact public result proves Close entered closed state.
		}
		returnPGOK(t, err)
		conn.Release()
	}
	trace.ownership.Lock()
	connections := append([]*pgx.Conn(nil), trace.connections...)
	evidence := trace.evidence
	trace.ownership.Unlock()
	returnLifetimeCheck(t, len(connections) == len(evidence.Spares)+1 && len(connections) >= 2 && connections[0] == trace.conn, "unidentified pool connection")
	for _, conn := range connections {
		// Pool owns spare destruction. Never race it with another raw Close.
		select {
		case <-conn.PgConn().CleanupDone():
		case <-probe.Done():
			t.Fatal("pool connection CleanupDone exceeded bound")
		}
	}
	for _, spareID := range evidence.Spares {
		returnPGOK(t, recruitPanicAbsence(probe, observer, spareID))
	}
	returnLifetimeCheck(t, trace.pool.Stat().AcquiredConns() == 1 && trace.pool.Stat().TotalConns() == 1, "closed pool lost retained wrapper")
	select {
	case <-closed:
		t.Fatal("pool.Close unexpectedly drained retained wrapper")
	default:
	}
	acquires := trace.acquires
	recruitLifetimeClosed(t, g, trace.returnLifetimeTrace, 1)
	returnLifetimeCheck(t, trace.acquires == acquires, "closed initializer attempted pool reacquisition")
	returnPGExec(t, ctx, observer, "DROP SCHEMA "+pgx.Identifier{profile.SchemaName}.Sanitize()+" CASCADE")
	returnPGOK(t, observer.Close(ctx))
	returnLifetimeCheck(t, !t.Failed(), "child has prior test failures")
	evidence.Verified = recruitPanicComplete
	recruitPanicEmit(recruitPanicWitness, evidence)
	// Dedicated-process disposal only, not graceful pool drain or unknown recovery.
	// Parent requires this complete witness, clean exit and independent absence.
	os.Exit(0)
}
