package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

const recruitFailureMode = "SANGUO_RECRUIT_CLEANUP_FAILURE"
const recruitFailureCleanup = "RECRUIT_CLEANUP_FAILURE_FORBIDDEN_CLEANUP"

func recruitPanicFailureSetup(t *testing.T) {
	t.Helper()
	if os.Getenv(recruitFailureMode) == "" {
		return
	}
	// Registered before fixture cleanups: in the diagnostic guard-removal tree,
	// this barrier runs after those cleanups, while the child is still alive.
	t.Cleanup(func() {
		fmt.Println(recruitFailureCleanup)
		recruitPanicFailureBarrier("cleanup")
	})
}

func recruitPanicFailurePoint(t *testing.T, point string) bool {
	t.Helper()
	mode := strings.Split(os.Getenv(recruitFailureMode), ":")
	if len(mode) != 2 || mode[0] != point {
		return false
	}
	fmt.Println("RECRUIT_CLEANUP_FAILURE_POINT " + strings.Join(mode, ":"))
	switch mode[1] {
	case "fatal":
		t.Fatal("injected child failure at " + point)
	case "goexit":
		runtime.Goexit()
	case "panic":
		panic("injected child panic at " + point)
	case "return":
		if point == "pre" {
			return true
		}
		panic("return injection only allowed before fixture")
	default:
		panic("invalid child failure mechanism")
	}
	return false
}

func TestRecruitCleanupFailureGuard(t *testing.T) {
	executable, err := os.Executable()
	returnPGOK(t, err)
	for _, mechanism := range []string{"fatal", "goexit", "panic", "return"} {
		t.Run(mechanism, func(t *testing.T) {
			ctx, stop := context.WithTimeout(context.Background(), 15*time.Second)
			defer stop()
			cmd := exec.CommandContext(ctx, executable,
				"-test.run=^TestPGRecruitGenerationConstructorCleanupPanic$", "-test.v", "-test.timeout=10s")
			for _, variable := range os.Environ() {
				if !strings.HasPrefix(variable, recruitPanicChild+"=") &&
					!strings.HasPrefix(variable, recruitFailureMode+"=") &&
					!strings.HasPrefix(variable, recruitFailureBarrier+"=") {
					cmd.Env = append(cmd.Env, variable)
				}
			}
			cmd.Env = append(cmd.Env, recruitPanicChild+"=1", recruitFailureMode+"=pre:"+mechanism)
			cmd.WaitDelay = time.Second
			output, childErr := cmd.CombinedOutput()
			text := string(output)
			if ctx.Err() != nil || childErr == nil || cmd.ProcessState == nil || cmd.ProcessState.ExitCode() != 1 {
				t.Fatalf("child was not normally reaped with failure: %v / %v\n%s", childErr, ctx.Err(), text)
			}
			if strings.Count(text, "RECRUIT_CLEANUP_FAILURE_EXIT ") != 1 ||
				!strings.Contains(text, "RECRUIT_CLEANUP_FAILURE_POINT pre:"+mechanism) ||
				strings.Contains(text, recruitFailureCleanup) || strings.Contains(text, recruitPanicOwned) ||
				strings.Contains(text, recruitPanicWitness) || strings.Contains(text, "WARNING: DATA RACE") {
				t.Fatalf("actual child did not fail closed before fixture cleanup\n%s", text)
			}
			if mechanism == "panic" && (!strings.Contains(text, "panic=injected child panic at pre") ||
				!strings.Contains(text, "recruitCleanupPanicChild") || !strings.Contains(text, "runtime/debug.Stack")) {
				t.Fatalf("panic value or stack missing\n%s", text)
			}
			t.Logf("actual child %s reaped; no fixture ownership or T cleanup", mechanism)
		})
	}
}

func recruitFailureOwnership(lines []string) (recruitPanicEvidence, error) {
	var owned recruitPanicEvidence
	owners := 0
	for _, line := range lines {
		if !strings.HasPrefix(line, recruitPanicOwned) {
			continue
		}
		var next recruitPanicEvidence
		bad := json.Unmarshal([]byte(strings.TrimPrefix(line, recruitPanicOwned)), &next) != nil
		bad = bad || !regexp.MustCompile(`^api_return_[0-9]+_"Q$`).MatchString(next.Schema) || next.Verified != ""
		if owners == 0 {
			bad = bad || next.Original != (recruitPanicBackend{}) || len(next.Spares) != 0
		} else {
			bad = bad || next.Schema != owned.Schema || !next.Original.valid()
			if owners == 1 {
				bad = bad || len(next.Spares) != 0
			} else {
				bad = bad || !next.Original.same(owned.Original) || len(next.Spares) != len(owned.Spares)+1
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
		if bad {
			return recruitPanicEvidence{}, errors.New("cleanup-unverified: malformed ownership")
		}
		owned, owners = next, owners+1
	}
	if owners < 2 || !owned.Original.valid() {
		return recruitPanicEvidence{}, errors.New("cleanup-unverified: missing ownership")
	}
	return owned, nil
}

func TestRecruitFailureOwnershipRejectsIncomplete(t *testing.T) {
	for _, lines := range [][]string{nil, {recruitPanicOwned + "{"},
		{recruitPanicOwned + `{"Schema":"api_return_1_\"Q"}`},
		{recruitPanicOwned + `{"Schema":"unowned","Original":{"PID":1}}`}} {
		owned, err := recruitFailureOwnership(lines)
		if err == nil || owned.Schema != "" || !strings.Contains(err.Error(), "cleanup-unverified") {
			t.Fatal("unsafe cleanup target accepted", owned, err)
		}
	}
}

// The cleanup gate does not issue DDL, including on unverifiable absence.
func recruitFailureAbsent(ctx context.Context, observer *pgx.Conn, owned recruitPanicEvidence, reaped bool) error {
	if !reaped || !owned.Original.valid() || owned.Schema == "" {
		return errors.New("cleanup-unverified: reap or ownership missing")
	}
	for _, id := range append([]recruitPanicBackend{owned.Original}, owned.Spares...) {
		if err := recruitPanicAbsence(ctx, observer, id); err != nil {
			return fmt.Errorf("cleanup-unverified: %w", err)
		}
	}
	return nil
}

func TestRecruitFailureAbsenceRequiresReap(t *testing.T) {
	owned := recruitPanicEvidence{Schema: "owned", Original: recruitPanicBackend{PID: 1, Start: time.Now()}}
	if err := recruitFailureAbsent(context.Background(), nil, owned, false); err == nil {
		t.Fatal("absence accepted before child reap")
	}
	if err := recruitFailureAbsent(context.Background(), nil, recruitPanicEvidence{}, true); err == nil {
		t.Fatal("absence accepted without ownership")
	}
}

func TestPGRecruitFailureAbsenceRejectsLiveBackend(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("owned isolated PG17 required")
	}
	ctx := returnPGContext(t)
	cfg, err := pgx.ParseConfig(dsn)
	returnPGOK(t, err)
	trace := &returnPGTrace{}
	cfg.Tracer = trace
	observer, err := pgx.ConnectConfig(ctx, cfg)
	returnPGOK(t, err)
	defer func() {
		clean, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		returnPGOK(t, observer.Close(clean))
	}()
	id := recruitPanicBackend{PID: observer.PgConn().PID()}
	returnPGOK(t, observer.QueryRow(ctx, "SELECT backend_start FROM pg_catalog.pg_stat_activity WHERE pid=pg_backend_pid()").Scan(&id.Start))
	bounded, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
	defer cancel()
	// This live connection is owned by this test, not an invented historical PID.
	err = recruitFailureAbsent(bounded, observer, recruitPanicEvidence{Schema: "never-a-cleanup-target", Original: id}, true)
	returnLifetimeCheck(t, err != nil && strings.Contains(err.Error(), "cleanup-unverified"), "live backend accepted", err)
	for _, event := range trace.events() {
		returnLifetimeCheck(t, strings.HasPrefix(event.sql, "SELECT "), "absence gate attempted DDL", event.sql)
	}
}

// SQL markers and JSON observations bind server-log session ordering to exact IDs.
type recruitFailureObservation struct {
	Case       string
	Stage      string
	Database   string
	Observer   recruitPanicBackend
	Owned      recruitPanicEvidence
	Barrier    string
	Live       []bool
	SchemaLive bool
	ExitCode   int
}

func recruitFailureMark(t *testing.T, ctx context.Context, conn *pgx.Conn, event recruitFailureObservation) {
	t.Helper()
	encoded, err := json.Marshal(event)
	returnPGOK(t, err)
	// JSON is quoted as one SQL literal, never interpolated as an identifier.
	literal := strings.ReplaceAll(string(encoded), "'", "''")
	_, err = conn.Exec(ctx, "SELECT 'RECRUIT_FAILURE_SQL "+literal+"'")
	returnPGOK(t, err)
	fmt.Printf("RECRUIT_FAILURE_EVENT %s\n", encoded)
}

func TestPGRecruitCleanupFailureProcess(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("owned isolated PG17 and host psql required")
	}
	for _, mode := range []string{"original:fatal", "original:goexit", "original:panic", "spare:fatal", "raw-close:fatal"} {
		t.Run(strings.ReplaceAll(mode, ":", "_"), func(t *testing.T) {
			recruitFailureProcess(t, mode)
		})
	}
}

func recruitFailureProcess(t *testing.T, mode string) {
	t.Helper()
	executable, err := os.Executable()
	returnPGOK(t, err)
	ctx, stop := context.WithTimeout(context.Background(), 45*time.Second)
	defer stop()
	cmd := exec.CommandContext(ctx, executable, "-test.run=^TestPGRecruitGenerationConstructorCleanupPanic$",
		"-test.v", "-test.timeout=35s", "-test.paniconexit0=false")
	for _, variable := range os.Environ() {
		if !strings.HasPrefix(variable, recruitPanicChild+"=") &&
			!strings.HasPrefix(variable, recruitFailureMode+"=") &&
			!strings.HasPrefix(variable, recruitFailureBarrier+"=") {
			cmd.Env = append(cmd.Env, variable)
		}
	}
	cmd.Env = append(cmd.Env, recruitPanicChild+"=1", recruitFailureMode+"="+mode, recruitFailureBarrier+"=1")
	cmd.WaitDelay = time.Second
	stdout, err := cmd.StdoutPipe()
	returnPGOK(t, err)
	stdin, err := cmd.StdinPipe()
	returnPGOK(t, err)
	defer stdin.Close()
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	returnPGOK(t, cmd.Start())
	reaped := false
	defer func() {
		if !reaped {
			_ = cmd.Process.Kill() // Only the process created above, never a backend PID.
			_ = cmd.Wait()
		}
	}()
	lines := make(chan string)
	scanned := make(chan error, 1)
	go func() {
		defer close(lines)
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			select {
			case lines <- scanner.Text():
			case <-ctx.Done():
				scanned <- ctx.Err()
				return
			}
		}
		scanned <- scanner.Err()
	}()
	var output []string
	barrier := ""
	for line := range lines {
		output = append(output, line)
		if strings.HasPrefix(line, recruitFailureBoundary) {
			barrier = strings.TrimPrefix(line, recruitFailureBoundary)
			break
		}
	}
	owned, err := recruitFailureOwnership(output)
	returnLifetimeCheck(t, err == nil && barrier != "", "cleanup-unverified: ownership/barrier", err, output)
	observer, err := pgx.Connect(ctx, os.Getenv("DATABASE_URL"))
	returnPGOK(t, err)
	defer func() {
		closeCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		returnPGOK(t, observer.Close(closeCtx))
	}()
	event := recruitFailureObservation{Case: fmt.Sprintf("%d-%s", time.Now().UnixNano(), mode),
		Stage: "barrier-observed", Owned: owned, Barrier: barrier, ExitCode: -1}
	returnPGOK(t, observer.QueryRow(ctx, "SELECT current_database(),pid,backend_start FROM pg_catalog.pg_stat_activity WHERE pid=pg_backend_pid()").Scan(
		&event.Database, &event.Observer.PID, &event.Observer.Start))
	ids := append([]recruitPanicBackend{owned.Original}, owned.Spares...)
	for _, id := range ids {
		var live bool
		returnPGOK(t, observer.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid=$1 AND backend_start=$2)", id.PID, id.Start).Scan(&live))
		event.Live = append(event.Live, live)
	}
	returnPGOK(t, observer.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1)", owned.Schema).Scan(&event.SchemaLive))
	recruitFailureMark(t, ctx, observer, event)
	_, err = stdin.Write([]byte{'R'})
	returnPGOK(t, err)
	returnPGOK(t, stdin.Close())
	for line := range lines {
		output = append(output, line)
	}
	scanErr := <-scanned
	childErr := cmd.Wait()
	reaped = true
	returnLifetimeCheck(t, cmd.ProcessState != nil, "cleanup-unverified: child not reaped", childErr)
	event.ExitCode = cmd.ProcessState.ExitCode()
	clean, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := recruitFailureAbsent(clean, observer, owned, reaped); err != nil {
		t.Fatalf("cleanup-unverified: schema not cleaned: %v", err)
	}
	event.Stage = "reaped-backends-absent"
	recruitFailureMark(t, clean, observer, event)
	returnPGExec(t, clean, observer, "DROP SCHEMA IF EXISTS "+pgx.Identifier{owned.Schema}.Sanitize()+" CASCADE")
	event.Stage = "case-end"
	recruitFailureMark(t, clean, observer, event)
	text := strings.Join(output, "\n") + stderr.String()
	t.Log(text)
	returnLifetimeCheck(t, childErr != nil && event.ExitCode == 1 && ctx.Err() == nil && scanErr == nil,
		"unexpected child termination", childErr, event.ExitCode, ctx.Err(), scanErr)
	returnLifetimeCheck(t, barrier == "guard" && !strings.Contains(text, recruitFailureCleanup), "forbidden inherited fixture cleanup executed")
	returnLifetimeCheck(t, strings.Count(text, "RECRUIT_CLEANUP_FAILURE_EXIT ") == 1 &&
		strings.Contains(text, "RECRUIT_CLEANUP_FAILURE_POINT "+mode) && !strings.Contains(text, recruitPanicWitness) &&
		!strings.Contains(text, "WARNING: DATA RACE"), "failure diagnostic or race contract violated")
	returnLifetimeCheck(t, event.SchemaLive, "child removed schema before reap")
	wantOriginalLive := mode != "raw-close:fatal"
	returnLifetimeCheck(t, event.Live[0] == wantOriginalLive, "original barrier liveness changed", event.Live)
	wantSpares := 0
	if mode == "spare:fatal" || mode == "raw-close:fatal" {
		wantSpares = 1
	}
	returnLifetimeCheck(t, len(owned.Spares) == wantSpares, "unexpected spare inventory", owned)
	for _, live := range event.Live[1:] {
		returnLifetimeCheck(t, live, "owned spare absent before child disposal")
	}
}
