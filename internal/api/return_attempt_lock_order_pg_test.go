package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type returnOrderPG struct {
	f        *returnAttemptPG
	trace    *returnLifetimeTrace
	owned    returnBackendSet
	blockers []*pgx.Conn
	cancel   context.CancelFunc
	done     chan struct{}
	result   returnAttemptResult
	fault    any
	rows     []string
}

func newReturnOrderPG(t *testing.T) *returnOrderPG {
	t.Helper()
	r := &returnOrderPG{trace: returnLifetimeTracer("")}
	r.f = newReturnAttemptPG(t, r.trace, r.owned.configure)
	table := func(name string) string { return pgx.Identifier{r.f.profile.SchemaName, name}.Sanitize() }
	player := "SELECT account_id FROM " + table("player") + " WHERE server_id OPERATOR(pg_catalog.=) $1 AND player_id OPERATOR(pg_catalog.=) $2"
	r.rows = []string{player,
		"SELECT status FROM " + table("account") + " WHERE account_id OPERATOR(pg_catalog.=) $1 FOR SHARE",
		player + " FOR SHARE",
		"SELECT food,wood,iron,stone,gold FROM " + table("player_wallet") + " WHERE server_id=$1 AND player_id=$2 FOR UPDATE",
		"SELECT player_id,x,y FROM " + table("player_city") + " WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE",
		"SELECT owner_player_id,cohort_id,format_version FROM " + table("mil_city_origin") + " WHERE server_id OPERATOR(pg_catalog.=) $1 AND city_id OPERATOR(pg_catalog.=) $2 FOR UPDATE"}
	// Initialization has ended; this trace and gate now belong only to complete.
	r.trace.target = strings.ToLower(player)
	r.trace.mu.Lock()
	r.trace.queries = nil
	r.trace.mu.Unlock()
	t.Cleanup(func() {
		if r.cancel != nil {
			r.cancel()
		}
		r.trace.release()
		for _, conn := range r.blockers {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := conn.Close(ctx); err != nil {
				t.Error("owned blocker cleanup", err)
			}
			cancel()
		}
		if r.done == nil {
			return
		}
		r.owned.cleanup(t, r.f, r.done)
	})
	return r
}

func (r *returnOrderPG) pid() uint32 {
	if events := r.trace.events(); len(events) > 0 {
		return events[0].pid
	}
	return 0
}
func (r *returnOrderPG) start() {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	r.cancel, r.done = cancel, make(chan struct{})
	go func() {
		defer close(r.done)
		defer func() { r.fault = recover() }()
		r.result = r.f.generation.complete(ctx, r.f.candidate)
	}()
}
func (r *returnOrderPG) block(t *testing.T, sql string) *pgx.Conn {
	t.Helper()
	conn, err := pgx.ConnectConfig(r.f.ctx, r.f.observer.Config().Copy())
	returnPGOK(t, err)
	r.blockers = append(r.blockers, conn)
	returnPGExec(t, r.f.ctx, conn, "BEGIN; "+sql)
	return conn
}
func (r *returnOrderPG) finish(t *testing.T) {
	t.Helper()
	select {
	case <-r.done:
	case <-time.After(10 * time.Second):
		t.Fatal("complete did not finish")
	}
	if r.fault != nil {
		t.Fatal("complete panicked", r.fault)
	}
	r.owned.noLocks(t, r.f.ctx, r.f.observer, r.pid(), r.f.profile.SchemaOID)
	returnPGReleased(t, r.f.ctx, r.f.observer, r.f.profile)
}

// Called only while a real PG wait or the pre-dispatch hint gate freezes the caller.
func (r *returnOrderPG) frozen(t *testing.T, pins, rows int) {
	t.Helper()
	var gotPins, wantPins, gotRows []string
	for i, name := range returnPGPins[:pins] {
		prefix, mode := "LOCK TABLE ", "ROW EXCLUSIVE"
		if i >= 4 {
			prefix = "LOCK TABLE ONLY "
		}
		if i < 2 || i == 3 {
			mode = "ROW SHARE"
		}
		wantPins = append(wantPins, prefix+pgx.Identifier{r.f.profile.SchemaName, name}.Sanitize()+" IN "+mode+" MODE")
	}
	for _, q := range r.trace.events() {
		if strings.HasPrefix(q.sql, "LOCK TABLE ") {
			gotPins = append(gotPins, q.sql)
		} else if strings.Contains(q.sql, " FROM "+pgx.Identifier{r.f.profile.SchemaName}.Sanitize()+".") {
			// Sequence source validation is metadata, not business-row access.
			if q.sql != "SELECT last_value,is_called FROM "+(pgx.Identifier{r.f.profile.SchemaName, "work_queue_id_seq"}).Sanitize() {
				gotRows = append(gotRows, q.sql)
			}
		} else if strings.HasPrefix(q.sql, "UPDATE ") || strings.HasPrefix(q.sql, "INSERT ") || strings.HasPrefix(q.sql, "DELETE ") {
			t.Fatal("business write before ordered barriers", q.sql)
		}
	}
	if !reflect.DeepEqual(gotPins, wantPins) || !reflect.DeepEqual(gotRows, append([]string(nil), r.rows[:rows]...)) {
		t.Fatal("frozen pin/business-row order", gotPins, wantPins, gotRows, r.rows[:rows])
	}
}
func (r *returnOrderPG) waiting(t *testing.T, sql string, blocker uint32) {
	t.Helper()
	ctx, cancel := context.WithTimeout(r.f.ctx, 10*time.Second)
	defer cancel()
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		if pid := r.pid(); pid != 0 {
			var waiting bool
			returnPGOK(t, r.f.observer.QueryRow(ctx, `SELECT EXISTS(SELECT FROM pg_catalog.pg_stat_activity
WHERE pid=$1 AND backend_start=$4::timestamptz AND query=$2 AND wait_event_type='Lock' AND pg_catalog.pg_blocking_pids(pid)=ARRAY[$3]::int4[])`, pid, sql, blocker, r.owned.get(pid).started).Scan(&waiting))
			if waiting {
				if pid == blocker || pid == r.f.observer.PgConn().PID() || blocker == r.f.observer.PgConn().PID() {
					t.Fatal("non-independent lock witness")
				}
				t.Logf("caller=%d blocker=%d observer=%d query=%s", pid, blocker, r.f.observer.PgConn().PID(), sql)
				return
			}
		}
		select {
		case <-r.done:
			t.Fatal("complete ended before expected lock wait", r.result, r.fault)
		case <-ctx.Done():
			t.Fatal("missing PG lock witness", sql)
		case <-ticker.C:
		}
	}
}

func TestPGReturnAttemptPinAndActorOrder(t *testing.T) {
	for _, terminal := range []bool{false, true} {
		t.Run(map[bool]string{false: "due", true: "terminal"}[terminal], func(t *testing.T) {
			r := newReturnOrderPG(t)
			f := r.f
			if terminal {
				returnPGExec(t, f.ctx, f.observer, "UPDATE march_order SET status=4; UPDATE field_army SET status=1,x=0,y=0")
			}
			before, stable := snapshotReturnAttemptPG(t, f, false), snapshotReturnAttemptPG(t, f, true)
			var pins []*pgx.Conn
			for _, name := range returnPGPins {
				pins = append(pins, r.block(t, "LOCK TABLE ONLY "+pgx.Identifier{f.profile.SchemaName, name}.Sanitize()+" IN EXCLUSIVE MODE"))
			}
			r.start()
			for i, conn := range pins {
				returnPinWitness(t, f.ctx, f.observer, r.trace, f.profile, i, conn.PgConn().PID())
				r.frozen(t, i+1, 0)
				returnPGExec(t, f.ctx, conn, "ROLLBACK")
			}
			pid := returnLifetimeReached(t, r.trace)
			returnPinWitness(t, f.ctx, f.observer, r.trace, f.profile, len(returnPGPins), 0)
			r.frozen(t, 12, 1)
			queries := []string{"SELECT 1 FROM account WHERE account_id=1", "SELECT 1 FROM player WHERE server_id=1 AND player_id=1",
				"SELECT 1 FROM player_wallet WHERE server_id=1 AND player_id=1", "SELECT 1 FROM player_city WHERE server_id=1 AND city_id=1", "SELECT 1 FROM mil_city_origin WHERE server_id=1 AND city_id=1"}
			var rows []*pgx.Conn
			for _, q := range queries {
				rows = append(rows, r.block(t, q+" FOR UPDATE NOWAIT"))
			}
			r.trace.release() // Unlocked hint must pass the held player row.
			for i, conn := range rows {
				r.waiting(t, r.rows[i+1], conn.PgConn().PID())
				r.frozen(t, 12, i+2)
				for _, q := range queries[:i] {
					_, err := f.observer.Exec(f.ctx, q+" FOR UPDATE NOWAIT")
					var pgErr *pgconn.PgError
					if !errors.As(err, &pgErr) || pgErr.Code != "55P03" {
						t.Fatal("earlier row lock not retained", q, err)
					}
				}
				if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
					t.Fatal("business effect before MIL marker barrier")
				}
				returnPGExec(t, f.ctx, conn, "ROLLBACK")
			}
			r.finish(t)
			want, clocks := march.ReturnApplied, 1
			if terminal {
				want, clocks = march.ReturnCreditedTerminal, 0
				if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
					t.Fatal("terminal changed retained graph")
				}
			}
			returnAttemptConfirmed(t, f, r.result, want, f.due)
			returnAttemptTrace(t, f, r.trace.events(), true, clocks)
			returnAttemptClean(t, f)
			var ready []int32
			var status, army, x, y int32
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop").Scan(&ready))
			returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT m.status,a.status,a.x,a.y FROM march_order m,field_army a").Scan(&status, &army, &x, &y))
			wantReady := []int32{18, 20, 19, 23}
			if terminal {
				wantReady = []int32{11, 12, 13, 14}
			}
			if !reflect.DeepEqual(ready, wantReady) || status != 4 || army != 1 || x != 0 || y != 0 || !reflect.DeepEqual(stable, snapshotReturnAttemptPG(t, f, true)) || pid != r.pid() {
				t.Fatal("independent final state/identity mismatch", ready, status, army, x, y)
			}
		})
	}
}

func TestPGReturnAttemptRejectsReassignedHint(t *testing.T) {
	r := newReturnOrderPG(t)
	f := r.f
	returnPGExec(t, f.ctx, f.observer, "INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE VALUES(2,'second','not-a-credential')")
	blocker := r.block(t, "SELECT 1 FROM account WHERE account_id=1 FOR UPDATE NOWAIT")
	r.trace.release()
	r.start()
	r.waiting(t, r.rows[1], blocker.PgConn().PID()) // The unlocked hint found account 1.
	r.frozen(t, 12, 2)
	returnPGExec(t, f.ctx, f.observer, "UPDATE player SET account_id=2 WHERE server_id=1 AND player_id=1")
	before := snapshotReturnAttemptPG(t, f, false) // Includes only this committed fixture change.
	returnPGExec(t, f.ctx, blocker, "ROLLBACK")
	r.finish(t)
	r.frozen(t, 12, 3) // Recheck rejected; no second account, wallet, WORLD or MIL row query.
	if r.result.outcome != returnKnownEnded || !errors.Is(r.result.cause, account.ErrRecruitActorGuard) || r.result.cleanup != nil || r.result.diagnostic != nil || r.result.confirmed != (march.ReturnObservation{}) {
		t.Fatal("stale hint did not fail closed", r.result)
	}
	returnAttemptTrace(t, f, r.trace.events(), false, 0)
	returnLifetimeRollback(t, r.trace, false)
	returnLifetimeState(t, f.generation, 0, true, false)
	returnPGOK(t, f.generation.s.admission.waitDrained(f.ctx))
	if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f, false)) {
		t.Fatal("rejected hint changed business rows or sequences")
	}
}
