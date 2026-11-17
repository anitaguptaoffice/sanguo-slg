package api

import (
	"context"
	"errors"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgconn"
	"reflect"
	"strings"
	"testing"
	"time"
)

func startRecruitCompletionNetwork(t *testing.T, f *recruitFailurePG, n *returnNetwork, c march.RecruitCandidate, armed bool) *recruitNetworkCall {
	t.Helper()
	var cancel, stop context.CancelFunc
	n.ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	n.guard, stop = context.WithTimeout(context.Background(), 20*time.Second)
	call := &recruitNetworkCall{done: make(chan struct{})}
	watched := make(chan struct{})
	t.Cleanup(func() { // LIFO: transport and joins finish before fixture pool.Close.
		cancel()
		stop()
		n.abort() // Exact recorded transport objects only, never PID-targeted action.
		ctx, finish := context.WithTimeout(context.Background(), 18*time.Second)
		defer finish()
		for _, joined := range []<-chan struct{}{call.done, watched} {
			select {
			case <-joined:
			case <-ctx.Done():
				t.Error("Recruit network fixture goroutine did not join")
				return
			}
		}
		n.mu.Lock()
		connections := append([]*pgconn.PgConn(nil), n.connections...)
		n.mu.Unlock()
		for _, c := range connections {
			_ = c.Close(ctx) // APP has joined: no concurrent PgConn use.
			select {
			case <-c.CleanupDone():
			case <-ctx.Done():
				t.Error("Recruit pgx asynchronous cleanup did not finish")
				return
			}
			recruitNetworkEnded(t, f, c.PID())
		}
	})
	n.armed.Store(armed) // Initialization is never intercepted; normal control passes through.
	go func() {
		defer close(watched)
		select {
		case <-n.ctx.Done():
		case <-n.guard.Done():
		case <-call.done:
		}
		n.abort()
	}()
	go func() {
		defer close(call.done)
		defer func() { call.fault = recover() }()
		call.result = f.g.complete(n.ctx, c)
	}()
	return call
}

func TestPGRecruitCompletionNetworkUncertainty(t *testing.T) {
	for _, mode := range []string{"normal reply", "lost acknowledgement", "fragmented lost acknowledgement", "cut before commit"} {
		t.Run(mode, func(t *testing.T) {
			normal := mode == "normal reply"
			n := &returnNetwork{cut: mode == "cut before commit", fragmented: strings.HasPrefix(mode, "fragmented"), reached: make(chan returnNetworkWitness, 1), resume: make(chan struct{})}
			f := newRecruitNetworkPG(t, n)
			var version int
			var synchronous, fsync string
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT current_setting('server_version_num')::int,current_setting('synchronous_commit'),current_setting('fsync')").Scan(&version, &synchronous, &fsync))
			if version/10000 != 17 || synchronous != "on" || fsync != "on" {
				t.Fatal("PG17 synchronous fixture required")
			}
			admitted := f.g.admit(f.ctx, 1, f.scope, f.intent)
			recruitAttemptPGConfirmed(t, admitted)
			c := march.RecruitCandidate{ServerID: 1, PlayerID: 1, CityID: 1, QueueID: admitted.confirmed.QueueID}
			if c.QueueID != 100 {
				t.Fatal("unexpected paid queue", c)
			}
			paid := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			early := f.g.complete(f.ctx, c)
			recruitAttemptPGConfirmed(t, early)
			if early.completion != march.RecruitEarly || early.confirmed != (march.RecruitAcceptance{}) || !reflect.DeepEqual(paid, returnPGSnapshot(t, f.ctx, f.observer, f.profile)) {
				t.Fatal("actual early completion changed paid state", early)
			}
			advanceRecruitNetworkJob(t, f, c)
			before := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			var original int64
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=3").Scan(&original))
			verify := func(committed bool) {
				after := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
				if !committed {
					if !reflect.DeepEqual(before, after) {
						t.Fatal("uncommitted wire cut changed durable state")
					}
					return
				}
				recruitCompleteReturnChanges(t, before, after, map[string]bool{"city_troop": true, "work_queue": true})
				var ready int64
				var status int16
				returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=3").Scan(&ready))
				returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT status FROM work_queue WHERE server_id=1 AND queue_id=$1", c.QueueID).Scan(&status))
				if ready != original+2 || status != 2 {
					t.Fatal("committed completion missing exact credit/done", ready, status)
				}
			}
			f.trace.mu.Lock()
			f.trace.queries = nil
			f.trace.mu.Unlock()
			call := startRecruitCompletionNetwork(t, f, n, c, !normal)
			if normal {
				recruitNetworkJoin(t, n, call)
				recruitAttemptPGConfirmed(t, call.result)
				if call.result.completion != march.RecruitCompleted || call.result.confirmed != (march.RecruitAcceptance{}) {
					t.Fatal("normal receipt lost completion", call.result)
				}
				returnPGOK(t, recruitCompleteRecorded(f.trace.events(), f.observer.PgConn().PID(), f.profile))
				verify(true)
				recruitSerialState(t, f.g, 0)
				returnPGOK(t, f.g.close())
				returnPGOK(t, f.g.s.admission.waitDrained(f.ctx))
				return
			}
			var witness returnNetworkWitness
			select {
			case witness = <-n.reached:
			case <-n.guard.Done():
				t.Fatal("actual completion COMMIT wire gate not reached")
			}
			withheld := 18
			if n.cut {
				withheld = 0
			}
			if witness.err != errReturnNetwork || witness.pid == 0 || witness.pid != n.pid.Load() || witness.pid == f.observer.PgConn().PID() || witness.forwarded != !n.cut || witness.tag != !n.cut || witness.idle != !n.cut || witness.withheld != withheld {
				t.Fatal("missing genuine completion wire witness", witness)
			}
			t.Logf("completion wire COMMIT_forwarded=%t CommandComplete_COMMIT=%t ReadyForQuery_idle=%t withheld_bytes=%d caller_ack_bytes=0 fragmented=%t", witness.forwarded, witness.tag, witness.idle, witness.withheld, n.fragmented)
			recruitSerialState(t, f.g, 1)
			f.g.s.mu.Lock()
			var originalAttempt *recruitAttempt
			for a := range f.g.s.attempts {
				originalAttempt = a
			}
			identity := originalAttempt != nil && originalAttempt.generation == f.g.s && originalAttempt.isCompletion && originalAttempt.candidate == c && originalAttempt.accountID == 1 && originalAttempt.queueID == c.QueueID
			f.g.s.mu.Unlock()
			if !identity {
				t.Fatal("completion identity missing at wire boundary")
			}
			if n.cut {
				recruitNetworkEnded(t, f, witness.pid)
			}
			verify(!n.cut)
			checkpoint := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			select {
			case <-call.done:
				t.Fatal("caller escaped withheld completion response")
			default:
			}
			n.release()
			recruitNetworkJoin(t, n, call)
			r := call.result
			if r.outcome != recruitUnknown || r.completion != 0 || r.confirmed != (march.RecruitAcceptance{}) || !errors.Is(r.cause, recruittx.ErrOutcomeUnknown) || !errors.Is(r.cause, errReturnNetwork) || !errors.Is(r.cleanup, recruittx.ErrInactive) || r.diagnostic != nil {
				t.Fatal("observer state rewrote completion uncertainty", r)
			}
			events := f.trace.events()
			if len(events) < 2 || events[0].sql != "begin isolation level read committed" || events[len(events)-1].sql != "commit" || !errors.Is(events[len(events)-1].err, errReturnNetwork) {
				t.Fatal("missing actual failed COMMIT SQL")
			}
			for _, event := range events {
				if event.pid != witness.pid {
					t.Fatal("completion SQL escaped original connection")
				}
			}
			recruitLifetimeState(t, f.g, 1, true, false)
			f.g.s.mu.Lock()
			_, retained := f.g.s.attempts[originalAttempt]
			same := retained && len(f.g.s.attempts) == 1 && originalAttempt.phase == "commit" && reflect.DeepEqual(originalAttempt.result, r) && originalAttempt.fault == nil && originalAttempt.cleanupFault == nil
			f.g.s.mu.Unlock()
			if !same {
				t.Fatal("completion record changed after wire failure")
			}
			returnPGOK(t, f.g.close())
			queries := len(f.trace.events())
			alias := *f.g
			again := alias.complete(f.ctx, c)
			if again.outcome != recruitNotStarted || again.cause != errRecruitGeneration || len(f.trace.events()) != queries {
				t.Fatal("uncertain completion was retried")
			}
			drain, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
			defer cancel()
			if !errors.Is(f.g.s.admission.waitDrained(drain), context.DeadlineExceeded) || !reflect.DeepEqual(checkpoint, returnPGSnapshot(t, f.ctx, f.observer, f.profile)) {
				t.Fatal("unknown lease drained or checkpoint changed")
			}
		})
	}
}

func advanceRecruitNetworkJob(t *testing.T, f *recruitFailurePG, c march.RecruitCandidate) {
	t.Helper()
	immutable := func() string {
		var value string
		returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(q)-'start_at'-'finish_at' ORDER BY queue_id) FROM work_queue q),
 (SELECT jsonb_agg(to_jsonb(r)-'accepted_at'-'initial_start_at'-'initial_finish_at' ORDER BY queue_id) FROM mil_recruit_receipt r))::text`).Scan(&value))
		return value
	}
	before := immutable()
	tx, err := f.observer.Begin(f.ctx)
	returnPGOK(t, err)
	defer func() { _ = tx.Rollback(f.ctx) }()
	for _, q := range []string{
		`UPDATE work_queue SET start_at=start_at-interval '1 hour',finish_at=finish_at-interval '1 hour' WHERE server_id=$1 AND queue_id=$2 AND player_id=$3 AND city_id=$4 AND queue_type=3 AND status=1`,
		`UPDATE mil_recruit_receipt SET accepted_at=accepted_at-interval '1 hour',initial_start_at=initial_start_at-interval '1 hour',initial_finish_at=initial_finish_at-interval '1 hour' WHERE server_id=$1 AND queue_id=$2 AND city_id=$4 AND EXISTS(SELECT FROM mil_recruit_origin o WHERE o.server_id=$1 AND o.queue_id=$2 AND o.player_id=$3)`,
	} {
		tag, err := tx.Exec(f.ctx, q, c.ServerID, c.QueueID, c.PlayerID, c.CityID)
		returnPGOK(t, err)
		if tag.RowsAffected() != 1 {
			t.Fatal("time fixture target row count", tag)
		}
	}
	returnPGOK(t, tx.Commit(f.ctx))
	if before != immutable() {
		t.Fatal("time fixture changed non-time fields")
	}
	var valid bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT q.start_at=r.initial_start_at AND q.finish_at=r.initial_finish_at AND r.accepted_at<=q.start_at AND q.finish_at=q.start_at+r.duration_sec*interval '1 second' AND q.finish_at<clock_timestamp() FROM work_queue q JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=$1 AND q.queue_id=$2`, c.ServerID, c.QueueID).Scan(&valid))
	if !valid {
		t.Fatal("advanced schedule lost duration/receipt identity")
	}
}
