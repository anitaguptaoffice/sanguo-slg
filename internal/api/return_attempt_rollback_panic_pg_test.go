package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
)

type returnRollbackPanicTrace struct {
	returnPGTrace
	armed, bounded   bool
	primary, cleanup error
	pid              uint32
}

func (r *returnRollbackPanicTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnPGTrace.TraceQueryStart(ctx, conn, data)
	if !r.armed {
		return ctx
	}
	sql := strings.ToLower(strings.TrimSpace(data.SQL))
	if sql == "rollback" {
		deadline, ok := ctx.Deadline()
		r.bounded = ok && ctx.Err() == nil && time.Until(deadline) > 0 && time.Until(deadline) <= 5*time.Second
		r.pid = conn.PgConn().PID()
		panic(r.cleanup)
	}
	if r.primary != nil && sql == "select pg_catalog.clock_timestamp()" {
		panic(r.primary)
	}
	return ctx
}

const returnRollbackChild = "SANGUO_RETURN_ROLLBACK_PANIC_CHILD"
const returnRollbackSchema = "RETURN_ROLLBACK_SCHEMA "

func TestPGReturnAttemptRollbackPanic(t *testing.T) {
	if mode := os.Getenv(returnRollbackChild); mode != "" {
		returnRollbackPanicChild(t, mode == "original_panic")
		return
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned PG17 required")
	}
	binary, err := os.Executable()
	returnPGOK(t, err)
	for _, mode := range []string{"capacity_failure", "original_panic"} {
		t.Run(mode, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, binary, "-test.run=^TestPGReturnAttemptRollbackPanic$", "-test.timeout=35s")
			cmd.Env = append(os.Environ(), returnRollbackChild+"="+mode)
			cmd.WaitDelay = time.Second
			out, childErr := cmd.CombinedOutput()
			var schemas []string
			for _, line := range strings.Split(string(out), "\n") {
				if strings.HasPrefix(line, returnRollbackSchema) {
					var schema string
					if json.Unmarshal([]byte(strings.TrimPrefix(line, returnRollbackSchema)), &schema) != nil || !strings.HasPrefix(schema, "api_return_") {
						t.Fatalf("invalid owned schema evidence: %s", out)
					}
					schemas = append(schemas, schema)
				}
			}
			// The exact fixture schema is emitted before faults arm; the child is reaped.
			clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
			defer stop()
			admin, err := pgx.Connect(clean, dsn)
			returnPGOK(t, err)
			defer func() { returnPGOK(t, admin.Close(clean)) }()
			for _, schema := range schemas {
				_, err := admin.Exec(clean, "DROP SCHEMA IF EXISTS "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
				returnPGOK(t, err)
			}
			if childErr != nil || ctx.Err() != nil || len(schemas) != 1 || strings.Count(string(out), "RETURN_ROLLBACK_PASSED\n") != 1 || strings.Contains(string(out), "WARNING: DATA RACE") {
				t.Fatalf("rollback child failed: %v / %v\n%s", childErr, ctx.Err(), out)
			}
		})
	}
}

func returnRollbackPanicChild(t *testing.T, double bool) {
	trace := &returnRollbackPanicTrace{cleanup: errors.New("APP rollback panic")}
	var owned returnBackendSet
	f := newReturnAttemptPG(t, trace, owned.configure)

	// A Goexit/fatal/panic must exit before T cleanup can wait on a quarantined slot.
	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "rollback child panic: %v\n", r)
		}
		os.Exit(1)
	}()
	schema, err := json.Marshal(f.profile.SchemaName)
	returnPGOK(t, err)
	fmt.Println(returnRollbackSchema + string(schema))
	if double {
		trace.primary = errors.New("original military call panic")
	} else {
		returnPGExec(t, f.ctx, f.observer, "UPDATE city_troop SET count=2147483647")
	}
	before := snapshotReturnAttemptPG(t, f, false)
	trace.armed = true
	var caught any
	func() {
		defer func() { caught = recover() }()
		f.generation.complete(f.ctx, f.candidate)
	}()
	want := trace.cleanup
	if double {
		want = trace.primary
	}
	returnLifetimeCheck(t, caught == want && trace.bounded, "panic priority or independent rollback deadline lost", caught)
	records := returnAttemptLifetimeRecords(t, f, 1)
	a := records[f.candidate]
	returnLifetimeCheck(t, a != nil && a.phase == "military complete" && a.cleanupFault == trace.cleanup,
		"original attempt or cleanup fault lost")
	if double {
		returnLifetimeCheck(t, a.fault == trace.primary && strings.Contains(a.result.cause.Error(), trace.primary.Error()), "primary panic lost")
	} else {
		returnLifetimeCheck(t, a.fault == nil && errors.Is(a.result.cause, march.ErrReturnUnavailable), "capacity cause lost")
	}
	returnLifetimeCheck(t, a.result.outcome == returnUnknown && a.result.confirmed == (march.ReturnObservation{}) &&
		a.result.cleanup != nil && strings.Contains(a.result.cleanup.Error(), trace.cleanup.Error()) && a.result.diagnostic == nil,
		"rollback panic became known-ended or confirmed", a.result)
	returnLifetimeState(t, f.generation, 1, true, false)
	backend := owned.get(trace.pid)
	returnLifetimeCheck(t, backend != nil && trace.pid != f.observer.PgConn().PID(), "rollback backend not owned")
	var active bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz AND xact_start IS NOT NULL)", trace.pid, backend.started).Scan(&active))
	returnLifetimeCheck(t, active, "test did not leave a real transaction after rollback panic")
	returnLifetimeCheck(t, reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)), "panic published writes")
	result := a.result
	returnPGOK(t, backend.close())
	clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	owned.noLocks(t, clean, f.observer, trace.pid, f.profile.SchemaOID)
	returnPGReleased(t, f.ctx, f.observer, f.profile)
	returnLifetimeCheck(t, f.pool.Stat().AcquiredConns() == 1 && reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)), "physical cleanup changed data or silently cleared quarantined slot")
	returnPGOK(t, f.generation.close())
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	returnLifetimeCheck(t, errors.Is(f.generation.s.admission.waitDrained(ctx), context.DeadlineExceeded), "physical cleanup cleared unknown lease")
	returnLifetimeCheck(t, returnAttemptLifetimeRecords(t, f, 1)[f.candidate] == a && reflect.DeepEqual(a.result, result), "unknown record changed after cleanup")
	fmt.Println("RETURN_ROLLBACK_PASSED")
	os.Exit(0) // The parent reaps this isolated process and drops its exact schema.
}
