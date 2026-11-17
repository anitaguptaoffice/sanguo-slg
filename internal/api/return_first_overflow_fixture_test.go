package api

import (
	"fmt"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
)

func returnOverflowOrder() []string {
	order := recruitReturnSQLOrder(false)
	order[len(order)-1] = "clock"
	return append(order, "rollback")
}

func returnOverflowRecorded(events []returnPGQuery, observer uint32, set map[string]string) error {
	order := returnOverflowOrder()
	if len(order) != 77 || len(events) != len(order) {
		return fmt.Errorf("overflow SQL count differs")
	}
	for i, q := range events {
		want := set[order[i]]
		if order[i] == "rollback" {
			want = "rollback"
		}
		if want == "" || q.sql != want || q.err != nil || q.pid == 0 || q.pid == observer || q.pid != events[0].pid {
			return fmt.Errorf("overflow query %d differs", i)
		}
	}
	return nil
}

func returnOverflowEnded(q []recruitReturnObservedQuery, fault bool, pid uint32, conn *pgx.Conn) error {
	if fault || len(q) != 1 || conn == nil || pid == 0 {
		return fmt.Errorf("overflow rollback inventory differs")
	}
	x := q[0]
	if x.conn != conn || x.pid != pid || x.sql != "rollback" || len(x.args) != 0 || !x.ended || x.err != nil || x.tag != "ROLLBACK" {
		return fmt.Errorf("overflow rollback End differs")
	}
	return nil
}

func TestReturnOverflowSQLWitness(t *testing.T) {
	p := freshsource.Profile{SchemaName: `overflow_"Q`}
	set := recruitReturnSQLSet(t, p)
	var valid []returnPGQuery
	for _, stage := range returnOverflowOrder() {
		sql := set[stage]
		if stage == "rollback" {
			sql = "rollback"
		}
		valid = append(valid, returnPGQuery{sql: sql, pid: 17})
	}
	returnPGOK(t, returnOverflowRecorded(valid, 7, set))
	reject := func(events []returnPGQuery) {
		t.Helper()
		if returnOverflowRecorded(events, 7, set) == nil {
			t.Fatal("invalid rejection SQL accepted")
		}
	}
	for i := range valid {
		reject(append(append([]returnPGQuery(nil), valid[:i]...), valid[i+1:]...))
		reject(append(append([]returnPGQuery(nil), valid[:i+1]...), valid[i:]...))
		for j := range valid {
			if valid[i].sql != valid[j].sql {
				bad := append([]returnPGQuery(nil), valid...)
				bad[i], bad[j] = bad[j], bad[i]
				reject(bad)
			}
		}
		for _, mutate := range []func(*returnPGQuery){
			func(q *returnPGQuery) { q.sql += "; SELECT 1" }, func(q *returnPGQuery) { q.sql += "\n" },
			func(q *returnPGQuery) { q.sql = set["evidence"] }, func(q *returnPGQuery) { q.sql = set["return-credit"] },
			func(q *returnPGQuery) { q.sql = "commit" }, func(q *returnPGQuery) { q.pid = 0 },
			func(q *returnPGQuery) { q.pid = 7 }, func(q *returnPGQuery) { q.pid = 18 },
			func(q *returnPGQuery) { q.err = fmt.Errorf("injected query error") },
		} {
			bad := append([]returnPGQuery(nil), valid...)
			mutate(&bad[i])
			reject(bad)
		}
		qualified := pgx.Identifier{p.SchemaName}.Sanitize() + "."
		if strings.Contains(valid[i].sql, qualified) {
			for _, other := range []string{"", `"other".`} {
				bad := append([]returnPGQuery(nil), valid...)
				bad[i].sql = strings.ReplaceAll(bad[i].sql, qualified, other)
				reject(bad)
			}
		}
	}
	conn := new(pgx.Conn) // Opaque protocol identities, never business evidence.
	end := recruitReturnObservedQuery{conn: conn, pid: 17, sql: "rollback", tag: "ROLLBACK", ended: true}
	returnPGOK(t, returnOverflowEnded([]recruitReturnObservedQuery{end}, false, 17, conn))
	for _, q := range [][]recruitReturnObservedQuery{nil, {end, end}} {
		if returnOverflowEnded(q, false, 17, conn) == nil {
			t.Fatal("missing/duplicate rollback End accepted")
		}
	}
	for _, mutate := range []func(*recruitReturnObservedQuery){
		func(q *recruitReturnObservedQuery) { q.conn = new(pgx.Conn) }, func(q *recruitReturnObservedQuery) { q.pid = 18 },
		func(q *recruitReturnObservedQuery) { q.sql = "commit" }, func(q *recruitReturnObservedQuery) { q.tag = "COMMIT" },
		func(q *recruitReturnObservedQuery) { q.args = []any{1} }, func(q *recruitReturnObservedQuery) { q.ended = false },
		func(q *recruitReturnObservedQuery) { q.err = fmt.Errorf("rollback failed") },
	} {
		bad := end
		mutate(&bad)
		if returnOverflowEnded([]recruitReturnObservedQuery{bad}, false, 17, conn) == nil {
			t.Fatal("invalid rollback End accepted")
		}
	}
	if returnOverflowEnded([]recruitReturnObservedQuery{end}, true, 17, conn) == nil {
		t.Fatal("recorder fault accepted")
	}
}
