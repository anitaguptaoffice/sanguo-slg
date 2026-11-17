package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"os"
	"os/exec"
	"reflect"
	"strings"
	"testing"
	"time"
)

type recruitCompletionTerminalTrace struct {
	*recruitPromotionTrace
	mode                             string
	armed, bounded, inspected        bool
	pid                              uint32
	primary, cleanup, observationErr error
	observe                          func(context.Context, *pgx.Conn) error
}

func (r *recruitCompletionTerminalTrace) TraceQueryStart(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	ctx = r.recruitPromotionTrace.TraceQueryStart(ctx, c, d)
	if !r.armed {
		return ctx
	}
	if d.SQL == "begin isolation level read committed" {
		r.pid = c.PgConn().PID()
	}
	if d.SQL == "rollback" {
		deadline, ok := ctx.Deadline()
		r.bounded = ok && ctx.Err() == nil && time.Until(deadline) > 0 && time.Until(deadline) <= 5*time.Second
		if r.mode == "partial_rollback" {
			panic(r.cleanup)
		}
	}
	selected := r.mode == "partial_rollback" && d.SQL == r.promotion || r.mode != "partial_rollback" && d.SQL == "commit"
	if selected && !r.inspected {
		r.inspected = true
		r.observationErr = r.observe(ctx, c)
		if r.mode == "partial_rollback" || r.mode == "commit_start" {
			panic(r.primary)
		}
	}
	return ctx
}
func (r *recruitCompletionTerminalTrace) TraceQueryEnd(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryEndData) {
	r.recruitPromotionTrace.TraceQueryEnd(ctx, c, d)
	if r.armed && r.mode == "commit_end" && d.Err == nil && d.CommandTag.String() == "COMMIT" && r.events()[ctx.Value(returnPGTraceKey{}).(int)].sql == "commit" {
		panic(r.primary)
	}
}

const recruitCompletionTerminalChildEnv = "SANGUO_RECRUIT_COMPLETION_TERMINAL_CHILD"
const recruitCompletionTerminalSchema = "RECRUIT_COMPLETION_TERMINAL_SCHEMA "

func TestPGRecruitCompletionTerminal(t *testing.T) {
	if mode := os.Getenv(recruitCompletionTerminalChildEnv); mode != "" {
		recruitCompletionTerminalChild(t, mode)
		return
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned PG17 required")
	}
	binary, err := os.Executable()
	returnPGOK(t, err)
	for _, mode := range []string{"partial_rollback", "commit_start", "commit_end", "commit_rejected"} {
		t.Run(mode, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, binary, "-test.run=^TestPGRecruitCompletionTerminal$", "-test.timeout=35s")
			cmd.Env = append(os.Environ(), recruitCompletionTerminalChildEnv+"="+mode)
			cmd.WaitDelay = time.Second
			out, childErr := cmd.CombinedOutput()
			var schemas []string
			for _, line := range strings.Split(string(out), "\n") {
				if strings.HasPrefix(line, recruitCompletionTerminalSchema) {
					var schema string
					if json.Unmarshal([]byte(strings.TrimPrefix(line, recruitCompletionTerminalSchema)), &schema) != nil || !strings.HasPrefix(schema, "api_return_") {
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
			if childErr != nil || ctx.Err() != nil || len(schemas) != 1 || strings.Count(string(out), "RECRUIT_COMPLETION_TERMINAL_PASSED\n") != 1 || strings.Contains(string(out), "WARNING: DATA RACE") {
				t.Fatalf("rollback child failed: %v / %v\n%s", childErr, ctx.Err(), out)
			}
		})
	}
}

func recruitCompletionTerminalChild(t *testing.T, mode string) {
	var trace *recruitCompletionTerminalTrace
	f := newRecruitCompleteReturnPG(t, func(base *recruitPromotionTrace) pgx.QueryTracer {
		trace = &recruitCompletionTerminalTrace{recruitPromotionTrace: base, mode: mode, primary: errors.New("original completion panic"), cleanup: errors.New("completion rollback panic")}
		return trace
	})
	// Quarantined slots cannot enter ordinary pool cleanup. The reaping parent
	// owns final schema removal even on failure/timeout.
	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "completion child panic: %v\n", r)
		}
		os.Exit(1)
	}()
	schema, err := json.Marshal(f.profile.SchemaName)
	returnPGOK(t, err)
	fmt.Println(recruitCompletionTerminalSchema + string(schema))
	_, candidate := f.paid(t, 0)
	f.paid(t, 1)
	paid := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	early := f.recruit.complete(f.ctx, candidate)
	recruitAttemptPGConfirmed(t, early)
	returnLifetimeCheck(t, early.completion == march.RecruitEarly && reflect.DeepEqual(paid, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)), "early result changed paid state")
	advanceRecruitCompletionPair(t, f)
	if mode == "commit_rejected" {
		returnPGExec(t, f.ctx, f.observer, `CREATE TABLE completion_terminal_deferred(id integer, CONSTRAINT completion_terminal_unique UNIQUE(id) DEFERRABLE INITIALLY DEFERRED)`)
	}
	before := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	var original int64
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1").Scan(&original))
	trace.observe = func(ctx context.Context, c *pgx.Conn) error {
		var ready int64
		var statuses []int16
		if err := c.QueryRow(ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1").Scan(&ready); err != nil {
			return err
		}
		if err := c.QueryRow(ctx, "SELECT array_agg(status ORDER BY queue_id) FROM work_queue WHERE queue_id IN(100,101)").Scan(&statuses); err != nil {
			return err
		}
		want := []int16{2, 1}
		if mode == "partial_rollback" {
			want[1] = 0
		}
		if ready != original+2 || !reflect.DeepEqual(statuses, want) {
			return fmt.Errorf("missing provisional effects: ready=%d states=%v", ready, statuses)
		}
		if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
			return errors.New("observer saw provisional completion")
		}
		if mode == "commit_rejected" {
			_, err := c.Exec(ctx, "INSERT INTO completion_terminal_deferred VALUES(1),(1)")
			return err
		}
		return nil
	}
	trace.armed = true
	var caught any
	var result recruitAttemptResult
	func() { defer func() { caught = recover() }(); result = f.recruit.complete(f.ctx, candidate) }()
	returnPGOK(t, trace.observationErr)
	returnLifetimeCheck(t, trace.inspected, "actual completion boundary not observed")
	if mode == "commit_rejected" {
		returnLifetimeCheck(t, caught == nil, "SQL rejection unexpectedly panicked", caught)
	} else {
		returnLifetimeCheck(t, caught == trace.primary && trace.bounded, "primary panic priority/bounded rollback lost", caught)
	}
	g := f.recruit
	g.s.mu.Lock()
	count := len(g.s.attempts)
	var a *recruitAttempt
	for x := range g.s.attempts {
		a = x
	}
	g.s.mu.Unlock()
	phase := "commit"
	if mode == "partial_rollback" {
		phase = "military complete"
	}
	returnLifetimeCheck(t, count == 1 && a != nil && a.generation == g.s && a.isCompletion && a.candidate == candidate && a.accountID == 1 && a.queueID == candidate.QueueID && a.phase == phase, "completion identity/phase lost")
	returnLifetimeCheck(t, a.result.outcome == recruitUnknown && a.result.completion == 0 && a.result.confirmed == (march.RecruitAcceptance{}) && a.result.diagnostic == nil, "tentative completion escaped", a.result)
	if mode == "commit_rejected" {
		var pgerr *pgconn.PgError
		returnLifetimeCheck(t, reflect.DeepEqual(result, a.result) && a.fault == nil && errors.Is(result.cause, recruittx.ErrOutcomeUnknown) && errors.As(result.cause, &pgerr) && pgerr.Code == "23505" && pgerr.ConstraintName == "completion_terminal_unique", "actual deferred COMMIT result lost", result)
		var rows int
		returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT count(*) FROM completion_terminal_deferred").Scan(&rows))
		returnLifetimeCheck(t, rows == 0, "rejected commit left witness rows")
	} else {
		returnLifetimeCheck(t, a.fault == trace.primary && a.result.cause != nil && strings.Contains(a.result.cause.Error(), trace.primary.Error()), "primary completion fault lost")
	}
	if mode == "partial_rollback" {
		returnLifetimeCheck(t, a.cleanupFault == trace.cleanup && a.result.cleanup != nil && strings.Contains(a.result.cleanup.Error(), trace.cleanup.Error()), "rollback fault replaced original")
	} else {
		returnLifetimeCheck(t, a.cleanupFault == nil && errors.Is(a.result.cleanup, recruittx.ErrInactive), "commit cleanup resolved uncertainty")
	}
	recruitLifetimeState(t, g, 1, true, false)
	backend := f.owned.get(trace.pid)
	if backend == nil || trace.pid == f.observer.PgConn().PID() {
		t.Fatal("original owned backend absent")
	}
	var active bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT EXISTS(SELECT FROM pg_stat_activity WHERE pid=$1 AND backend_start=$2::timestamptz AND xact_start IS NOT NULL)", trace.pid, backend.started).Scan(&active))
	returnLifetimeCheck(t, active == (mode == "partial_rollback"), "unexpected transaction lifetime", active)
	committed := mode == "commit_end"
	verify := func() {
		after := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
		if !committed {
			returnLifetimeCheck(t, reflect.DeepEqual(before, after), "uncommitted terminal left durable effects")
			return
		}
		recruitCompleteReturnChanges(t, before, after, map[string]bool{"city_troop": true, "work_queue": true})
		var ready int64
		var statuses []int16
		returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1").Scan(&ready))
		returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(status ORDER BY queue_id) FROM work_queue WHERE queue_id IN(100,101)").Scan(&statuses))
		returnLifetimeCheck(t, ready == original+2 && reflect.DeepEqual(statuses, []int16{2, 1}), "committed completion did not persist exact credit/promotion")
	}
	verify()
	checkpoint := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	retained := a.result
	returnPGOK(t, backend.close())
	clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	f.owned.noLocks(t, clean, f.observer, trace.pid, f.profile.SchemaOID)
	recruitPGReleased(t, f.ctx, f.observer, f.profileR)
	verify()
	returnPGOK(t, g.close())
	drain, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	returnLifetimeCheck(t, errors.Is(g.s.admission.waitDrained(drain), context.DeadlineExceeded), "physical cleanup incorrectly drained unknown lease")
	g.s.mu.Lock()
	_, exists := g.s.attempts[a]
	same := len(g.s.attempts) == 1 && exists && reflect.DeepEqual(a.result, retained)
	g.s.mu.Unlock()
	returnLifetimeCheck(t, same && reflect.DeepEqual(checkpoint, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)), "cleanup changed original unknown record or durable state")
	fmt.Println("RECRUIT_COMPLETION_TERMINAL_PASSED")
	os.Exit(0)
}
