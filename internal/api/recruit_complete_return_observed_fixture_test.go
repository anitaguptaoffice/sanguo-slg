package api

import (
	"context"
	"fmt"
	"reflect"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type recruitReturnObservedQuery struct {
	conn  *pgx.Conn
	pid   uint32
	sql   string
	args  []any
	tag   string
	ended bool
	err   error
}

type recruitReturnObservedTrace struct {
	inner   pgx.QueryTracer
	credit  string
	mu      sync.Mutex
	queries []recruitReturnObservedQuery
	fault   bool
}

type recruitReturnObservedKey struct{ owner *recruitReturnObservedTrace }

func (r *recruitReturnObservedTrace) TraceQueryStart(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	ctx = r.inner.TraceQueryStart(ctx, c, d) // No recorder lock across inner gates.
	at := -1
	r.mu.Lock()
	if d.SQL == r.credit || d.SQL == "commit" {
		at = len(r.queries)
		r.queries = append(r.queries, recruitReturnObservedQuery{conn: c, pid: c.PgConn().PID(), sql: d.SQL, args: append([]any(nil), d.Args...)})
	}
	r.mu.Unlock()
	return context.WithValue(ctx, recruitReturnObservedKey{r}, at)
}

func (r *recruitReturnObservedTrace) TraceQueryEnd(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryEndData) {
	r.inner.TraceQueryEnd(ctx, c, d)
	r.mu.Lock()
	defer r.mu.Unlock()
	at, ok := ctx.Value(recruitReturnObservedKey{r}).(int)
	if !ok || at < -1 || at >= len(r.queries) {
		r.fault = true
		return
	}
	if at == -1 {
		return
	}
	q := &r.queries[at]
	if q.ended || q.conn != c {
		r.fault = true
		return // Never replace the first end with a later apparently valid result.
	}
	q.ended, q.tag, q.err = true, d.CommandTag.String(), d.Err
}

func (r *recruitReturnObservedTrace) snapshot() ([]recruitReturnObservedQuery, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := append([]recruitReturnObservedQuery(nil), r.queries...)
	for i := range out {
		out[i].args = append([]any(nil), out[i].args...)
	}
	return out, r.fault
}

func recruitReturnObservedRecorded(q []recruitReturnObservedQuery, fault bool, observer uint32, credit string, want [][]any) error {
	if fault || len(q) != len(want)+1 {
		return fmt.Errorf("selected event count or recorder fault")
	}
	for i, v := range q {
		sql, tag := "commit", "COMMIT"
		argsOK := len(v.args) == 0
		if i < len(want) {
			sql, tag, argsOK = credit, "UPDATE 1", reflect.DeepEqual(v.args, want[i])
		}
		if v.conn == nil || v.conn != q[0].conn || v.pid == 0 || v.pid == observer || v.pid != q[0].pid ||
			!v.ended || v.err != nil || v.sql != sql || v.tag != tag || !argsOK {
			return fmt.Errorf("selected credit/end mismatch at %d", i)
		}
	}
	return nil
}

func recruitReturnObservedWant() [][]any {
	return [][]any{
		{int32(1), int64(1), int32(1), int64(20), int64(13), int64(2147483647)},
		{int32(1), int64(1), int32(2), int64(20), int64(12), int64(2147483647)},
		{int32(1), int64(1), int32(3), int64(19), int64(13), int64(2147483647)},
		{int32(1), int64(1), int32(4), int64(23), int64(14), int64(2147483647)},
	}
}

func (r *recruitReturnObservedTrace) check(t *testing.T, f *recruitCompleteReturnPG, selected, full int, want [][]any) {
	t.Helper()
	q, fault := r.snapshot()
	q = q[selected:]
	returnPGOK(t, recruitReturnObservedRecorded(q, fault, f.observer.PgConn().PID(), r.credit, want))
	pid, c := q[0].pid, q[0].conn
	owned := f.owned.get(pid)
	if pid != f.trace.events()[full].pid || c.PgConn().PID() != pid || owned == nil || owned.transport != c.PgConn().Conn() {
		t.Fatal("selected trace is not the actual call's captured original transport")
	}
	f.owned.noLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
}

// Passive protocol spy. These control callbacks never execute supplied SQL.
type recruitReturnForward struct {
	starts, ends int
	sql, tags    []string
	args         [][]any
	errors       []error
}
type recruitReturnForwardKey struct{}
type recruitReturnCallerKey struct{}

func (s *recruitReturnForward) TraceQueryStart(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	s.starts++
	s.sql, s.args = append(s.sql, d.SQL), append(s.args, d.Args)
	return context.WithValue(ctx, recruitReturnForwardKey{}, c)
}
func (s *recruitReturnForward) TraceQueryEnd(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryEndData) {
	if ctx.Value(recruitReturnForwardKey{}) == c {
		s.ends++
		s.tags = append(s.tags, d.CommandTag.String())
		s.errors = append(s.errors, d.Err)
	}
}

func recruitReturnObservedControls(t *testing.T, f *recruitCompleteReturnPG) {
	t.Helper()
	held, err := f.pool.Acquire(f.ctx)
	returnPGOK(t, err)
	defer held.Release()
	c := held.Conn() // Real connection identity; isolated records, no business evidence.
	spy := new(recruitReturnForward)
	r := &recruitReturnObservedTrace{inner: spy, credit: "credit"}
	args := []any{int32(1)}
	caller := context.WithValue(f.ctx, recruitReturnCallerKey{}, 42)
	a := r.TraceQueryStart(caller, c, pgx.TraceQueryStartData{SQL: "credit", Args: args})
	b := r.TraceQueryStart(f.ctx, c, pgx.TraceQueryStartData{SQL: "commit"})
	args[0] = int32(9)
	r.TraceQueryEnd(b, c, pgx.TraceQueryEndData{CommandTag: pgconn.NewCommandTag("COMMIT")})
	r.TraceQueryEnd(a, c, pgx.TraceQueryEndData{CommandTag: pgconn.NewCommandTag("UPDATE 1")})
	q, fault := r.snapshot()
	if fault || len(q) != 2 || q[0].args[0] != int32(1) || q[0].tag != "UPDATE 1" || q[1].tag != "COMMIT" || !q[0].ended || !q[1].ended {
		t.Fatal("Start copy or immutable out-of-order End token failed")
	}
	q[0].args[0] = int32(8)
	q, _ = r.snapshot()
	if q[0].args[0] != int32(1) {
		t.Fatal("snapshot arguments alias retained evidence")
	}
	unselected := r.TraceQueryStart(a, c, pgx.TraceQueryStartData{SQL: "unselected"})
	r.TraceQueryEnd(unselected, c, pgx.TraceQueryEndData{})
	q, fault = r.snapshot()
	if fault || len(q) != 2 || spy.starts != 3 || spy.ends != 3 || a.Value(recruitReturnCallerKey{}) != 42 ||
		!reflect.DeepEqual(spy.sql, []string{"credit", "commit", "unselected"}) ||
		!reflect.DeepEqual(spy.tags, []string{"COMMIT", "UPDATE 1", ""}) || spy.args[0][0] != int32(9) {
		t.Fatal("unselected forwarding/context preservation failed")
	}
	for _, ctx := range []context.Context{a, f.ctx, context.WithValue(f.ctx, recruitReturnObservedKey{r}, 99)} {
		r.TraceQueryEnd(ctx, c, pgx.TraceQueryEndData{CommandTag: pgconn.NewCommandTag("ROLLBACK")})
		q, fault = r.snapshot()
		if !fault || q[0].tag != "UPDATE 1" {
			t.Fatal("duplicate/missing/malformed End token accepted or overwritten")
		}
		r.fault = false // Isolated, joined protocol control only.
	}
	other := &recruitReturnObservedTrace{inner: spy, credit: "credit"}
	foreign := other.TraceQueryStart(f.ctx, c, pgx.TraceQueryStartData{SQL: "commit"})
	r.TraceQueryEnd(foreign, c, pgx.TraceQueryEndData{})
	_, fault = r.snapshot()
	wrong := other.TraceQueryStart(f.ctx, c, pgx.TraceQueryStartData{SQL: "commit"})
	other.TraceQueryEnd(wrong, f.observer, pgx.TraceQueryEndData{})
	_, wrongFault := other.snapshot()
	if !fault || !wrongFault {
		t.Fatal("foreign token or wrong End connection accepted")
	}
	sentinel := fmt.Errorf("observer End sentinel")
	errorSpy := new(recruitReturnForward)
	errored := &recruitReturnObservedTrace{inner: errorSpy, credit: "credit"}
	errorCtx := errored.TraceQueryStart(f.ctx, c, pgx.TraceQueryStartData{SQL: "credit"})
	errored.TraceQueryEnd(errorCtx, c, pgx.TraceQueryEndData{CommandTag: pgconn.NewCommandTag("UPDATE 1"), Err: sentinel})
	q, fault = errored.snapshot()
	if fault || len(q) != 1 || !q[0].ended || q[0].tag != "UPDATE 1" || q[0].err != sentinel ||
		len(errorSpy.errors) != 1 || errorSpy.errors[0] != sentinel {
		t.Fatal("End error identity was flattened or not forwarded")
	}
}

func TestRecruitCompletionReturnObservedWitness(t *testing.T) {
	// Opaque equality tokens only; real callback controls use held PG connections.
	c, other := new(pgx.Conn), new(pgx.Conn)
	want := recruitReturnObservedWant()
	for _, credits := range [][][]any{nil, want} {
		var valid []recruitReturnObservedQuery
		for _, args := range credits {
			valid = append(valid, recruitReturnObservedQuery{conn: c, pid: 17, sql: "credit", args: args, tag: "UPDATE 1", ended: true})
		}
		valid = append(valid, recruitReturnObservedQuery{conn: c, pid: 17, sql: "commit", tag: "COMMIT", ended: true})
		returnPGOK(t, recruitReturnObservedRecorded(valid, false, 7, "credit", credits))
		reject := func(q []recruitReturnObservedQuery, bad bool) {
			t.Helper()
			if recruitReturnObservedRecorded(q, bad, 7, "credit", credits) == nil {
				t.Fatal("invalid selected stream accepted")
			}
		}
		reject(valid, true)
		for i := range valid {
			reject(append(append([]recruitReturnObservedQuery(nil), valid[:i]...), valid[i+1:]...), false)
			reject(append(append([]recruitReturnObservedQuery(nil), valid[:i+1]...), valid[i:]...), false)
			for _, mutate := range []func(*recruitReturnObservedQuery){
				func(q *recruitReturnObservedQuery) { q.conn = nil }, func(q *recruitReturnObservedQuery) { q.conn = other },
				func(q *recruitReturnObservedQuery) { q.pid = 0 }, func(q *recruitReturnObservedQuery) { q.pid = 7 },
				func(q *recruitReturnObservedQuery) { q.pid = 18 },
				func(q *recruitReturnObservedQuery) { q.ended = false }, func(q *recruitReturnObservedQuery) { q.err = fmt.Errorf("injected") },
				func(q *recruitReturnObservedQuery) { q.sql = "unknown" }, func(q *recruitReturnObservedQuery) { q.tag = "ROLLBACK" },
				func(q *recruitReturnObservedQuery) { q.tag = "UPDATE 0" }, func(q *recruitReturnObservedQuery) { q.tag = "UPDATE 2" },
				func(q *recruitReturnObservedQuery) { q.tag = "" }, func(q *recruitReturnObservedQuery) { q.args = append(q.args, 1) },
			} {
				bad := append([]recruitReturnObservedQuery(nil), valid...)
				mutate(&bad[i])
				// A sole event's external identity is bound by check; only mixed
				// identities are invalid without that independent call boundary.
				if !(len(valid) == 1 && (bad[i].conn == other || bad[i].pid == 18)) {
					reject(bad, false)
				}
			}
		}
		for i := range valid {
			for j := i + 1; j < len(valid); j++ {
				bad := append([]recruitReturnObservedQuery(nil), valid...)
				bad[i], bad[j] = bad[j], bad[i]
				reject(bad, false)
			}
		}
		if len(credits) == 0 {
			reject(append([]recruitReturnObservedQuery{{conn: c, pid: 17, sql: "credit", args: want[0], tag: "UPDATE 1", ended: true}}, valid...), false)
		} else {
			reject(valid[len(valid)-1:], false)
		}
		for i, args := range credits {
			for n := 0; n < len(args); n++ {
				bad := append([]recruitReturnObservedQuery(nil), valid...)
				bad[i].args = append([]any(nil), args[:n]...)
				reject(bad, false)
			}
			for j := range args {
				for _, value := range []any{int(1), int64(-1), int32(-1)} {
					bad := append([]recruitReturnObservedQuery(nil), valid...)
					bad[i].args = append([]any(nil), args...)
					bad[i].args[j] = value
					reject(bad, false)
				}
			}
		}
	}
}
