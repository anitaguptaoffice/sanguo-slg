package api

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestPGRecruitAttemptNetworkUncertainty(t *testing.T) {
	for _, mode := range []string{"normal reply", "lost acknowledgement", "fragmented lost acknowledgement", "cut before commit"} {
		t.Run(mode, func(t *testing.T) {
			normal := mode == "normal reply"
			n := &returnNetwork{cut: mode == "cut before commit", fragmented: strings.HasPrefix(mode, "fragmented"),
				reached: make(chan returnNetworkWitness, 1), resume: make(chan struct{})}
			f := newRecruitNetworkPG(t, n)
			var version int
			var synchronous, fsync string
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT current_setting('server_version_num')::int,current_setting('synchronous_commit'),current_setting('fsync')").Scan(&version, &synchronous, &fsync))
			if version/10000 != 17 || synchronous != "on" || fsync != "on" {
				t.Fatal("PG17 synchronous fixture required")
			}
			before := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			wallet := recruitNetworkWalletMetadata(t, f)
			var earliest time.Time
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&earliest))
			call := startRecruitNetwork(t, f, n, !normal)
			if normal {
				recruitNetworkJoin(t, n, call)
				recruitAttemptPGConfirmed(t, call.result)
				recruitAttemptPGRecorded(t, f.trace.events(), f.observer, f.profile, false)
				accepted := recruitNetworkCommitted(t, f, before, wallet, earliest)
				if call.result.confirmed != accepted {
					t.Fatal("normal reply differs from complete independent receipt")
				}
				recruitSerialState(t, f.g, 0)
				returnPGOK(t, f.g.close())
				returnPGOK(t, f.g.s.admission.waitDrained(f.ctx))
				return
			}
			var witness returnNetworkWitness
			select {
			case witness = <-n.reached:
			case <-n.guard.Done():
				t.Fatal("COMMIT transport witness not reached")
			}
			withheld := 18
			if n.cut {
				withheld = 0
			}
			if witness.err != errReturnNetwork || witness.pid == 0 || witness.pid != n.pid.Load() ||
				witness.pid == f.observer.PgConn().PID() || witness.forwarded != !n.cut ||
				witness.tag != !n.cut || witness.idle != !n.cut || witness.withheld != withheld {
				t.Fatal("incomplete or incorrect real wire witness", witness)
			}
			// These are parsed server bytes, not fabricated tracer errors. No auth,
			// connection string or startup frame is retained in the evidence log.
			t.Logf("wire COMMIT_forwarded=%t CommandComplete_COMMIT=%t ReadyForQuery_idle=%t withheld_bytes=%d caller_ack_bytes=0 fragmented=%t",
				witness.forwarded, witness.tag, witness.idle, witness.withheld, n.fragmented)
			recruitSerialState(t, f.g, 1)
			f.g.s.mu.Lock()
			var original *recruitAttempt
			for a := range f.g.s.attempts {
				original = a
			}
			identity := original != nil && original.generation == f.g.s && original.accountID == 1 &&
				original.scope == f.scope && original.intent == f.intent && original.queueID == 100
			f.g.s.mu.Unlock()
			if !identity {
				t.Fatal("original command identity missing at wire gate")
			}
			if n.cut {
				recruitNetworkEnded(t, f, witness.pid)
				f.unchanged(t, before, true)
			} else {
				_ = recruitNetworkCommitted(t, f, before, wallet, earliest)
			}
			checkpoint := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			select {
			case <-call.done:
				t.Fatal("caller escaped before proxy released withheld acknowledgement")
			default:
			}
			n.release()
			recruitNetworkJoin(t, n, call)
			r := call.result
			if r.outcome != recruitUnknown || r.confirmed != (march.RecruitAcceptance{}) ||
				!errors.Is(r.cause, recruittx.ErrOutcomeUnknown) || !errors.Is(r.cause, errReturnNetwork) ||
				!errors.Is(r.cleanup, recruittx.ErrInactive) || r.diagnostic != nil {
				t.Fatal("observer success/absence rewrote the caller-unknown result", r)
			}
			f.recorded(t, "commit", errReturnNetwork, true)
			events := f.trace.events()
			if len(events) < 2 || events[0].sql != "begin isolation level read committed" || events[len(events)-1].sql != "commit" {
				t.Fatal("metadata or business SQL escaped the actual transaction")
			}
			for _, event := range events {
				if event.pid != witness.pid {
					t.Fatal("attempt SQL did not use the witnessed transport")
				}
			}
			f.closed(t, r, "commit", 100, true)
			f.g.s.mu.Lock()
			_, retained := f.g.s.attempts[original]
			same := retained && original.result == r && original.fault == nil && original.cleanupFault == nil
			f.g.s.mu.Unlock()
			if !same || !reflect.DeepEqual(checkpoint, returnPGSnapshot(t, f.ctx, f.observer, f.profile)) {
				t.Fatal("cleanup/observer/closed-generation probe changed original attempt or durable ledger")
			}
		})
	}
}

func recruitNetworkWalletMetadata(t *testing.T, f *recruitFailurePG) string {
	t.Helper()
	var got string
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT (to_jsonb(w)-'food'-'wood'-'iron'-'stone')::text FROM player_wallet w").Scan(&got))
	return got
}

func recruitNetworkCommitted(t *testing.T, f *recruitFailurePG, before map[string]string, wallet string, earliest time.Time) march.RecruitAcceptance {
	t.Helper()
	accepted := recruitAttemptPGObserved(t, f.ctx, f.observer)
	if accepted.AcceptedAt.Before(earliest.UTC().Truncate(time.Millisecond)) || recruitNetworkWalletMetadata(t, f) != wallet {
		t.Fatal("acceptance clock or non-debited wallet fields changed")
	}
	after := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
	recruitSerialChanges(t, before, after, true)
	var preserved string
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT COALESCE(jsonb_agg(jsonb_build_array(q,q.xmin::text,q.ctid::text) ORDER BY q.ctid)::text,'[]')
FROM work_queue q WHERE NOT (server_id=1 AND queue_id=100)`).Scan(&preserved))
	if preserved != before["work_queue"] {
		t.Fatal("admission changed an unrelated queue value or MVCC identity")
	}
	var last, logged int64
	var called bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT last_value,log_cnt,is_called FROM work_queue_id_seq").Scan(&last, &logged, &called))
	if last != 100 || !called || logged < 0 {
		t.Fatal("shared allocator did not consume exactly one identity")
	}
	recruitPGReleased(t, f.ctx, f.observer, f.profile)
	return accepted
}
