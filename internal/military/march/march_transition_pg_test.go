package march

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const transitionReturnEpoch = 1793282400 // 2026-10-29T14:00:00Z
const transitionSeedSQL = `INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y) VALUES(1,500,7,2,10,20);INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,path,origin_city_id) VALUES(1,500,500,10,20,30,40,1,now(),now()+interval '1 hour',1,'[]',100);INSERT INTO army_troop VALUES(1,500,1,200),(1,500,2,50);`

func transitionFixture(t *testing.T, extra ...string) (*pgxpool.Pool, *pgx.Conn, *MarchTransition) {
	t.Helper()
	pool, _, p, _ := marchStoreFixture(t)
	baseSQL(t, pool, transitionSeedSQL+strings.Join(extra, ""))
	tr, err := NewMarchTransition(report.NewService(report.NewPGStore(pool)), p)
	baseOK(t, err)
	conn, err := pgx.Connect(context.Background(), os.Getenv("DATABASE_URL"))
	baseOK(t, err)
	t.Cleanup(func() { _ = conn.Close(context.Background()) })
	_, err = conn.Exec(context.Background(), `SET search_path TO `+pgx.Identifier{p.SchemaName}.Sanitize())
	baseOK(t, err)
	return pool, conn, tr
}

func transitionReport() *report.SaveParams {
	rep := battle.Simulate(battle.BaselineInputs()[0])
	return &report.SaveParams{ServerID: 1, AttackerPlayerID: 7, LocationX: 30, LocationY: 40, Report: rep}
}

func transitionCommit(p *report.SaveParams) ArrivalCommit {
	return ArrivalCommit{ServerID: 1, MarchID: 500, ArmyID: 500, ToX: 30, ToY: 40,
		Survivors: []TroopStack{{1, 166}}, ReturnAt: time.Unix(transitionReturnEpoch, 0).UTC(), Report: p}
}

func transitionState(t *testing.T, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) (s string) {
	baseOK(t, q.QueryRow(context.Background(), `SELECT o.status||'|'||COALESCE(extract(epoch FROM o.return_finish_at)::bigint,-1)||'|'||a.status||'|'||a.x||'|'||a.y||'|'||COALESCE((SELECT string_agg(unit_cfg_id||':'||count,',' ORDER BY unit_cfg_id) FROM army_troop WHERE server_id=1 AND army_id=500),'')||'|'||(SELECT count(*) FROM battle_report)||'|'||(SELECT last_value||':'||is_called FROM battle_report_report_id_seq) FROM march_order o JOIN field_army a ON a.server_id=o.server_id AND a.army_id=o.army_id WHERE o.server_id=1 AND o.march_id=500`).Scan(&s))
	return
}

func transitionSnapshot(t *testing.T, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) (s string) {
	baseOK(t, q.QueryRow(context.Background(), `SELECT md5(pg_catalog.concat_ws('|',(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY march_id) FROM march_order t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY army_id) FROM field_army t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY army_id,unit_cfg_id) FROM army_troop t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY report_id) FROM battle_report t)))`).Scan(&s))
	return
}

func TestPGMarchArrivalCallerTransaction(t *testing.T) {
	for _, tc := range []struct {
		commit bool
		want   string
	}{
		{true, "3|1793282400|2|30|40|1:166|1|1:true"},
		{false, "1|-1|2|10|20|1:200,2:50|0|1:true"}, // rows rolled back, nextval is not transactional
	} {
		pool, conn, tr := transitionFixture(t)
		before := transitionSnapshot(t, conn)
		tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
		baseOK(t, err)
		defer func() { _ = tx.Rollback(context.Background()) }()
		if _, err = tr.Commit(context.Background(), tx, transitionCommit(transitionReport())); err != nil {
			t.Fatal(err)
		}
		if tc.commit {
			baseOK(t, tx.Commit(context.Background()))
			var report string
			baseOK(t, conn.QueryRow(context.Background(), `SELECT report_id||'|'||attacker_player_id||'|'||location_x||'|'||location_y FROM battle_report`).Scan(&report))
			if report != "1|7|30|40" {
				t.Fatalf("commit=%v report %s", tc.commit, report)
			}
		} else {
			baseOK(t, tx.Rollback(context.Background()))
			if after := transitionSnapshot(t, conn); after != before {
				t.Fatalf("rollback mutated rows: %s -> %s", before, after)
			}
		}
		if state := transitionState(t, conn); state != tc.want {
			t.Fatalf("commit=%v: %s want %s", tc.commit, state, tc.want)
		}
	}
}
