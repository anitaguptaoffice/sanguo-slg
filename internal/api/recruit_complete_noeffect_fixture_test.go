package api

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
)

type recruitNoeffectCall struct {
	clock, commit *returnLifetimeTrace
	done          chan struct{}
	result        recruitAttemptResult
	fault         any
}

type recruitNoeffectTrace struct {
	returnPGTrace
	guard sync.Mutex
	call  *recruitNoeffectCall
}

func (r *recruitNoeffectTrace) current() *recruitNoeffectCall {
	r.guard.Lock()
	defer r.guard.Unlock()
	return r.call
}

func recruitNoeffectGate(ctx context.Context, conn *pgx.Conn, gate *returnLifetimeTrace) {
	gate.once.Do(func() {
		gate.reached <- conn.PgConn().PID()
		select {
		case <-gate.resume:
		case <-ctx.Done():
		}
	})
}

func (r *recruitNoeffectTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.returnPGTrace.TraceQueryStart(ctx, conn, data)
	if call := r.current(); call != nil && data.SQL == "commit" {
		recruitNoeffectGate(ctx, conn, call.commit)
	}
	return ctx
}

func (r *recruitNoeffectTrace) TraceQueryEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryEndData) {
	r.returnPGTrace.TraceQueryEnd(ctx, conn, data)
	if call := r.current(); call != nil && data.Err == nil && r.events()[ctx.Value(returnPGTraceKey{}).(int)].sql == "SELECT pg_catalog.clock_timestamp()" {
		// Scan has received the actual server sample; MIL cannot proceed yet.
		recruitNoeffectGate(ctx, conn, call.clock)
	}
}

func startRecruitNoeffect(t *testing.T, g *recruitGeneration, trace *recruitNoeffectTrace, c march.RecruitCandidate) *recruitNoeffectCall {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	call := &recruitNoeffectCall{clock: returnLifetimeTracer(""), commit: returnLifetimeTracer(""), done: make(chan struct{})}
	trace.guard.Lock()
	trace.call = call // Prior calls have joined before a new call is armed.
	trace.guard.Unlock()
	t.Cleanup(func() {
		cancel()
		call.clock.release()
		call.commit.release()
		if !returnBackendJoin(call.done, 8*time.Second) {
			t.Error("no-effect caller did not join before fixture cleanup")
		}
	})
	go func() {
		defer close(call.done)
		defer func() { call.fault = recover() }()
		call.result = g.complete(ctx, c)
	}()
	return call
}

func recruitNoeffectOrder(admission bool) []string {
	want := []string{"begin isolation level read committed"}
	for _, name := range recruitPGPinNames {
		want = append(want, "pin:"+name)
	}
	if admission {
		return append(want, strings.Fields("account-proof actor player wallet-proof wallet military-proof find military-proof reverse city-proof city military-proof marker stock pending evidence clock allocate debit wallet-read job origin receipt readback commit")...)
	}
	return append(want, strings.Fields("account-hint-proof account-hint account-proof actor player wallet-proof wallet completion-proof candidate city-proof city completion-proof marker stock pending receipt-lock evidence completion-proof candidate clock commit")...)
}

func recruitNoeffectRecorded(events []returnPGQuery, observer uint32, p freshsource.Profile, admission bool) error {
	var got []string
	var pid uint32
	reads := 0
	for _, q := range events {
		if pid == 0 {
			pid = q.pid
		}
		if q.pid == 0 || q.pid != pid || q.pid == observer || q.err != nil {
			return fmt.Errorf("no-effect backend/error: pid=%d err=%v", q.pid, q.err)
		}
		stage, ok := recruitCompleteStage(q.sql, p)
		if !ok {
			return fmt.Errorf("unexpected no-effect SQL: %q", q.sql)
		}
		if stage == "metadata" {
			if len(got) == 0 || got[len(got)-1] == "commit" {
				return fmt.Errorf("metadata outside no-effect transaction")
			}
			reads++
			continue
		}
		got = append(got, stage)
	}
	if reads == 0 || !recruitNoeffectStages(got, admission) {
		return fmt.Errorf("no-effect stages: %v metadata=%d", got, reads)
	}
	return nil
}

func recruitNoeffectStages(got []string, admission bool) bool {
	return reflect.DeepEqual(got, recruitNoeffectOrder(admission))
}

func TestRecruitCompletionNoeffectSQLWitness(t *testing.T) {
	for _, admission := range []bool{false, true} {
		valid := recruitNoeffectOrder(admission)
		if !recruitNoeffectStages(valid, admission) {
			t.Fatal("exact ordered stages rejected")
		}
		swapped := append([]string(nil), valid...)
		swapped[1], swapped[2] = swapped[2], swapped[1]
		for _, invalid := range [][]string{valid[1:], valid[:len(valid)-1], swapped,
			append(append([]string(nil), valid...), "commit"), append(append([]string(nil), valid...), "credit")} {
			if recruitNoeffectStages(invalid, admission) {
				t.Fatal("missing/extra/write/reordered stages accepted")
			}
		}
	}
	valid := recruitNoeffectOrder(false)
	swappedProof := append([]string(nil), valid...)
	swappedProof[10], swappedProof[12] = swappedProof[12], swappedProof[10]
	missingProof := append(append([]string(nil), valid[:10]...), valid[11:]...)
	duplicateProof := append(append([]string(nil), valid[:11]...), valid[10:]...)
	for _, invalid := range [][]string{swappedProof, missingProof, duplicateProof} {
		if recruitNoeffectStages(invalid, false) {
			t.Fatal("missing/duplicate/reordered completion proof accepted")
		}
	}
	for _, replacement := range []struct {
		at    int
		stage string
	}{{10, "account-proof"}, {17, "military-proof"}} {
		alias := append([]string(nil), valid...)
		alias[replacement.at] = replacement.stage
		if recruitNoeffectStages(alias, false) {
			t.Fatal("different port proof substituted", replacement)
		}
	}
	p := freshsource.Profile{SchemaName: "noeffect"}
	for _, pid := range []uint32{0, 7} {
		err := recruitNoeffectRecorded([]returnPGQuery{{sql: "commit", pid: pid}}, 7, p, false)
		if err == nil || !strings.HasPrefix(err.Error(), "no-effect backend/error:") {
			t.Fatal("invalid backend accepted", err)
		}
	}
	if recruitNoeffectRecorded([]returnPGQuery{{sql: "SELECT 1", pid: 8}}, 7, p, false) == nil {
		t.Fatal("unknown SQL accepted")
	}
}
