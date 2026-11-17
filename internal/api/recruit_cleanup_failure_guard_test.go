package api

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"runtime/debug"
	"strings"
	"testing"
	"time"
)

const recruitFailureBarrier = "SANGUO_RECRUIT_CLEANUP_FAILURE_BARRIER"
const recruitFailureBoundary = "RECRUIT_CLEANUP_FAILURE_BARRIER "
const recruitFailureRunnerChild = "SANGUO_RECRUIT_FAILURE_RUNNER_CHILD"

// Only injected failures wait. The parent owns the process and bounded release.
func recruitPanicFailureBarrier(path string) {
	if os.Getenv(recruitFailureBarrier) != "1" {
		return
	}
	fmt.Println(recruitFailureBoundary + path)
	released := make(chan error, 1)
	go func() {
		var b [1]byte
		_, err := os.Stdin.Read(b[:])
		if err == nil && b[0] != 'R' {
			err = fmt.Errorf("unexpected release byte %q", b[0])
		}
		released <- err
	}()
	select {
	case err := <-released:
		if err != nil {
			fmt.Fprintln(os.Stderr, "failure barrier release:", err)
		}
	case <-time.After(15 * time.Second):
		fmt.Fprintln(os.Stderr, "failure barrier release timed out")
	}
}

// Directly deferred by the synchronous runner, before the child registers cleanup.
// Goexit runs this defer even though recover returns nil. Never return from it.
func recruitPanicFailureExit() {
	fault := recover()
	fmt.Fprintf(os.Stderr, "RECRUIT_CLEANUP_FAILURE_EXIT panic=%v\n%s", fault, debug.Stack())
	recruitPanicFailureBarrier("guard")
	os.Exit(1)
}

// A same-goroutine call: do not use t.Run or launch the child in a goroutine.
func recruitPanicGuardedChild(t *testing.T, child func(*testing.T)) {
	defer recruitPanicFailureExit()
	child(t)
}

func TestRecruitCleanupFailureRunner(t *testing.T) {
	if mechanism := os.Getenv(recruitFailureRunnerChild); mechanism != "" {
		recruitPanicGuardedChild(t, func(t *testing.T) {
			t.Cleanup(func() { fmt.Println("RUNNER_FORBIDDEN_CLEANUP") })
			fmt.Println("RUNNER_ENTER " + mechanism)
			switch mechanism {
			case "fatal":
				t.Fatal("injected runner fatal")
			case "goexit":
				runtime.Goexit()
			case "panic":
				panic("injected runner panic")
			case "return":
				return
			default:
				panic("invalid runner failure mechanism")
			}
		})
		return
	}
	executable, err := os.Executable()
	returnPGOK(t, err)
	for _, mechanism := range []string{"fatal", "goexit", "panic", "return"} {
		t.Run(mechanism, func(t *testing.T) {
			ctx, stop := context.WithTimeout(context.Background(), 15*time.Second)
			defer stop()
			cmd := exec.CommandContext(ctx, executable,
				"-test.run=^TestRecruitCleanupFailureRunner$", "-test.v", "-test.timeout=10s")
			for _, variable := range os.Environ() {
				if !strings.HasPrefix(variable, recruitFailureRunnerChild+"=") &&
					!strings.HasPrefix(variable, recruitFailureBarrier+"=") {
					cmd.Env = append(cmd.Env, variable)
				}
			}
			cmd.Env = append(cmd.Env, recruitFailureRunnerChild+"="+mechanism)
			cmd.WaitDelay = time.Second
			output, childErr := cmd.CombinedOutput()
			text := string(output)
			if ctx.Err() != nil || childErr == nil || cmd.ProcessState == nil || cmd.ProcessState.ExitCode() != 1 {
				t.Fatalf("runner child not reaped with failure: %v / %v\n%s", childErr, ctx.Err(), text)
			}
			if strings.Count(text, "RECRUIT_CLEANUP_FAILURE_EXIT ") != 1 ||
				strings.Count(text, "RUNNER_ENTER "+mechanism) != 1 || strings.Contains(text, "RUNNER_FORBIDDEN_CLEANUP") ||
				strings.Contains(text, "WARNING: DATA RACE") {
				t.Fatalf("runner did not suppress inherited cleanup\n%s", text)
			}
			if mechanism == "panic" && (!strings.Contains(text, "panic=injected runner panic") ||
				!strings.Contains(text, "TestRecruitCleanupFailureRunner") || !strings.Contains(text, "runtime/debug.Stack")) {
				t.Fatalf("panic value or stack missing\n%s", text)
			}
			t.Logf("standalone runner %s child reaped without T cleanup", mechanism)
		})
	}
}
