package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestPGRecruitAttemptConcurrentCommandReplay(t *testing.T) {
	for _, conflict := range []bool{false, true} {
		name := "same intent"
		if conflict {
			name = "conflicting count"
		}
		t.Run(name, func(t *testing.T) {
			f := newRecruitReturnPG(t, 11)
			f.intent.UnitCfgID = 3
			original := f.intent
			if f.pool.Config().MaxConns != 2 {
				t.Fatal("concurrent callers require exactly two owned pool slots")
			}
			before := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			queueOne := recruitReturnQueueOne(t, f)
			var earliest time.Time
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&earliest))
			lead := f.start(true)
			leader := returnLifetimeReached(t, f.trace.returnLifetimeTrace)
			recruitSerialActorLocks(t, f)
			f.locked(t)
			recruitSerialChanges(t, before, returnPGSnapshot(t, f.ctx, f.observer, f.profile), false)

			// The first caller already evaluated its immutable inputs and is stopped
			// before COMMIT. Both actual ACCOUNT FOR SHARE locks are compatible.
			f.trace.pauseWallet = true
			if conflict {
				f.intent.Count++
			}
			lag := f.start(true)
			follower := f.waitWallet(t, leader)
			if leader == follower || f.pool.Stat().AcquiredConns() != 2 {
				t.Fatal("wallet witness did not use two simultaneously owned sessions")
			}
			recruitSerialState(t, f.recruit, 2)
			recruitSerialChanges(t, before, returnPGSnapshot(t, f.ctx, f.observer, f.profile), false)

			f.trace.release()
			f.join(t, lead)
			recruitAttemptPGConfirmed(t, lead.recruit)
			select {
			case <-f.trace.walletReached:
			case <-f.ctx.Done():
				t.Fatal("follower did not acquire leader's released wallet")
			}
			recruitSerialState(t, f.recruit, 1)
			accepted := recruitAttemptPGObserved(t, f.ctx, f.observer)
			if lead.recruit.confirmed != accepted || accepted.AcceptedAt.Before(earliest.UTC().Truncate(time.Millisecond)) {
				t.Fatal("leader confirmation differs from independent durable receipt", lead.recruit, accepted)
			}
			checkpoint := returnPGSnapshot(t, f.ctx, f.observer, f.profile)
			recruitSerialChanges(t, before, checkpoint, true)
			if queueOne != recruitReturnQueueOne(t, f) {
				t.Fatal("leader changed bootstrap queue1 values or MVCC identity")
			}
			f.trace.releaseWallet()
			f.join(t, lag)
			if conflict {
				r := lag.recruit
				if r.outcome != recruitKnownEnded || r.cause != march.ErrRecruitConflict || r.cleanup != nil ||
					r.diagnostic != nil || r.confirmed != (march.RecruitAcceptance{}) {
					t.Fatal("changed intent did not end as an exact clean conflict", r)
				}
			} else {
				recruitAttemptPGConfirmed(t, lag.recruit)
				if lag.recruit.confirmed != accepted {
					t.Fatal("concurrent duplicate changed immutable acceptance", lag.recruit, accepted)
				}
			}
			recruitAttemptPGRecorded(t, f.events(leader), f.observer, f.recruit.s.profile, false)
			history := f.events(follower)
			end := "commit"
			if conflict {
				end = "rollback"
			}
			valid := func(events []returnPGQuery) bool {
				return recruitSerialHistoryValid(events, follower, f.observer.PgConn().PID(), f.recruit.s.profile, end)
			}
			if !valid(history) {
				t.Fatal("follower was not exactly one history-only transaction", history)
			}
			// These controls operate on this actual trace, never a synthesized pass.
			bad := append([]returnPGQuery(nil), history...)
			bad = append(bad, returnPGQuery{sql: "SELECT 1", pid: follower})
			if valid(bad) || valid(history[1:]) || valid(history[:len(history)-1]) {
				t.Fatal("unknown SQL or missing transaction boundary passed history checker")
			}
			bad = append([]returnPGQuery(nil), history...)
			for i, event := range bad {
				if stage, _ := recruitAttemptPGStage(event.sql, f.recruit.s.profile); stage == "find" {
					bad = append(bad[:i], bad[i+1:]...)
					break
				}
			}
			if valid(bad) {
				t.Fatal("missing post-wallet Find passed history checker")
			}
			recruitSerialState(t, f.recruit, 0)
			if !reflect.DeepEqual(checkpoint, returnPGSnapshot(t, f.ctx, f.observer, f.profile)) ||
				queueOne != recruitReturnQueueOne(t, f) {
				t.Fatal("follower changed rows, MVCC identities, queue1 or allocator state")
			}
			offset := len(f.trace.events())
			replayed := f.recruit.admit(f.ctx, 1, f.scope, original)
			recruitAttemptPGConfirmed(t, replayed)
			if replayed.confirmed != accepted {
				t.Fatal("subsequent same-key replay changed immutable acceptance", replayed)
			}
			recruitAttemptPGRecorded(t, f.trace.events()[offset:], f.observer, f.recruit.s.profile, true)
			recruitSerialState(t, f.recruit, 0)
			if !reflect.DeepEqual(checkpoint, returnPGSnapshot(t, f.ctx, f.observer, f.profile)) {
				t.Fatal("subsequent replay changed rows or sequence last_value/log_cnt/is_called")
			}
			recruitPGReleased(t, f.ctx, f.observer, f.recruit.s.profile)
		})
	}
}

func recruitSerialActorLocks(t *testing.T, f *recruitReturnPG) {
	t.Helper()
	for _, row := range []struct{ table, predicate string }{
		{"account", "account_id=1"}, {"player", "server_id=1 AND player_id=1"},
	} {
		returnPGExec(t, f.ctx, f.observer, "BEGIN")
		_, err := f.observer.Exec(f.ctx, "SELECT 1 FROM "+pgx.Identifier{f.profile.SchemaName, row.table}.Sanitize()+
			" WHERE "+row.predicate+" FOR UPDATE NOWAIT")
		clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
		_, rollback := f.observer.Exec(clean, "ROLLBACK")
		stop()
		returnPGOK(t, rollback)
		var pg *pgconn.PgError
		if !errors.As(err, &pg) || pg.Code != "55P03" {
			t.Fatal("actual leader did not retain its actor lock", row.table, err)
		}
	}
}

func recruitSerialState(t *testing.T, g *recruitGeneration, pending uint64) {
	t.Helper()
	g.s.mu.Lock()
	defer g.s.mu.Unlock()
	a := g.s.admission.s
	a.mu.Lock()
	defer a.mu.Unlock()
	if !g.s.attempted || g.s.closed || a.closed || g.s.bundle == nil ||
		a.pending != pending || uint64(len(g.s.attempts)) != pending {
		t.Fatal("resolved/live Recruit attempts or admission state mismatched", g.s.closed, a.closed, a.pending, len(g.s.attempts))
	}
}

func recruitSerialChanges(t *testing.T, before, after map[string]string, committed bool) {
	t.Helper()
	changed := map[string]bool{"work_queue_id_seq": true, "player_wallet": committed,
		"work_queue": committed, "mil_recruit_origin": committed, "mil_recruit_receipt": committed}
	if len(before) != len(after) {
		t.Fatal("fixture relation inventory changed")
	}
	for name, old := range before {
		if (old != after[name]) != changed[name] {
			t.Fatal("unexpected changed row/identity/sequence at commit boundary", name, committed)
		}
	}
}

// Closed history-only trace, including the exact business-conflict rollback.
// Metadata reads are permitted only inside the transaction and no error is hidden.
func recruitSerialHistoryValid(events []returnPGQuery, pid, observer uint32, p freshsource.Profile, end string) bool {
	if pid == 0 || pid == observer || end != "commit" && end != "rollback" {
		return false
	}
	want := []string{"begin isolation level read committed"}
	for _, name := range recruitPGPinNames {
		want = append(want, "pin:"+name)
	}
	want = append(want, strings.Fields("account-proof actor player wallet-proof wallet military-proof find military-proof history-job history-receipt history-origin")...)
	want = append(want, end)
	var got []string
	metadata := 0
	for _, event := range events {
		if event.pid != pid || event.err != nil {
			return false
		}
		stage, ok := recruitAttemptPGStage(event.sql, p)
		if event.sql == "rollback" {
			stage, ok = "rollback", true
		}
		if !ok {
			return false
		}
		if stage == "metadata" {
			if len(got) == 0 || got[len(got)-1] == "commit" || got[len(got)-1] == "rollback" {
				return false
			}
			metadata++
			continue
		}
		got = append(got, stage)
	}
	return metadata > 0 && reflect.DeepEqual(got, want)
}
