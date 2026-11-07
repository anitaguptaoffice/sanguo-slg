package api

import (
	"errors"
	"fmt"
	"math"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
)

func TestPGRecruitReturnInteroperability(t *testing.T) {
	for _, tc := range []struct {
		name                  string
		ready                 int32
		recruitFirst, applied bool
	}{
		{"real pending exact capacity", math.MaxInt32 - 9, true, true},
		{"real pending prevents overflow", math.MaxInt32 - 8, true, false},
		{"return credit prevents new recruit", math.MaxInt32 - 8, false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newRecruitReturnPG(t, tc.ready)
			queueOne := recruitReturnQueueOne(t, f)
			before, stable := snapshotReturnAttemptPG(t, f.returnAttemptPG, false), snapshotReturnAttemptPG(t, f.returnAttemptPG, true)
			lead := f.start(tc.recruitFirst)
			leader := returnLifetimeReached(t, f.trace.returnLifetimeTrace)
			f.locked(t)
			visible := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
			for name, old := range before {
				if name != "work_queue_id_seq" && visible[name] != old {
					t.Fatal("uncommitted business effects visible", name)
				}
			}
			f.trace.pauseWallet = true // Leader is stopped at COMMIT; its wallet read ended before this write.
			lag := f.start(!tc.recruitFirst)
			follower := f.waitWallet(t, leader)
			f.trace.release()
			f.join(t, lead)
			if tc.recruitFirst {
				recruitAttemptPGConfirmed(t, lead.recruit)
			} else {
				returnAttemptConfirmed(t, f.returnAttemptPG, lead.returned, march.ReturnApplied, f.due)
			}
			select {
			case <-f.trace.walletReached:
			case <-f.ctx.Done():
				t.Fatal("follower did not acquire the released wallet")
			}
			checkpoint := snapshotReturnAttemptPG(t, f.returnAttemptPG, tc.recruitFirst && tc.applied)
			f.trace.releaseWallet()
			f.join(t, lag)
			if !reflect.DeepEqual(checkpoint, snapshotReturnAttemptPG(t, f.returnAttemptPG, tc.recruitFirst && tc.applied)) {
				t.Fatal("follower changed rows beyond its allowed Return credit, or failed rollback")
			}
			recruitCall, returnCall := lead, lag
			recruitPID, returnPID := leader, follower
			if !tc.recruitFirst {
				recruitCall, returnCall = lag, lead
				recruitPID, returnPID = follower, leader
			}
			if tc.recruitFirst {
				recruitAttemptPGConfirmed(t, recruitCall.recruit)
				recruitAttemptPGRecorded(t, f.events(recruitPID), f.observer, f.recruit.s.profile, false)
			} else {
				r := recruitCall.recruit
				if r.outcome != recruitKnownEnded || !errors.Is(r.cause, march.ErrRecruitUnavailable) || r.confirmed != (march.RecruitAcceptance{}) || r.cleanup != nil || r.diagnostic != nil {
					t.Fatal("capacity rejection is not known-ended", r)
				}
				recruitReturnRejectionRecorded(t, f.events(recruitPID), recruitPID, f.observer.PgConn().PID(), f.recruit.s.profile)
				returnAttemptTrace(t, f.returnAttemptPG, f.events(recruitPID), false, 0)
			}
			if tc.applied {
				returnAttemptConfirmed(t, f.returnAttemptPG, returnCall.returned, march.ReturnApplied, f.due)
			} else if r := returnCall.returned; r.outcome != returnKnownEnded || !errors.Is(r.cause, march.ErrReturnUnavailable) || r.confirmed != (march.ReturnObservation{}) || r.cleanup != nil || r.diagnostic != nil {
				t.Fatal("pending capacity rejection changed outcome", r)
			}
			returnAttemptTrace(t, f.returnAttemptPG, f.events(returnPID), tc.applied, 1)
			returnAttemptClean(t, f.returnAttemptPG)
			f.recruit.s.mu.Lock()
			closed, records := f.recruit.s.closed, len(f.recruit.s.attempts)
			f.recruit.s.mu.Unlock()
			f.recruit.s.admission.s.mu.Lock()
			pending := f.recruit.s.admission.s.pending
			f.recruit.s.admission.s.mu.Unlock()
			if closed == tc.recruitFirst || records != map[bool]int{true: 0, false: 1}[tc.recruitFirst] || pending != 0 {
				t.Fatal("Recruit generation outcome bookkeeping", closed, records, pending)
			}
			recruitReturnEffects(t, f, tc.ready, tc.applied, tc.recruitFirst, recruitCall.recruit.confirmed)
			if queueOne != recruitReturnQueueOne(t, f) {
				t.Fatal("original queue1 values or row identity changed")
			}
			after, retained := snapshotReturnAttemptPG(t, f.returnAttemptPG, false), snapshotReturnAttemptPG(t, f.returnAttemptPG, true)
			if len(before) != len(after) {
				t.Fatal("relation inventory changed")
			}
			changed := map[string]bool{"city_troop": tc.applied, "march_order": tc.applied, "field_army": tc.applied,
				"player_wallet": tc.recruitFirst, "work_queue": tc.recruitFirst, "mil_recruit_origin": tc.recruitFirst, "mil_recruit_receipt": tc.recruitFirst, "work_queue_id_seq": tc.recruitFirst}
			for name, old := range before {
				if (old != after[name]) != changed[name] {
					t.Fatal("unexpected changed relation", name)
				}
				if name != "player_wallet" && name != "work_queue" && name != "mil_recruit_origin" && name != "mil_recruit_receipt" && name != "work_queue_id_seq" && stable[name] != retained[name] {
					t.Fatal("retained evidence changed", name)
				}
			}
			if tc.recruitFirst {
				offset := len(f.trace.events())
				r := f.recruit.admit(f.ctx, 1, f.scope, f.intent)
				recruitAttemptPGConfirmed(t, r)
				if r.confirmed != recruitCall.recruit.confirmed {
					t.Fatal("History changed acceptance", r)
				}
				recruitAttemptPGRecorded(t, f.trace.events()[offset:], f.observer, f.recruit.s.profile, true)
			}
			if tc.applied {
				offset := len(f.trace.events())
				returnAttemptConfirmed(t, f.returnAttemptPG, f.generation.complete(f.ctx, f.candidate), march.ReturnCreditedTerminal, f.due)
				returnAttemptTrace(t, f.returnAttemptPG, f.trace.events()[offset:], true, 0)
			}
			if !reflect.DeepEqual(after, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
				t.Fatal("historical retry mutated a row, row identity or allocator")
			}
		})
	}
}

func recruitReturnEffects(t *testing.T, f *recruitReturnPG, ready int32, applied, admitted bool, a march.RecruitAcceptance) {
	t.Helper()
	wantReady, marchStatus, armyStatus, x, y := []int32{ready, 12, 13, 14}, 3, 2, 1, 1
	if applied {
		wantReady, marchStatus, armyStatus, x, y = []int32{ready + 7, 20, 19, 23}, 4, 1, 0, 0
	}
	var stock []int32
	var exact bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop").Scan(&stock))
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT m.status=$1 AND a.status=$2 AND a.x=$3 AND a.y=$4 FROM march_order m,field_army a`, marchStatus, armyStatus, x, y).Scan(&exact))
	if !exact || !reflect.DeepEqual(stock, wantReady) {
		t.Fatal("wrong Return credit or terminal state", stock, exact)
	}
	if !admitted {
		return // Whole-relation snapshots require wallet/job/origin/receipt/sequence unchanged.
	}
	if a.QueueID != 100 || a.CityID != 1 || a.UnitCfgID != 1 || a.Count != 2 ||
		a.Cost != (march.Resources{Food: 4, Wood: 6, Iron: 10, Stone: 14}) || a.DurationSeconds != 22 ||
		a.CatalogVersion != recruitAttemptPGVersion || fmt.Sprintf("%x", a.RuleDigest) != recruitAttemptPGDigest ||
		a.InitialStatus != 1 || a.AcceptedAt.IsZero() || a.AcceptedAt.Location() != time.UTC ||
		a.AcceptedAt.Nanosecond()%1000000 != 0 || a.InitialStartAt != a.AcceptedAt ||
		a.InitialFinishAt != a.InitialStartAt.Add(22*time.Second) {
		t.Fatal("unexpected immutable acceptance", a)
	}
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT
(SELECT ARRAY[food,wood,iron,stone,gold] FROM player_wallet WHERE server_id=1 AND player_id=1)=ARRAY[96,194,290,386,500]::bigint[]
AND (SELECT count(*) FROM work_queue)=2 AND (SELECT count(*) FROM work_queue WHERE queue_type=3)=1
AND (SELECT count(*) FROM mil_recruit_origin)=1 AND (SELECT count(*) FROM mil_recruit_receipt)=1
AND (SELECT last_value=100 AND is_called FROM work_queue_id_seq)
AND EXISTS(SELECT FROM work_queue q JOIN mil_recruit_origin o USING(server_id,queue_id) JOIN mil_recruit_receipt r USING(server_id,queue_id)
WHERE q.server_id=1 AND q.queue_id=100 AND q.player_id=1 AND q.city_id=1 AND q.queue_type=3 AND q.status=1
AND o.player_id=1 AND o.operation=1 AND o.command_id=decode('09000000000000000000000000000000','hex')
AND r.intent_version=1 AND r.city_id=1 AND r.unit_cfg_id=1 AND r.count=2
AND ARRAY[r.food_paid,r.wood_paid,r.iron_paid,r.stone_paid]=ARRAY[4,6,10,14]::bigint[] AND r.duration_sec=22
AND r.catalog_version=convert_to($1,'UTF8') AND encode(r.rule_digest,'hex')=$2 AND r.initial_status=1
AND r.accepted_at=$3 AND r.initial_start_at=$3 AND r.initial_finish_at=$4 AND r.accepted_at<=clock_timestamp()
AND q.start_at=r.initial_start_at AND q.finish_at=r.initial_finish_at
AND q.payload=jsonb_build_object('v',1,'unit_cfg_id',1,'count',2,'cost_paid',jsonb_build_object('food',4,'wood',6,'iron',10,'stone',14),
'duration_sec',22,'catalog_version',$1::text,'rule_digest',$2::text))`, recruitAttemptPGVersion, recruitAttemptPGDigest, a.AcceptedAt, a.InitialFinishAt).Scan(&exact))
	if !exact {
		t.Fatal("independent paid job/origin/receipt/allocator evidence differs")
	}
}

func recruitReturnQueueOne(t *testing.T, f *recruitReturnPG) string {
	t.Helper()
	var row string
	returnPGOK(t, f.observer.QueryRow(f.ctx,
		"SELECT jsonb_build_array(q,q.xmin::text,q.ctid::text)::text FROM "+pgx.Identifier{f.profile.SchemaName, "work_queue"}.Sanitize()+
			" q WHERE server_id=1 AND queue_id=1").Scan(&row))
	return row
}

// Closed successful-prefix evidence: a generic unavailable result alone does
// not establish that the real call reached WORLD and the complete capacity read.
func recruitReturnRejectionValid(events []returnPGQuery, pid, observer uint32, p freshsource.Profile) bool {
	if pid == 0 || pid == observer {
		return false
	}
	want := []string{"begin isolation level read committed"}
	for _, name := range recruitPGPinNames {
		want = append(want, "pin:"+name)
	}
	want = append(want, strings.Fields("account-proof actor player wallet-proof wallet military-proof find military-proof reverse city-proof city military-proof marker stock pending rollback")...)
	var got []string
	metadata := 0
	for _, q := range events {
		if q.pid != pid || q.err != nil {
			return false
		}
		stage, ok := recruitAttemptPGStage(q.sql, p)
		if q.sql == "rollback" {
			stage, ok = "rollback", true // Exact complete byte string only.
		}
		if !ok {
			return false
		}
		if stage == "metadata" {
			if len(got) == 0 || got[len(got)-1] == "rollback" {
				return false
			}
			metadata++
			continue
		}
		got = append(got, stage)
	}
	return metadata > 0 && reflect.DeepEqual(got, want)
}

func recruitReturnRejectionRecorded(t *testing.T, events []returnPGQuery, pid, observer uint32, p freshsource.Profile) {
	t.Helper()
	if !recruitReturnRejectionValid(events, pid, observer, p) {
		t.Fatal("rejected Recruit did not execute the exact closed capacity-check path")
	}
	// Mutate the actual successful trace as test data, never execute these SQL strings.
	for _, sql := range []string{"SELECT 1", "rollback; SELECT 1"} {
		bad := append([]returnPGQuery(nil), events[:len(events)-1]...)
		bad = append(bad, returnPGQuery{sql: sql, pid: pid}, events[len(events)-1])
		if recruitReturnRejectionValid(bad, pid, observer, p) {
			t.Fatal("rejection witness accepted unknown/suffixed SQL", sql)
		}
	}
	world, pending := -1, -1
	for i, q := range events {
		stage, _ := recruitAttemptPGStage(q.sql, p)
		if stage == "city" {
			world = i
		}
		if stage == "pending" {
			pending = i
		}
	}
	if world < 0 || pending < 0 {
		t.Fatal("negative witness checks lack their real WORLD/pending stages")
	}
	for _, missing := range []int{world, pending} {
		bad := append([]returnPGQuery(nil), events[:missing]...)
		bad = append(bad, events[missing+1:]...)
		if recruitReturnRejectionValid(bad, pid, observer, p) {
			t.Fatal("rejection witness accepted a missing WORLD/capacity stage", missing)
		}
	}
	bad := append([]returnPGQuery(nil), events...)
	bad[world], bad[pending] = bad[pending], bad[world]
	if recruitReturnRejectionValid(bad, pid, observer, p) {
		t.Fatal("rejection witness accepted reordered WORLD/capacity stages")
	}
}
