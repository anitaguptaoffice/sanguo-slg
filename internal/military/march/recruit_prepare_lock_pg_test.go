package march

import (
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type prepareCell struct{ page, tuple int32 }

type prepareLock struct {
	rel         string
	page, tuple int32
}

func prepareLockedRow(t *testing.T, pool *pgxpool.Pool, table, where string) prepareCell {
	t.Helper()
	var cell prepareCell
	baseOK(t, pool.QueryRow(context.Background(), "SELECT (ctid::text::point)[0]::int4,(ctid::text::point)[1]::int4 FROM "+table+" WHERE "+where).Scan(&cell.page, &cell.tuple))
	return cell
}

// A blocked row lock is a granted tuple entry; presence, not granted, proves contact.
func prepareLocks(t *testing.T, pool *pgxpool.Pool, schemaOID uint32, pid int32) []prepareLock {
	t.Helper()
	rows, err := pool.Query(context.Background(), `SELECT c.relname,l.page,l.tuple FROM pg_locks l JOIN pg_class c ON c.oid=l.relation WHERE l.pid=$1 AND l.locktype='tuple' AND c.relnamespace=$2`, pid, schemaOID)
	baseOK(t, err)
	defer rows.Close()
	var out []prepareLock
	for rows.Next() {
		var l prepareLock
		baseOK(t, rows.Scan(&l.rel, &l.page, &l.tuple))
		out = append(out, l)
	}
	baseOK(t, rows.Err())
	return out
}

func prepareHasTuple(locks []prepareLock, rel string, cell prepareCell) bool {
	for _, l := range locks {
		if l.rel == rel && l.page == cell.page && l.tuple == cell.tuple {
			return true
		}
	}
	return false
}

func prepareNoTuple(t *testing.T, locks []prepareLock, rel string, cells ...prepareCell) {
	for _, cell := range cells {
		if prepareHasTuple(locks, rel, cell) {
			t.Fatalf("%s %v locked out of order: %#v", rel, cell, locks)
		}
	}
}

func waitPrepareBlocked(t *testing.T, pool *pgxpool.Pool, pid, blocker int32) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for {
		var pids []int32
		baseOK(t, pool.QueryRow(context.Background(), `SELECT pg_catalog.pg_blocking_pids($1)`, pid).Scan(&pids))
		for _, p := range pids {
			if p == blocker {
				return
			}
		}
		if time.Now().After(deadline) {
			t.Fatalf("prepare %d not blocked on %d: %v", pid, blocker, pids)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// Uncontended FOR UPDATE rows live only in xmax, not pg_locks, so exact-row
// NOWAIT probes prove which earlier rows Prepare already holds.
func prepareProbeLocked(t *testing.T, pool *pgxpool.Pool, q string) bool {
	t.Helper()
	_, err := pool.Exec(context.Background(), q+" FOR UPDATE NOWAIT")
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "55P03" {
		return true
	}
	baseOK(t, err)
	return false
}

func prepareSequence(t *testing.T, pool *pgxpool.Pool) (int64, bool) {
	t.Helper()
	var last int64
	var called bool
	baseOK(t, pool.QueryRow(context.Background(), "SELECT last_value,is_called FROM work_queue_id_seq").Scan(&last, &called))
	return last, called
}

func TestPGRecruitPrepareLockOrder(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	prepareBase(t, pool, p)
	catalog, active, waiting := preparePending(t)
	active.seed(t, pool)
	waiting.seed(t, pool)
	markerCell := prepareLockedRow(t, pool, "mil_city_origin", "server_id=1 AND city_id=100")
	var stock [5]prepareCell
	for _, unit := range []int32{1, 2, 3, 4} {
		stock[unit] = prepareLockedRow(t, pool, "city_troop", "server_id=1 AND city_id=100 AND unit_cfg_id="+strconv.Itoa(int(unit)))
	}
	queue40 := prepareLockedRow(t, pool, "work_queue", "server_id=1 AND queue_id=40")
	queue41 := prepareLockedRow(t, pool, "work_queue", "server_id=1 AND queue_id=41")
	receiptCell := prepareLockedRow(t, pool, "mil_recruit_receipt", "server_id=1 AND queue_id=40")

	var blockers []*pgx.Conn
	closeBlockers := func() {
		for _, conn := range blockers {
			_ = conn.Close(context.Background())
		}
	}
	t.Cleanup(closeBlockers)
	hold := func(q string) (*pgx.Conn, int32) {
		t.Helper()
		conn, err := pgx.Connect(context.Background(), os.Getenv("DATABASE_URL"))
		baseOK(t, err)
		blockers = append(blockers, conn)
		_, err = conn.Exec(context.Background(), "SET search_path="+pgx.Identifier{p.SchemaName}.Sanitize()+";BEGIN;"+q)
		baseOK(t, err)
		return conn, int32(conn.PgConn().PID())
	}
	markerConn, markerPID := hold(`SELECT owner_player_id FROM mil_city_origin WHERE server_id=1 AND city_id=100 FOR UPDATE`)
	stockConn, stockPID := hold(`SELECT count FROM city_troop WHERE server_id=1 AND city_id=100 AND unit_cfg_id=2 FOR UPDATE`)
	queueConn, queuePID := hold(`SELECT status FROM work_queue WHERE server_id=1 AND queue_id=41 FOR UPDATE`)
	receiptConn, _ := hold(`SELECT count FROM mil_recruit_receipt WHERE server_id=1 AND queue_id=40 FOR UPDATE`)
	owner, access, ctx := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx, b, access, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, access))
	var pid int32
	baseOK(t, access.Scan(ctx, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid))
	beforeLast, beforeCalled := prepareSequence(t, pool)

	scope, intent := RecruitScope{1, 1, RecruitCommandID{9}}, RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 1}
	type result struct {
		adm *RecruitAdmission
		err error
	}
	done := make(chan result, 1)
	go func() { adm, err := participant.Prepare(ctx, access, scope, intent); done <- result{adm, err} }()
	consumed := false
	t.Cleanup(func() {
		closeBlockers()
		if !consumed {
			select {
			case <-done:
			case <-time.After(10 * time.Second):
				t.Error("prepare did not finish after blockers were released")
			}
		}
	})

	probe := func(q string, locked bool) {
		t.Helper()
		if prepareProbeLocked(t, pool, q) != locked {
			t.Fatalf("probe locked=%t, want %t: %s", !locked, locked, q)
		}
	}
	troop := func(unit int32) string {
		return "SELECT count FROM city_troop WHERE server_id=1 AND city_id=100 AND unit_cfg_id=" + strconv.Itoa(int(unit))
	}
	// Phase 1: marker first; stock/queue/receipt rows must still be untouched.
	waitPrepareBlocked(t, pool, pid, markerPID)
	locks := prepareLocks(t, pool, p.SchemaOID, pid)
	if !prepareHasTuple(locks, "mil_city_origin", markerCell) {
		t.Fatalf("marker not locked first: %#v", locks)
	}
	prepareNoTuple(t, locks, "city_troop", stock[1], stock[2], stock[3], stock[4])
	prepareNoTuple(t, locks, "work_queue", queue40, queue41)
	prepareNoTuple(t, locks, "mil_recruit_receipt", receiptCell)
	_ = markerConn.Close(context.Background())

	// Phase 2: stock ascending; unit 2 is the held row.
	waitPrepareBlocked(t, pool, pid, stockPID)
	locks = prepareLocks(t, pool, p.SchemaOID, pid)
	if !prepareHasTuple(locks, "city_troop", stock[2]) {
		t.Fatalf("stock unit 2 is not the contended row: %#v", locks)
	}
	prepareNoTuple(t, locks, "city_troop", stock[3], stock[4])
	prepareNoTuple(t, locks, "work_queue", queue40, queue41)
	prepareNoTuple(t, locks, "mil_recruit_receipt", receiptCell)
	probe("SELECT owner_player_id FROM mil_city_origin WHERE server_id=1 AND city_id=100", true)
	probe(troop(1), true)
	probe(troop(3), false)
	probe(troop(4), false)
	probe("SELECT status FROM work_queue WHERE server_id=1 AND queue_id=40", false)
	_ = stockConn.Close(context.Background())

	// Phase 3: queue ascending; queue 41 is the held row.
	waitPrepareBlocked(t, pool, pid, queuePID)
	locks = prepareLocks(t, pool, p.SchemaOID, pid)
	if !prepareHasTuple(locks, "work_queue", queue41) {
		t.Fatalf("queue 41 is not the contended row: %#v", locks)
	}
	prepareNoTuple(t, locks, "mil_recruit_receipt", receiptCell)
	probe("SELECT owner_player_id FROM mil_city_origin WHERE server_id=1 AND city_id=100", true)
	for _, unit := range []int32{1, 2, 3, 4} {
		probe(troop(unit), true)
	}
	probe("SELECT status FROM work_queue WHERE server_id=1 AND queue_id=40", true)
	midLast, midCalled := prepareSequence(t, pool)
	if midLast != beforeLast || midCalled != beforeCalled {
		t.Fatalf("queue identity allocated before queue locks: %d/%t -> %d/%t", beforeLast, beforeCalled, midLast, midCalled)
	}
	_ = queueConn.Close(context.Background())

	// Receipt row 40 is still held: completion must not need it.
	var res result
	select {
	case res = <-done:
		consumed = true
	case <-time.After(10 * time.Second):
		t.Fatal("prepare did not finish while the receipt row remained locked")
	}
	baseOK(t, res.err)
	if res.adm == nil || res.adm.state == nil {
		t.Fatal("nil admission")
	}
	afterLast, afterCalled := prepareSequence(t, pool)
	if afterLast != res.adm.state.queueID || !afterCalled {
		t.Fatalf("queue identity %d/%t != admission %d", afterLast, afterCalled, res.adm.state.queueID)
	}
	locks = prepareLocks(t, pool, p.SchemaOID, pid)
	prepareNoTuple(t, locks, "mil_recruit_receipt", receiptCell)
	_ = receiptConn.Close(context.Background())
	baseOK(t, owner.Rollback(ctx))
}

type prepareSeqState struct {
	last   int64
	called bool
}

func prepareSequences(t *testing.T, ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile) map[string]prepareSeqState {
	t.Helper()
	var names []string
	baseOK(t, a.Scan(ctx, b, `SELECT COALESCE(pg_catalog.array_agg(c.relname::pg_catalog.text ORDER BY c.relname),'{}'::pg_catalog.text[]) FROM pg_catalog.pg_class c WHERE c.relnamespace=$1 AND c.relkind='S'`, []any{p.SchemaOID}, &names))
	out := map[string]prepareSeqState{}
	for _, name := range names {
		var last int64
		var called bool
		baseOK(t, a.Scan(ctx, b, "SELECT last_value,is_called FROM "+pgx.Identifier{name}.Sanitize(), nil, &last, &called))
		out[name] = prepareSeqState{last, called}
	}
	return out
}

const prepareRowsSnapshot = `SELECT COALESCE(pg_catalog.md5(pg_catalog.string_agg(tag||':'||js||':'||x||':'||ct,'|' ORDER BY tag,ct,js)),'') FROM (
 SELECT 'marker' tag,pg_catalog.row_to_json(t)::text js,t.xmin::text x,t.ctid::text ct FROM mil_city_origin t
 UNION ALL SELECT 'stock',pg_catalog.row_to_json(t)::text,t.xmin::text,t.ctid::text FROM city_troop t UNION ALL SELECT 'queue',pg_catalog.row_to_json(t)::text,t.xmin::text,t.ctid::text FROM work_queue t
 UNION ALL SELECT 'origin',pg_catalog.row_to_json(t)::text,t.xmin::text,t.ctid::text FROM mil_recruit_origin t UNION ALL SELECT 'receipt',pg_catalog.row_to_json(t)::text,t.xmin::text,t.ctid::text FROM mil_recruit_receipt t
 UNION ALL SELECT 'wallet',pg_catalog.row_to_json(t)::text,t.xmin::text,t.ctid::text FROM player_wallet t) s`

func prepareRowsHash(t *testing.T, ctx context.Context, a *recruittx.Access, b *recruittx.Binding) string {
	t.Helper()
	var hash string
	baseOK(t, a.Scan(ctx, b, prepareRowsSnapshot, nil, &hash))
	return hash
}

func prepareCheckSequences(t *testing.T, before, after map[string]prepareSeqState, queueID int64) {
	t.Helper()
	if len(before) != len(after) {
		t.Fatalf("sequence set changed: %#v -> %#v", before, after)
	}
	for name, want := range before {
		got, ok := after[name]
		bad := !ok || got != want
		if name == "work_queue_id_seq" {
			bad = !ok || got.last != queueID || !got.called
		}
		if bad {
			t.Fatalf("sequence %s changed: %#v -> %#v", name, want, got)
		}
	}
}

func prepareClock(t *testing.T, ctx context.Context, a *recruittx.Access, b *recruittx.Binding) time.Time {
	t.Helper()
	var sample time.Time
	baseOK(t, a.Scan(ctx, b, `SELECT pg_catalog.clock_timestamp()`, nil, &sample))
	return sample
}

func prepareCheckAccepted(t *testing.T, adm *RecruitAdmission, beforeFloor, after time.Time, waiting bool, waitingFinish time.Time) {
	t.Helper()
	got := adm.state.acceptedAt
	if !validRecruitTime(got) || got.Location() != time.UTC || got.Before(beforeFloor) || got.After(after) {
		t.Fatalf("acceptedAt %s not bounded [%s,%s]", got, beforeFloor, after)
	}
	if waiting {
		if !adm.state.schedule.waiting || got.Equal(adm.state.schedule.start) || !adm.state.schedule.start.Equal(waitingFinish) || waitingFinish.Nanosecond() != 123000000 {
			t.Fatalf("waiting schedules: accepted=%s start=%s finish=%s", got, adm.state.schedule.start, waitingFinish)
		}
	} else if adm.state.schedule.waiting || !got.Equal(adm.state.schedule.start) {
		t.Fatalf("empty schedule: accepted=%s start=%s", got, adm.state.schedule.start)
	}
	acceptedBefore, costBefore := adm.state.acceptedAt, adm.state.cost
	copied := *adm
	cost, err := copied.Cost(context.Background(), &adm.state.access)
	baseOK(t, err)
	if cost != costBefore || !adm.state.acceptedAt.Equal(acceptedBefore) {
		t.Fatal("Cost changed acceptedAt or cost")
	}
}

func TestPGRecruitPrepareNoWriteAndTime(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	prepareBase(t, pool, p)
	baseSQL(t, pool, "INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,1,100)")
	catalog, active, waiting := preparePending(t)
	check := func(t *testing.T, waiting bool, finish time.Time) {
		t.Helper()
		o, a, ctx := baseOwner(t, b)
		participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
		baseOK(t, err)
		baseOK(t, participant.Pin(ctx, a))
		beforeRows := prepareRowsHash(t, ctx, a, b)
		beforeSeqs := prepareSequences(t, ctx, a, b, p)
		before := prepareClock(t, ctx, a, b).UTC().Truncate(time.Millisecond)
		adm, err := participant.Prepare(ctx, a, RecruitScope{1, 1, RecruitCommandID{9}}, RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 1})
		baseOK(t, err)
		after := prepareClock(t, ctx, a, b)
		if got := prepareRowsHash(t, ctx, a, b); got != beforeRows {
			t.Fatal("prepare wrote rows")
		}
		prepareCheckSequences(t, beforeSeqs, prepareSequences(t, ctx, a, b, p), adm.state.queueID)
		prepareCheckAccepted(t, adm, before, after, waiting, finish)
		baseOK(t, o.Rollback(ctx))
	}
	t.Run("empty pending", func(t *testing.T) { check(t, false, time.Time{}) })
	active.seed(t, pool)
	waiting.seed(t, pool)
	t.Run("waiting pending", func(t *testing.T) { check(t, true, waiting.qfinish) })

	t.Run("row updates detected", func(t *testing.T) {
		o, a, ctx := baseOwner(t, b)
		before := prepareRowsHash(t, ctx, a, b)
		for _, tc := range []struct{ name, update string }{
			{"marker", `UPDATE mil_city_origin SET owner_player_id=owner_player_id`},
			{"stock", `UPDATE city_troop SET count=count WHERE unit_cfg_id=1`},
			{"queue", `UPDATE work_queue SET status=status WHERE queue_id=40`},
			{"origin", `UPDATE mil_recruit_origin SET player_id=player_id WHERE queue_id=40`},
			{"receipt", `UPDATE mil_recruit_receipt SET count=count WHERE queue_id=40`},
			{"wallet", `UPDATE player_wallet SET food=food WHERE server_id=1 AND player_id=1`},
		} {
			execPrep(t, ctx, a, b, "SAVEPOINT prepare_rows")
			execPrep(t, ctx, a, b, tc.update)
			if got := prepareRowsHash(t, ctx, a, b); got == before {
				t.Fatalf("%s update not detected", tc.name)
			}
			execPrep(t, ctx, a, b, "ROLLBACK TO SAVEPOINT prepare_rows")
			execPrep(t, ctx, a, b, "RELEASE SAVEPOINT prepare_rows")
			if got := prepareRowsHash(t, ctx, a, b); got != before {
				t.Fatalf("%s rollback changed snapshot", tc.name)
			}
		}
		baseOK(t, o.Rollback(ctx))
	})
}

func TestRecruitPrepareSingleClockSource(t *testing.T) {
	prep, err := os.ReadFile("recruit_prepare.go")
	baseOK(t, err)
	if got := strings.Count(string(prep), "pg_catalog.clock_timestamp"); got != 1 {
		t.Fatalf("prepare clock queries: %d", got)
	}
	cost, err := os.ReadFile("recruit_admission.go")
	baseOK(t, err)
	if strings.Contains(string(cost), "clock_timestamp") {
		t.Fatal("Cost reads clock")
	}
}
