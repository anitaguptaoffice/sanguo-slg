package api

import (
	"bytes"
	"context"
	"errors"
	"io"
	"reflect"
	"strings"
	"testing"
	"testing/iotest"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestReturnNetworkAcknowledgementFraming(t *testing.T) {
	ack := []byte{'C', 0, 0, 0, 11, 'C', 'O', 'M', 'M', 'I', 'T', 0, 'Z', 0, 0, 0, 5, 'I'}
	for _, fragmented := range []bool{false, true} {
		var r io.Reader = bytes.NewReader(ack) // Both frames coalesced in one source.
		if fragmented {
			r = iotest.OneByteReader(r) // Splits both headers and bodies.
		}
		w := returnNetworkAck(r)
		returnLifetimeCheck(t, w.tag && w.idle && w.withheld == len(ack) && w.err == errReturnNetwork, "lost-ack framing")
	}
	for _, bad := range [][]byte{ack[:4], ack[:11], ack[:17], {'E', 0, 0, 0, 4}, {'C', 255, 255, 255, 255},
		append([]byte{'C', 0, 0, 0, 11, 'R', 'O', 'L', 'L', 'B', 'K', 0}, ack[12:]...), append(append([]byte{}, ack[:17]...), 'T')} {
		returnLifetimeCheck(t, returnNetworkAck(bytes.NewReader(bad)).err != errReturnNetwork, "invalid acknowledgement accepted")
	}
}

func returnNetworkUnknown(t *testing.T, f *returnAttemptPG, a *returnAttempt, result returnAttemptResult, trace *returnPGTrace) {
	t.Helper()
	returnLifetimeState(t, f.generation, 1, true, false)
	s := f.generation.s
	s.mu.Lock()
	_, retained := s.attempts[a]
	valid := retained && len(s.attempts) == 1 && a.generation == s && a.candidate == f.candidate && a.phase == "commit" &&
		a.result == result && a.fault == nil && a.cleanupFault == nil
	s.mu.Unlock()
	returnLifetimeCheck(t, valid && result.outcome == returnUnknown && result.confirmed == (march.ReturnObservation{}) &&
		errors.Is(result.cause, recruittx.ErrOutcomeUnknown) && errors.Is(result.cause, errReturnNetwork) &&
		errors.Is(result.cleanup, recruittx.ErrInactive) && result.diagnostic == nil, "unknown attempt or diagnostic lost")
	count, alias := len(trace.events()), *f.generation
	r := alias.complete(f.ctx, f.candidate)
	returnLifetimeCheck(t, r.outcome == returnNotStarted && r.cause != nil && len(trace.events()) == count, "unknown admitted later SQL")
	returnPGOK(t, alias.close())
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	returnLifetimeCheck(t, errors.Is(s.admission.waitDrained(ctx), context.DeadlineExceeded), "unknown falsely drained")
	returnLifetimeState(t, f.generation, 1, true, false)
}

func TestPGReturnAttemptNetworkUncertainty(t *testing.T) {
	for _, mode := range []string{"lost acknowledgement", "fragmented lost acknowledgement", "cut before commit"} {
		t.Run(mode, func(t *testing.T) {
			n := &returnNetwork{cut: mode == "cut before commit", fragmented: strings.HasPrefix(mode, "fragmented"),
				reached: make(chan returnNetworkWitness, 1), resume: make(chan struct{})}
			trace := new(returnPGTrace)
			f := newReturnAttemptPG(t, trace, n.configure)
			var version int
			var synchronous, fsync string
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT current_setting('server_version_num')::int,current_setting('synchronous_commit'),current_setting('fsync')").Scan(&version, &synchronous, &fsync))
			returnLifetimeCheck(t, version/10000 == 17 && synchronous == "on" && fsync == "on", "PG17 synchronous fixture required")
			before, stable := snapshotReturnAttemptPG(t, f, false), snapshotReturnAttemptPG(t, f, true)
			offset := len(trace.events())
			done := n.start(t, f) // Initialization and all source validators ran before arming.
			var witness returnNetworkWitness
			select {
			case witness = <-n.reached:
			case <-n.guard.Done():
				t.Fatal("COMMIT transport witness not reached")
			}
			returnLifetimeCheck(t, witness.err == errReturnNetwork && witness.pid != 0 && witness.pid != f.observer.PgConn().PID() &&
				witness.forwarded == !n.cut && witness.tag == !n.cut && witness.idle == !n.cut &&
				(witness.withheld == 18) == !n.cut, "invalid transport witness")
			f.generation.s.mu.Lock()
			var attempt *returnAttempt
			for a := range f.generation.s.attempts {
				attempt = a
			}
			f.generation.s.mu.Unlock()
			returnLifetimeCheck(t, attempt != nil, "admitted identity missing at transport gate")
			if n.cut {
				n.ended(t, f, witness.pid)
				returnLifetimeCheck(t, reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)), "unforwarded commit changed graph")
			} else {
				var ready []int32
				var marchStatus, armyStatus, x, y int32
				returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop").Scan(&ready))
				returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT m.status,a.status,a.x,a.y FROM march_order m,field_army a").Scan(&marchStatus, &armyStatus, &x, &y))
				returnLifetimeCheck(t, reflect.DeepEqual(ready, []int32{18, 20, 19, 23}) && marchStatus == 4 && armyStatus == 1 && x == 0 && y == 0 &&
					reflect.DeepEqual(stable, snapshotReturnAttemptPG(t, f, true)), "observer did not prove committed credit with retained graph")
				returnPGReleased(t, f.ctx, f.observer, f.profile)
			}
			select {
			case <-done:
				t.Fatal("caller escaped before acknowledgement release")
			default:
			}
			n.release()
			select {
			case <-done:
			case <-n.guard.Done():
				t.Fatal("caller did not finish after transport cut")
			}
			returnLifetimeCheck(t, n.fault == nil, "unexpected attempt panic")
			n.ended(t, f, witness.pid)
			returnNetworkUnknown(t, f, attempt, n.result, trace)
			begins, commits := 0, 0
			for _, q := range trace.events()[offset:] {
				returnLifetimeCheck(t, q.pid == witness.pid, "unexpected attempt connection")
				switch strings.ToLower(strings.TrimSpace(q.sql)) {
				case "begin isolation level read committed":
					begins++
				case "commit":
					commits++
					returnLifetimeCheck(t, errors.Is(q.err, errReturnNetwork), "commit did not observe transport error")
				}
			}
			returnLifetimeCheck(t, begins == 1 && commits == 1, "commit retry or missing invocation")
		})
	}
}
