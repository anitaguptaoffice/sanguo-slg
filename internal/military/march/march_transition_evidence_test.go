package march

import (
	"context"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func transitionWait(pool *pgxpool.Pool, pid, by int, like string) bool {
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		var blocked bool
		if err := pool.QueryRow(context.Background(), `SELECT $2::pg_catalog.int4 = ANY(pg_catalog.pg_blocking_pids($1::pg_catalog.int4)) AND EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid OPERATOR(pg_catalog.=) $1::pg_catalog.int4 AND wait_event_type OPERATOR(pg_catalog.=) 'Lock' AND query LIKE $3)`, pid, by, like).Scan(&blocked); err == nil && blocked {
			return true
		}
	}
	return false
}

// commitTx is the external caller: it owns the transaction and commits on success.
func commitTx(pool *pgxpool.Pool, tr *MarchTransition, in ArrivalCommit) (ArrivalCommitted, error) {
	tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return ArrivalCommitted{}, err
	}
	got, err := tr.Commit(context.Background(), tx, in)
	if err == nil {
		return got, tx.Commit(context.Background())
	}
	_ = tx.Rollback(context.Background())
	return ArrivalCommitted{}, err
}

func TestPGMarchArrivalStatusThreeNotReplayed(t *testing.T) {
	pool, conn, tr := transitionFixture(t)
	baseSQL(t, pool, `UPDATE march_order SET status=3,return_finish_at=now() WHERE server_id=1 AND march_id=500`)
	before := transitionSnapshot(t, conn)
	if _, err := commitTx(pool, tr, transitionCommit(transitionReport())); !errors.Is(err, ErrArrivalReplayed) {
		t.Fatalf("restored status-3 order replayed: %v", err)
	}
	if after := transitionSnapshot(t, conn); after != before {
		t.Fatalf("restored status-3 order mutated: %s -> %s", before, after)
	}
}

func TestPGMarchArrivalReplay(t *testing.T) {
	pool, conn, tr := transitionFixture(t, `INSERT INTO battle_report(server_id,report_id,attacker_player_id,location_x,location_y,outcome,detail) VALUES(1,500,7,1,1,1,'{}');SELECT setval('battle_report_report_id_seq',500,true)`)
	_, err := commitTx(pool, tr, transitionCommit(transitionReport()))
	baseOK(t, err)
	before := transitionSnapshot(t, conn)
	if _, err = commitTx(pool, tr, transitionCommit(transitionReport())); !errors.Is(err, ErrArrivalReplayed) {
		t.Fatalf("replay %v", err)
	}
	if after := transitionSnapshot(t, conn); after != before || !strings.HasSuffix(transitionState(t, conn), "|501:true") {
		t.Fatalf("replay %s -> %s", before, after)
	}
}

func TestPGMarchArrivalConcurrent(t *testing.T) {
	pool, _, tr := transitionFixture(t)
	start := make(chan struct{})
	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, err := commitTx(pool, tr, transitionCommit(transitionReport()))
			errs <- err
		}()
	}
	close(start)
	wg.Wait()
	close(errs)
	var ok, replayed int
	for err := range errs {
		switch {
		case err == nil:
			ok++
		case errors.Is(err, ErrArrivalReplayed):
			replayed++
		default:
			t.Fatalf("concurrent %v", err)
		}
	}
	if ok != 1 || replayed != 1 || !strings.HasSuffix(transitionState(t, pool), "|1|1:true") {
		t.Fatalf("concurrent ok=%d replay=%d state %s", ok, replayed, transitionState(t, pool))
	}
}

func TestPGMarchArrivalRejectsMissing(t *testing.T) {
	pool, conn, tr := transitionFixture(t)
	before := transitionSnapshot(t, conn)
	for _, in := range []ArrivalCommit{transitionCommit(transitionReport()), transitionCommit(nil)} {
		in.ArmyID++
		if _, err := commitTx(pool, tr, in); !errors.Is(err, ErrArrivalMissing) {
			t.Fatalf("wrong army: %v", err)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	baseOK(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()
	if _, err = tr.Commit(ctx, tx, transitionCommit(transitionReport())); err == nil || errors.Is(err, ErrArrivalMissing) {
		t.Fatalf("canceled context reported as absence: %v", err)
	}
	baseOK(t, tx.Rollback(context.Background()))
	if after := transitionSnapshot(t, conn); after != before {
		t.Fatalf("missing cases mutated: %s -> %s", before, after)
	}
}

func TestPGMarchArrivalNoBattleAndZeroBattle(t *testing.T) {
	for _, tc := range []struct {
		name      string
		report    *report.SaveParams
		survivors []TroopStack
		reportID  int64
		status    int16
		want      string
	}{
		{"no battle", nil, []TroopStack{{1, 200}, {2, 50}}, 0, 3, "3|1793282400|2|30|40|1:200,2:50|0|1:false"},
		{"zero battle", transitionReport(), nil, 1, 4, "4|-1|1|30|40||1|1:true"},
	} {
		pool, _, tr := transitionFixture(t)
		in := transitionCommit(tc.report)
		in.Survivors = tc.survivors
		got, err := commitTx(pool, tr, in)
		baseOK(t, err)
		if state := transitionState(t, pool); got.ReportID != tc.reportID || got.Status != tc.status || state != tc.want {
			t.Fatalf("%s: %#v %s want %s", tc.name, got, state, tc.want)
		}
	}
}

func TestPGMarchArrivalRejectsNoBattleMismatch(t *testing.T) {
	pool, conn, tr := transitionFixture(t)
	before := transitionSnapshot(t, conn)
	for _, survivors := range [][]TroopStack{nil, {{1, 200}, {3, 1}}, {{1, 200}, {2, 51}}, {{1, 1}}} {
		in := transitionCommit(nil)
		in.Survivors = survivors
		if _, err := commitTx(pool, tr, in); !errors.Is(err, ErrMarchTransition) {
			t.Fatalf("survivors %v: %v", survivors, err)
		}
	}
	if after := transitionSnapshot(t, conn); after != before {
		t.Fatalf("rejected input mutated %s -> %s", before, after)
	}
}

func TestPGMarchArrivalNoBattleEmpty(t *testing.T) {
	pool, conn, tr := transitionFixture(t, `DELETE FROM army_troop`)
	before := transitionSnapshot(t, conn)
	in := transitionCommit(nil)
	in.Survivors = nil
	tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	baseOK(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()
	if _, err := tr.Commit(context.Background(), tx, in); !errors.Is(err, ErrMarchTransition) {
		t.Fatalf("empty expedition not rejected: %v", err)
	}
	if err := tx.Commit(context.Background()); err != nil {
		t.Fatalf("caller commit after empty stack: %v", err)
	}
	if after := transitionSnapshot(t, conn); after != before {
		t.Fatalf("empty expedition mutated %s -> %s", before, after)
	}
}

func TestPGMarchArrivalSavepointLogicalFailures(t *testing.T) {
	null := func(target, event string) string {
		return `CREATE FUNCTION null_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;CREATE TRIGGER null_write BEFORE ` + event + ` ON ` + target + ` FOR EACH ROW EXECUTE FUNCTION null_write();`
	}
	for _, tc := range []struct {
		name      string
		ddl       string
		report    *report.SaveParams
		survivors []TroopStack
	}{
		{"march update", null("march_order", "UPDATE"), transitionReport(), []TroopStack{{1, 166}}},
		{"troop insert", null("army_troop", "INSERT"), transitionReport(), []TroopStack{{1, 166}}},
		{"army update", null("field_army", "UPDATE"), transitionReport(), []TroopStack{{1, 166}}},
		{"report insert", null("battle_report", "INSERT"), transitionReport(), []TroopStack{{1, 166}}},
		{"delete suppression", null("army_troop", "DELETE"), transitionReport(), []TroopStack{{3, 7}}},
		{"empty survivor suppression", null("army_troop", "DELETE"), transitionReport(), nil},
		{"survivor mismatch", "", nil, []TroopStack{{1, 1}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pool, conn, tr := transitionFixture(t, tc.ddl)
			before := transitionSnapshot(t, conn)
			tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
			baseOK(t, err)
			defer func() { _ = tx.Rollback(context.Background()) }()
			in := transitionCommit(tc.report)
			in.Survivors = tc.survivors
			if _, err := tr.Commit(context.Background(), tx, in); err == nil {
				t.Fatal("logical failure not surfaced")
			}
			if err := tx.Commit(context.Background()); err != nil {
				t.Fatalf("caller commit after logical failure: %v", err)
			}
			if after := transitionSnapshot(t, conn); after != before {
				t.Fatalf("logical failure survived commit: %s -> %s", before, after)
			}
			if tc.report != nil {
				var last int64
				var called bool
				baseOK(t, conn.QueryRow(context.Background(), `SELECT last_value,is_called FROM battle_report_report_id_seq`).Scan(&last, &called))
				if last != 1 || !called {
					t.Fatalf("report path not reached: %d:%t", last, called)
				}
			}
		})
	}
}

func TestPGMarchArrivalLockedStackContention(t *testing.T) {
	pool, _, tr := transitionFixture(t)
	ctx := context.Background()
	holder, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	baseOK(t, err)
	var holderPID int
	baseOK(t, holder.QueryRow(ctx, `SELECT pg_catalog.pg_backend_pid()`).Scan(&holderPID))
	rows, err := holder.Query(ctx, `SELECT unit_cfg_id FROM army_troop WHERE server_id=1 AND army_id=500 FOR UPDATE`)
	baseOK(t, err)
	_, err = pgx.CollectRows(rows, pgx.RowTo[int32])
	baseOK(t, err)

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	baseOK(t, err)
	defer func() { _ = tx.Rollback(ctx) }()
	var pid int
	baseOK(t, tx.QueryRow(ctx, `SELECT pg_catalog.pg_backend_pid()`).Scan(&pid))
	in := transitionCommit(nil)
	in.Survivors = []TroopStack{{1, 200}, {2, 50}}
	errs := make(chan error, 1)
	go func() {
		if _, err := tr.Commit(ctx, tx, in); err != nil {
			errs <- err
			return
		}
		errs <- tx.Commit(ctx)
	}()
	if !transitionWait(pool, pid, holderPID, `%army_troop%FOR UPDATE%`) {
		_ = holder.Rollback(ctx)
		<-errs
		t.Fatalf("backend %d not blocked on army_troop FOR UPDATE by %d", pid, holderPID)
	}
	baseOK(t, holder.Rollback(ctx))
	baseOK(t, <-errs)
	if state := transitionState(t, pool); state != "3|1793282400|2|30|40|1:200,2:50|0|1:false" {
		t.Fatalf("contended no-battle state %s", state)
	}
}

func TestPGMarchArrivalFailpoints(t *testing.T) {
	raise := func(name, target, event string) string {
		return `CREATE FUNCTION fail_` + name + `() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'failpoint ` + name + `' USING ERRCODE='P0001'; END $$;CREATE TRIGGER fail_` + name + ` BEFORE ` + event + ` ON ` + target + ` FOR EACH ROW EXECUTE FUNCTION fail_` + name + `();`
	}
	for _, tc := range []struct{ name, ddl string }{
		{"march", raise("march", "march_order", "UPDATE")},
		{"troop", raise("troop", "army_troop", "INSERT")},
		{"army", raise("army", "field_army", "UPDATE")},
		{"report", raise("report", "battle_report", "INSERT")},
	} {
		pool, conn, tr := transitionFixture(t, tc.ddl)
		before := transitionSnapshot(t, conn)
		_, err := commitTx(pool, tr, transitionCommit(transitionReport()))
		var pgErr *pgconn.PgError
		if err == nil || !errors.As(err, &pgErr) || pgErr.Code != "P0001" || !strings.Contains(pgErr.Message, "failpoint "+tc.name) {
			t.Fatalf("%s: failpoint not reached: %v", tc.name, err)
		}
		if after := transitionSnapshot(t, conn); after != before {
			t.Fatalf("%s: %s -> %s", tc.name, before, after)
		}
	}
}

func TestPGMarchArrivalPostReportFailure(t *testing.T) {
	pool, conn, tr := transitionFixture(t, `CREATE FUNCTION fail_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'post-report failpoint' USING ERRCODE='P0001'; END $$;CREATE CONSTRAINT TRIGGER fail_commit AFTER INSERT ON battle_report DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_commit();`)
	before := transitionSnapshot(t, conn)
	_, err := commitTx(pool, tr, transitionCommit(transitionReport()))
	var pgErr *pgconn.PgError
	if err == nil || !errors.As(err, &pgErr) || pgErr.Code != "P0001" || !strings.Contains(pgErr.Message, "post-report failpoint") {
		t.Fatalf("post-report failpoint not reached: %v", err)
	}
	if after := transitionSnapshot(t, conn); after != before {
		t.Fatalf("post-report failure persisted: %s -> %s", before, after)
	}
}

func TestPGMarchArrivalSequenceDecoy(t *testing.T) {
	pool, conn, tr := transitionFixture(t, `DROP SCHEMA IF EXISTS decoy CASCADE;CREATE SCHEMA decoy;CREATE TABLE decoy.battle_report(server_id INT,report_id BIGINT);INSERT INTO decoy.battle_report VALUES(1,900);CREATE SEQUENCE decoy.battle_report_report_id_seq;SELECT setval('decoy.battle_report_report_id_seq',5,false);`)
	t.Cleanup(func() { baseSQL(t, pool, `DROP SCHEMA IF EXISTS decoy CASCADE`) })
	ctx := context.Background()
	decoy, err := pgx.Connect(ctx, os.Getenv("DATABASE_URL"))
	baseOK(t, err)
	t.Cleanup(func() { _ = decoy.Close(ctx) })
	_, err = decoy.Exec(ctx, `SET search_path TO decoy, `+pgx.Identifier{tr.profile.SchemaName}.Sanitize())
	baseOK(t, err)
	tx, err := decoy.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	baseOK(t, err)
	defer func() { _ = tx.Rollback(ctx) }()
	got, err := tr.Commit(ctx, tx, transitionCommit(transitionReport()))
	baseOK(t, err)
	baseOK(t, tx.Commit(ctx))
	var last int64
	var called bool
	baseOK(t, conn.QueryRow(ctx, `SELECT last_value,is_called FROM battle_report_report_id_seq`).Scan(&last, &called))
	if got.ReportID != 1 || last != 1 || !called {
		t.Fatalf("real sequence/report %d %d:%t", got.ReportID, last, called)
	}
	baseOK(t, pool.QueryRow(ctx, `SELECT last_value,is_called FROM decoy.battle_report_report_id_seq`).Scan(&last, &called))
	if last != 5 || called {
		t.Fatalf("decoy sequence advanced to %d:%t", last, called)
	}
	if state := transitionState(t, conn); state != "3|1793282400|2|30|40|1:166|1|1:true" {
		t.Fatalf("decoy state %s", state)
	}
}

func TestPGMarchArrivalSequenceAudit(t *testing.T) {
	pool, conn, tr := transitionFixture(t, `SELECT setval('battle_report_report_id_seq',500,false);INSERT INTO battle_report(server_id,report_id,attacker_player_id,location_x,location_y,outcome,detail) VALUES(1,500,7,1,1,1,'{}');`)
	before := transitionSnapshot(t, conn)
	if _, err := commitTx(pool, tr, transitionCommit(transitionReport())); !errors.Is(err, ErrMarchSequence) {
		t.Fatalf("behind sequence: %v", err)
	}
	if after := transitionSnapshot(t, conn); after != before {
		t.Fatalf("behind sequence mutated: %s -> %s", before, after)
	}
}

// cancelTx forwards real SQL, cancels the operation context at one chosen
// statement, and records cleanup attempted with an already-dead context.
type cancelTx struct {
	pgx.Tx
	cancel          context.CancelFunc
	after, before   func(string) bool
	cleanupCanceled bool
}

func (t *cancelTx) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	if strings.Contains(sql, "ROLLBACK TO SAVEPOINT") && ctx.Err() != nil {
		t.cleanupCanceled = true
	}
	if t.before != nil && t.before(sql) {
		t.before = nil
		t.cancel()
	}
	tag, err := t.Tx.Exec(ctx, sql, args...)
	if t.after != nil && t.after(sql) {
		t.after = nil
		t.cancel()
	}
	return tag, err
}

func TestPGMarchArrivalCanceledCleanup(t *testing.T) {
	null := `CREATE FUNCTION null_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;CREATE TRIGGER null_write BEFORE INSERT ON army_troop FOR EACH ROW EXECUTE FUNCTION null_write();`
	for _, tc := range []struct {
		name, ddl string
		after     bool
	}{{"zero row insert", null, true}, {"release", "", false}} {
		t.Run(tc.name, func(t *testing.T) {
			pool, conn, tr := transitionFixture(t, tc.ddl)
			before := transitionSnapshot(t, conn)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
			baseOK(t, err)
			defer func() { _ = tx.Rollback(context.Background()) }()
			w := &cancelTx{Tx: tx, cancel: cancel}
			if tc.after {
				w.after = func(q string) bool { return strings.Contains(q, "INSERT INTO") && strings.Contains(q, "army_troop") }
			} else {
				w.before = func(q string) bool { return strings.Contains(q, "RELEASE SAVEPOINT march_arrival") }
			}
			if _, err = tr.Commit(ctx, w, transitionCommit(transitionReport())); !errors.Is(err, ErrMarchTransition) {
				t.Fatalf("canceled cleanup not surfaced: %v", err)
			}
			if w.cleanupCanceled || tx.Commit(context.Background()) == nil {
				t.Fatal("canceled cleanup left a usable transaction")
			}
			if after := transitionSnapshot(t, conn); after != before {
				t.Fatalf("canceled cleanup persisted rows: %s -> %s", before, after)
			}
		})
	}
}
