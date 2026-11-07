package api

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

func returnAttemptConfirmed(t *testing.T, f *returnAttemptPG, result returnAttemptResult, want march.ReturnDisposition, due time.Time) {
	t.Helper()
	if result.outcome != returnConfirmed || result.cause != nil || result.cleanup != nil || result.diagnostic != nil ||
		result.confirmed != (march.ReturnObservation{Candidate: f.candidate, Disposition: want, ReturnAt: due}) {
		t.Fatal("unconfirmed or incorrect result", result)
	}
	if !due.IsZero() && (result.confirmed.ReturnAt.Location() != time.UTC || result.confirmed.ReturnAt.Nanosecond() != 123456000) {
		t.Fatal("retained UTC microseconds changed", result.confirmed)
	}
}

func returnAttemptClean(t *testing.T, f *returnAttemptPG) {
	t.Helper()
	s := f.generation.s
	s.mu.Lock()
	retained, closed := len(s.attempts), s.closed
	s.mu.Unlock()
	s.admission.s.mu.Lock()
	pending := s.admission.s.pending
	s.admission.s.mu.Unlock()
	if retained != 0 || closed || pending != 0 {
		t.Fatal("resolved attempt leaked or closed generation", retained, closed, pending)
	}
}

func returnAttemptTrace(t *testing.T, f *returnAttemptPG, events []returnPGQuery, committed bool, clocks int) {
	t.Helper()
	begin, commit, rollback, sampled := 0, 0, 0, 0
	var pid uint32
	for _, q := range events {
		if pid == 0 {
			pid = q.pid
		}
		if q.pid != pid || q.pid == f.observer.PgConn().PID() || q.err != nil {
			t.Fatal("unexpected connection or SQL failure", q)
		}
		sql := strings.ToLower(strings.TrimSpace(q.sql))
		switch sql {
		case "begin isolation level read committed":
			begin++
		case "commit":
			commit++
		case "rollback":
			rollback++
		case "select pg_catalog.clock_timestamp()":
			sampled++
		}
		if strings.Contains(sql, "nextval(") || strings.Contains(sql, "setval(") {
			t.Fatal("return allocated or reset a sequence", sql)
		}
	}
	wantCommit, wantRollback := 0, 1
	if committed {
		wantCommit, wantRollback = 1, 0
	}
	if begin != 1 || commit != wantCommit || rollback != wantRollback || sampled != clocks {
		t.Fatal("outer transaction or clock count", begin, commit, rollback, sampled)
	}
	t.Logf("APP backend=%d independent observer=%d commit=%d rollback=%d", pid, f.observer.PgConn().PID(), commit, rollback)
}

func TestPGReturnAttemptDueAndPendingCapacity(t *testing.T) {
	for _, tc := range []struct {
		name  string
		ready int32
		want  int32
	}{
		{"due", 11, 18},
		{"exact capacity including pending", 2147483636, 2147483643},
		{"ready plus survivors fits but pending overflows", 2147483640, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			trace := new(returnPGTrace)
			f := newReturnAttemptPG(t, trace)
			returnAttemptPending(t, f)
			_, err := f.observer.Exec(f.ctx, "UPDATE city_troop SET count=$1 WHERE unit_cfg_id=1", tc.ready)
			returnPGOK(t, err)
			before, stable := snapshotReturnAttemptPG(t, f, false), snapshotReturnAttemptPG(t, f, true)
			offset := len(trace.events())
			result := f.generation.complete(f.ctx, f.candidate)
			returnAttemptTrace(t, f, trace.events()[offset:], tc.want != 0, 1)
			returnAttemptClean(t, f)
			if tc.want == 0 {
				if result.outcome != returnKnownEnded || result.confirmed != (march.ReturnObservation{}) ||
					!errors.Is(result.cause, march.ErrReturnUnavailable) || result.cleanup != nil || result.diagnostic != nil {
					t.Fatal("capacity rejection outcome", result)
				}
				if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
					t.Fatal("capacity rollback changed persisted state")
				}
				return
			}
			returnAttemptConfirmed(t, f, result, march.ReturnApplied, f.due)
			var ready, wounded []int32
			var marchStatus, armyStatus, x, y int32
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(count ORDER BY unit_cfg_id),array_agg(wounded ORDER BY unit_cfg_id) FROM city_troop").Scan(&ready, &wounded))
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT m.status,a.status,a.x,a.y FROM march_order m,field_army a").Scan(&marchStatus, &armyStatus, &x, &y))
			if !reflect.DeepEqual(ready, []int32{tc.want, 20, 19, 23}) || !reflect.DeepEqual(wounded, []int32{2147483647, 2147483647, 2147483647, 2147483647}) ||
				marchStatus != 4 || armyStatus != 1 || x != 0 || y != 0 || !reflect.DeepEqual(stable, snapshotReturnAttemptPG(t, f, true)) {
				t.Fatal("committed credit/terminal or retained graph", ready, wounded, marchStatus, armyStatus, x, y)
			}
			// Historical terminal does not validate current pending admission/capacity.
			returnPGExec(t, f.ctx, f.observer, `UPDATE work_queue SET payload='{"v":0}' WHERE queue_id=40; UPDATE city_troop SET count=2147483647`)
			before, offset = snapshotReturnAttemptPG(t, f, false), len(trace.events())
			returnAttemptConfirmed(t, f, f.generation.complete(f.ctx, f.candidate), march.ReturnCreditedTerminal, f.due)
			returnAttemptTrace(t, f, trace.events()[offset:], true, 0)
			returnAttemptClean(t, f)
			if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
				t.Fatal("duplicate terminal changed rows or sequences")
			}
		})
	}
}

func TestPGReturnAttemptReadOnlyStates(t *testing.T) {
	for _, tc := range []struct {
		name, sql string
		want      march.ReturnDisposition
		due       time.Time
		clocks    int
	}{
		{"early", "UPDATE march_order SET return_finish_at='2999-01-02 03:05:05.123456+00'", march.ReturnEarly, time.Date(2999, 1, 2, 3, 5, 5, 123456000, time.UTC), 1},
		{"annihilation", "UPDATE march_order SET status=4,return_finish_at=NULL; UPDATE field_army SET status=1; DELETE FROM army_troop", march.ReturnAnnihilatedTerminal, time.Time{}, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			trace := new(returnPGTrace)
			f := newReturnAttemptPG(t, trace)
			returnAttemptPending(t, f)
			returnPGExec(t, f.ctx, f.observer, tc.sql+`; UPDATE work_queue SET payload='{"v":0}' WHERE queue_id=40; UPDATE city_troop SET count=2147483647`)
			before := snapshotReturnAttemptPG(t, f, false)
			for i := 0; i < 2; i++ {
				offset := len(trace.events())
				returnAttemptConfirmed(t, f, f.generation.complete(f.ctx, f.candidate), tc.want, tc.due)
				returnAttemptTrace(t, f, trace.events()[offset:], true, tc.clocks)
				returnAttemptClean(t, f)
				if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
					t.Fatal("read-only outcome changed retained rows or sequences")
				}
			}
		})
	}
}
