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

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type recruitAdmissionPanicTrace struct {
	returnPGTrace
	profile          freshsource.Profile
	mode             string
	armed, bounded   bool
	primary, cleanup error
	pid              uint32
}

func (r *recruitAdmissionPanicTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnPGTrace.TraceQueryStart(ctx, conn, data)
	if !r.armed {
		return ctx
	}
	if data.SQL == "begin isolation level read committed" {
		r.pid = conn.PgConn().PID()
	}
	if data.SQL == "rollback" {
		deadline, ok := ctx.Deadline()
		r.bounded = ok && ctx.Err() == nil && time.Until(deadline) > 0 && time.Until(deadline) <= 5*time.Second
		if strings.HasSuffix(r.mode, "_rollback") {
			panic(r.cleanup)
		}
	}
	stage, _ := recruitAttemptPGStage(data.SQL, r.profile)
	if r.mode == "original_rollback" && stage == "job" || r.mode == "commit_start" && data.SQL == "commit" {
		panic(r.primary)
	}
	return ctx
}

func (r *recruitAdmissionPanicTrace) TraceQueryEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryEndData) {
	r.returnPGTrace.TraceQueryEnd(ctx, conn, data)
	if r.armed && r.mode == "commit_end" && data.Err == nil && data.CommandTag.String() == "COMMIT" && r.events()[ctx.Value(returnPGTraceKey{}).(int)].sql == "commit" {
		panic(r.primary)
	}
}

const recruitAdmissionPanicChildEnv = "SANGUO_RECRUIT_ADMISSION_PANIC_CHILD"
const recruitAdmissionPanicSchema = "RECRUIT_ADMISSION_PANIC_SCHEMA "

func TestPGRecruitAdmissionPanic(t *testing.T) {
	if mode := os.Getenv(recruitAdmissionPanicChildEnv); mode != "" {
		recruitAdmissionPanicChild(t, mode)
		return
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned PG17 required")
	}
	binary, err := os.Executable()
	returnPGOK(t, err)
	for _, mode := range []string{"business_rollback", "original_rollback", "commit_start", "commit_end"} {
		t.Run(mode, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, binary, "-test.run=^TestPGRecruitAdmissionPanic$", "-test.timeout=35s")
			cmd.Env = append(os.Environ(), recruitAdmissionPanicChildEnv+"="+mode)
			cmd.WaitDelay = time.Second
			out, childErr := cmd.CombinedOutput()
			var schemas []string
			for _, line := range strings.Split(string(out), "\n") {
				if strings.HasPrefix(line, recruitAdmissionPanicSchema) {
					var schema string
					if json.Unmarshal([]byte(strings.TrimPrefix(line, recruitAdmissionPanicSchema)), &schema) != nil || !strings.HasPrefix(schema, "api_return_") {
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
			if childErr != nil || ctx.Err() != nil || len(schemas) != 1 || strings.Count(string(out), "RECRUIT_ADMISSION_PANIC_PASSED\n") != 1 || strings.Contains(string(out), "WARNING: DATA RACE") {
				t.Fatalf("rollback child failed: %v / %v\n%s", childErr, ctx.Err(), out)
			}
		})
	}
}

func recruitAdmissionPanicChild(t *testing.T, mode string) {
	trace := &recruitAdmissionPanicTrace{mode: mode, primary: errors.New("original admission panic"), cleanup: errors.New("admission rollback panic")}
	var owned returnBackendSet
	observer, binding, profile := recruitPGFixture(t, &trace.returnPGTrace, func(cfg *pgxpool.Config) { cfg.ConnConfig.Tracer = trace; owned.configure(cfg) })
	// After fixture creation, never enter inherited cleanup on a quarantined slot.
	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "admission child panic: %v\n", r)
		}
		os.Exit(1)
	}()
	schema, err := json.Marshal(profile.SchemaName)
	returnPGOK(t, err)
	fmt.Println(recruitAdmissionPanicSchema + string(schema))
	ctx := returnPGContext(t)
	returnPGExec(t, ctx, observer, "SELECT setval('work_queue_id_seq',100,false)")
	g, err := newRecruitGeneration(binding, profile, recruitAttemptPGCatalog(t))
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(ctx))
	scope := march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{9}}
	intent := march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 3, Count: 2}
	if mode == "business_rollback" {
		returnPGExec(t, ctx, observer, "UPDATE player_wallet SET food=11")
	}
	before := returnPGSnapshot(t, ctx, observer, profile)
	trace.profile, trace.armed = profile, true
	var caught any
	func() { defer func() { caught = recover() }(); g.admit(ctx, 1, scope, intent) }()
	want := trace.primary
	if mode == "business_rollback" {
		want = trace.cleanup
	}
	returnLifetimeCheck(t, caught == want && trace.bounded, "panic priority or rollback context lost", caught)
	g.s.mu.Lock()
	var a *recruitAttempt
	count := len(g.s.attempts)
	for attempt := range g.s.attempts {
		a = attempt
	}
	g.s.mu.Unlock()
	returnLifetimeCheck(t, count == 1 && a != nil && a.generation == g.s && a.accountID == 1 && a.scope == scope && a.intent == intent, "original admission identity lost")
	double := strings.HasSuffix(mode, "_rollback")
	phase, queue := "commit", int64(100)
	if mode == "business_rollback" {
		phase, queue = "debit", 0
	} else if mode == "original_rollback" {
		phase, queue = "write", 0
	}
	returnLifetimeCheck(t, a.phase == phase && a.queueID == queue && a.result.outcome == recruitUnknown && a.result.confirmed == (march.RecruitAcceptance{}) && a.result.diagnostic == nil, "admission result or known queue changed", a.result)
	if mode == "business_rollback" {
		returnLifetimeCheck(t, a.fault == nil && a.result.cause == domestic.ErrRecruitWalletFunds, "business cause lost")
	} else {
		returnLifetimeCheck(t, a.fault == trace.primary && a.result.cause != nil && strings.Contains(a.result.cause.Error(), trace.primary.Error()), "primary panic lost")
	}
	if double {
		returnLifetimeCheck(t, a.cleanupFault == trace.cleanup && a.result.cleanup != nil && strings.Contains(a.result.cleanup.Error(), trace.cleanup.Error()), "cleanup panic lost")
	} else {
		returnLifetimeCheck(t, a.cleanupFault == nil && errors.Is(a.result.cleanup, recruittx.ErrInactive), "commit cleanup changed unknown")
	}
	recruitLifetimeState(t, g, 1, true, false)
	backend := owned.get(trace.pid)
	returnLifetimeCheck(t, backend != nil && trace.pid != observer.PgConn().PID(), "missing original transport")
	var active bool
	returnPGOK(t, observer.QueryRow(ctx, "SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz AND xact_start IS NOT NULL)", trace.pid, backend.started).Scan(&active))
	returnLifetimeCheck(t, active == double, "unexpected transaction lifetime", active)
	committed := mode == "commit_end"
	recruitSerialChanges(t, before, returnPGSnapshot(t, ctx, observer, profile), committed)
	if committed {
		accepted := recruitAttemptPGObserved(t, ctx, observer)
		returnLifetimeCheck(t, accepted.QueueID == 100, "durable acceptance absent")
	}
	result := a.result
	returnPGOK(t, backend.close())
	clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	owned.noLocks(t, clean, observer, trace.pid, profile.SchemaOID)
	recruitPGReleased(t, ctx, observer, profile)
	recruitSerialChanges(t, before, returnPGSnapshot(t, ctx, observer, profile), committed)
	returnPGOK(t, g.close())
	drain, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	returnLifetimeCheck(t, errors.Is(g.s.admission.waitDrained(drain), context.DeadlineExceeded), "unknown drained after physical cleanup")
	g.s.mu.Lock()
	_, retained := g.s.attempts[a]
	unchanged := len(g.s.attempts) == 1 && retained && reflect.DeepEqual(a.result, result)
	g.s.mu.Unlock()
	returnLifetimeCheck(t, unchanged, "original unknown record changed")
	fmt.Println("RECRUIT_ADMISSION_PANIC_PASSED")
	os.Exit(0)
}
