package march

import (
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const transitionSeedSQL = `INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y) VALUES(1,500,7,2,10,20);INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,path,origin_city_id) VALUES(1,500,500,10,20,30,40,1,now(),now()+interval '1 hour',1,'[]',100);INSERT INTO army_troop VALUES(1,500,1,200),(1,500,2,50);`

func transitionFixture(t *testing.T, extra ...string) (*pgxpool.Pool, freshsource.Profile, *MarchTransition) {
	t.Helper()
	pool, _, p, _ := marchStoreFixture(t)
	baseSQL(t, pool, transitionSeedSQL+strings.Join(extra, ""))
	return pool, p, NewMarchTransition(pool, report.NewService(report.NewPGStore(pool)))
}

func transitionReport() *report.SaveParams {
	rep := battle.Simulate(battle.BaselineInputs()[0])
	return &report.SaveParams{ServerID: 1, AttackerPlayerID: 7, LocationX: 30, LocationY: 40, Report: rep}
}

func transitionCommit(p *report.SaveParams) ArrivalCommit {
	return ArrivalCommit{ServerID: 1, MarchID: 500, ArmyID: 500, ToX: 30, ToY: 40,
		Survivors: []TroopStack{{1, 166}}, ReturnAt: time.Date(2026, 10, 29, 14, 0, 0, 0, time.UTC), Report: p}
}

func transitionState(t *testing.T, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) (s string) {
	baseOK(t, q.QueryRow(context.Background(), `SELECT o.status||'|'||COALESCE(extract(epoch FROM o.return_finish_at)::bigint,-1)||'|'||a.status||'|'||a.x||'|'||a.y||'|'||COALESCE((SELECT string_agg(unit_cfg_id||':'||count,',' ORDER BY unit_cfg_id) FROM army_troop WHERE server_id=1 AND army_id=500),'')||'|'||(SELECT count(*) FROM battle_report)||'|'||(SELECT last_value||':'||is_called FROM battle_report_report_id_seq) FROM march_order o JOIN field_army a ON a.server_id=o.server_id AND a.army_id=o.army_id WHERE o.server_id=1 AND o.march_id=500`).Scan(&s))
	return
}

func TestPGMarchArrivalCommit(t *testing.T) {
	pool, p, tr := transitionFixture(t)
	in := transitionCommit(transitionReport())
	got, err := tr.Commit(context.Background(), in)
	baseOK(t, err)
	want := "3|" + strconv.FormatInt(in.ReturnAt.Unix(), 10) + "|2|30|40|1:166|1|1:true"
	if got.ReportID != 1 || got.Status != 3 || got.ArmyID != 500 || transitionState(t, pool) != want {
		t.Fatalf("commit %#v state %s want %s", got, transitionState(t, pool), want)
	}
	conn, err := pgx.Connect(context.Background(), os.Getenv("DATABASE_URL"))
	baseOK(t, err)
	defer func() { _ = conn.Close(context.Background()) }()
	_, err = conn.Exec(context.Background(), `SET search_path TO `+pgx.Identifier{p.SchemaName}.Sanitize())
	baseOK(t, err)
	if state := transitionState(t, conn); state != want {
		t.Fatalf("second connection %s want %s", state, want)
	}
}

func TestPGMarchArrivalNoBattleAndZero(t *testing.T) {
	for _, tc := range []struct {
		survivors []TroopStack
		want      string
	}{{[]TroopStack{{1, 200}, {2, 50}}, "3|%d|2|30|40|1:200,2:50|0|1:false"},
		{nil, "4|-1|1|30|40||0|1:false"}} {
		pool, _, tr := transitionFixture(t)
		in := transitionCommit(nil)
		in.Survivors = tc.survivors
		got, err := tr.Commit(context.Background(), in)
		baseOK(t, err)
		want := strings.Replace(tc.want, "%d", strconv.FormatInt(in.ReturnAt.Unix(), 10), 1)
		if got.ReportID != 0 || transitionState(t, pool) != want {
			t.Fatalf("%#v %s want %s", got, transitionState(t, pool), want)
		}
	}
}

func TestPGMarchArrivalStatusThreeNotReplayed(t *testing.T) {
	pool, _, tr := transitionFixture(t)
	baseSQL(t, pool, `UPDATE march_order SET status=3,return_finish_at=now() WHERE server_id=1 AND march_id=500`)
	before := transitionState(t, pool)
	if _, err := tr.Commit(context.Background(), transitionCommit(transitionReport())); !errors.Is(err, ErrArrivalReplayed) {
		t.Fatalf("restored status-3 order replayed: %v", err)
	}
	if after := transitionState(t, pool); after != before {
		t.Fatalf("restored status-3 order mutated: %s -> %s", before, after)
	}
}

func TestPGMarchArrivalReplay(t *testing.T) {
	pool, _, tr := transitionFixture(t, `INSERT INTO battle_report(server_id,report_id,attacker_player_id,location_x,location_y,outcome,detail) VALUES(1,500,7,1,1,1,'{}');SELECT setval('battle_report_report_id_seq',500,true)`)
	_, err := tr.Commit(context.Background(), transitionCommit(transitionReport()))
	baseOK(t, err)
	before := transitionState(t, pool)
	if _, err = tr.Commit(context.Background(), transitionCommit(transitionReport())); !errors.Is(err, ErrArrivalReplayed) {
		t.Fatalf("replay %v", err)
	}
	if after := transitionState(t, pool); after != before || !strings.HasSuffix(after, "|2|501:true") {
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
			_, err := tr.Commit(context.Background(), transitionCommit(transitionReport()))
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

func TestPGMarchArrivalFailures(t *testing.T) {
	const raise = `CREATE FUNCTION fail_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$;`
	for _, tc := range []struct {
		name, ddl string
		allocated bool
	}{
		{"march update", raise + `CREATE TRIGGER fail_write BEFORE UPDATE ON march_order FOR EACH ROW EXECUTE FUNCTION fail_write();`, false},
		{"troop insert", raise + `CREATE TRIGGER fail_write BEFORE INSERT ON army_troop FOR EACH ROW EXECUTE FUNCTION fail_write();`, false},
		{"army update", raise + `CREATE TRIGGER fail_write BEFORE UPDATE ON field_army FOR EACH ROW EXECUTE FUNCTION fail_write();`, false},
		{"report insert", raise + `CREATE TRIGGER fail_write BEFORE INSERT ON battle_report FOR EACH ROW EXECUTE FUNCTION fail_write();`, true},
		{"commit", raise + `CREATE CONSTRAINT TRIGGER fail_write AFTER INSERT ON battle_report DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_write();`, true},
	} {
		pool, _, tr := transitionFixture(t)
		before := transitionState(t, pool)
		baseSQL(t, pool, tc.ddl)
		if _, err := tr.Commit(context.Background(), transitionCommit(transitionReport())); !errors.Is(err, ErrMarchTransition) {
			t.Fatalf("%s: failure not surfaced: %v", tc.name, err)
		}
		if tc.allocated {
			before = strings.Replace(before, "1:false", "1:true", 1)
		}
		if after := transitionState(t, pool); after != before {
			t.Fatalf("%s: rows/sequence changed: %s -> %s", tc.name, before, after)
		}
	}
}

func TestPGMarchArrivalRejectsMissing(t *testing.T) {
	pool, _, tr := transitionFixture(t)
	in := transitionCommit(nil)
	in.ArmyID++
	if _, err := tr.Commit(context.Background(), in); !errors.Is(err, ErrArrivalMissing) {
		t.Fatal(err)
	}
	if state := transitionState(t, pool); !strings.HasSuffix(state, "|0|1:false") {
		t.Fatal(state)
	}
}
