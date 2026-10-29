package march

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

const completionSnapSQL = `SELECT md5(pg_catalog.concat_ws('|',(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY t.queue_id) FROM work_queue t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY t.queue_id) FROM mil_recruit_origin t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY t.queue_id) FROM mil_recruit_receipt t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY t.server_id,t.city_id,t.unit_cfg_id) FROM city_troop t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY t.server_id,t.city_id) FROM mil_city_origin t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text||':'||t.xmin::text||':'||t.ctid::text,'|' ORDER BY t.server_id,t.player_id) FROM player_wallet t),(SELECT last_value||','||is_called FROM work_queue_id_seq)))`

func completionState(t *testing.T, pool *pgxpool.Pool) (state string) {
	t.Helper()
	baseOK(t, pool.QueryRow(context.Background(), completionSnapSQL).Scan(&state))
	return state
}

func completionNoWrite(t *testing.T, pool *pgxpool.Pool, o *recruittx.Owner, ctx context.Context, run func()) {
	t.Helper()
	before := completionState(t, pool)
	run()
	baseOK(t, o.Commit(ctx))
	if completionState(t, pool) != before {
		t.Fatal("completion read wrote")
	}
}

func completionUnavailable(t *testing.T, err error) {
	t.Helper()
	if !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal(err)
	}
}

func completionRows(t *testing.T) (*RecruitCatalog, historyRow, historyRow, historyRow) {
	active, catalog, _, _ := historyDefaults(t)
	waiting := *active
	waiting.queueID, waiting.command, waiting.status, waiting.initial = 41, RecruitCommandID{2}, 0, 0
	waiting.qstart, waiting.rstart, waiting.qfinish, waiting.rfinish = active.accepted.Add(time.Minute), active.accepted.Add(time.Minute), active.accepted.Add(2*time.Minute), active.accepted.Add(2*time.Minute)
	done := *active
	done.queueID, done.command, done.status = 42, RecruitCommandID{3}, 2
	return catalog, *active, waiting, done
}

func completionPG(t *testing.T, rows ...historyRow) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	pool, b, p := freshSourceFixture(t)
	prepareBase(t, pool, p)
	baseSQL(t, pool, "INSERT INTO player_wallet(server_id,player_id,food,wood,iron,stone,gold) VALUES(1,1,80,40,1,1,7)")
	for _, row := range rows {
		row.seed(t, pool)
	}
	return pool, b, p
}

func completionParticipant(t *testing.T, b *recruittx.Binding, p freshsource.Profile, catalog *RecruitCatalog) (*recruittx.Owner, *recruittx.Access, context.Context, *RecruitParticipant) {
	t.Helper()
	o, a, ctx := baseOwner(t, b)
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	return o, a, ctx, participant
}

func TestPGRecruitCompletionHint(t *testing.T) {
	catalog, active, waiting, done := completionRows(t)
	pool, b, p := completionPG(t, active, waiting, done)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	cand := RecruitCandidate{1, done.player, done.qCity, done.queueID}
	completionNoWrite(t, pool, o, ctx, func() {
		for _, tc := range []struct {
			row  historyRow
			want int16
		}{{waiting, 0}, {active, 1}, {done, 2}} {
			got, err := participant.CompletionHint(ctx, a, RecruitCandidate{1, tc.row.player, tc.row.qCity, tc.row.queueID})
			if err != nil || got != tc.want {
				t.Fatalf("hint %d = %d, %v", tc.row.queueID, got, err)
			}
		}
		ids := []uint32{p.Objects["mil_city_origin"].OID, p.Objects["city_troop"].OID, p.Objects["work_queue"].OID, p.Objects["mil_recruit_origin"].OID, p.Objects["mil_recruit_receipt"].OID}
		var tuple, stronger int
		baseOK(t, a.Scan(ctx, b, `SELECT count(*) FILTER (WHERE locktype='tuple'),count(*) FILTER (WHERE mode NOT IN ('RowExclusiveLock','AccessShareLock')) FROM pg_catalog.pg_locks WHERE pid=pg_catalog.pg_backend_pid() AND relation=ANY($1::pg_catalog.oid[])`, []any{ids}, &tuple, &stronger))
		if tuple != 0 || stronger != 0 {
			t.Fatalf("hint locks tuple=%d stronger=%d", tuple, stronger)
		}
	})
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	wo, wa, wctx := baseOwner(t, wrong)
	_, err = participant.CompletionHint(wctx, wa, cand)
	completionUnavailable(t, err)
	baseOK(t, wo.Rollback(wctx))
	_, err = participant.CompletionHint(ctx, a, cand)
	completionUnavailable(t, err)
}

func TestPGRecruitCompletionReadRejects(t *testing.T) {
	catalog, active, waiting, done := completionRows(t)
	base := RecruitCandidate{1, active.player, active.qCity, active.queueID}
	cases := []struct {
		name string
		row  *historyRow
		sql  string
		cand RecruitCandidate
		done bool
	}{
		{"hint missing queue", nil, "", base, false},
		{"hint missing receipt", &active, `DELETE FROM mil_recruit_receipt`, base, false},
		{"hint missing origin", &active, `DO $$ BEGIN DELETE FROM mil_recruit_receipt; DELETE FROM mil_recruit_origin; END $$`, base, false},
		{"hint queue city", &active, `UPDATE work_queue SET city_id=101`, base, false},
		{"hint receipt city", &active, `UPDATE mil_recruit_receipt SET city_id=101`, base, false},
		{"hint queue player", &active, `UPDATE work_queue SET player_id=2`, base, false},
		{"hint origin player", &active, `UPDATE mil_recruit_origin SET player_id=2`, base, false},
		{"hint malformed payload", &active, `UPDATE work_queue SET payload='{"v":1}'::jsonb`, base, false},
		{"hint unknown version", &active, `UPDATE mil_recruit_receipt SET catalog_version='v0'; UPDATE work_queue SET payload=pg_catalog.jsonb_set(payload,'{catalog_version}','"v0"')`, base, false},
		{"hint unknown digest", &active, `UPDATE mil_recruit_receipt SET rule_digest=decode(repeat('bb',32),'hex')`, base, false},
		{"hint canceled", &active, `UPDATE work_queue SET status=3`, base, false},
		{"hint unknown status", &active, `UPDATE work_queue SET status=4`, base, false},
		{"hint schedule", &active, `UPDATE work_queue SET start_at=start_at+interval '1 second'`, base, false},
		{"hint wrong player", &active, "", RecruitCandidate{1, 2, active.qCity, active.queueID}, false},
		{"hint wrong city", &active, "", RecruitCandidate{1, active.player, 101, active.queueID}, false},
		{"hint wrong queue", &active, "", RecruitCandidate{1, active.player, active.qCity, 999}, false},
		{"hint wrong server", &active, "", RecruitCandidate{2, active.player, active.qCity, active.queueID}, false},
		{"done waiting", &waiting, "", RecruitCandidate{1, waiting.player, waiting.qCity, waiting.queueID}, true},
		{"done active", &active, "", base, true},
		{"done missing receipt", &done, `DELETE FROM mil_recruit_receipt`, RecruitCandidate{1, done.player, done.qCity, done.queueID}, true},
		{"done receipt digest", &done, `UPDATE mil_recruit_receipt SET rule_digest=decode(repeat('bb',32),'hex')`, RecruitCandidate{1, done.player, done.qCity, done.queueID}, true},
		{"done origin player", &done, `UPDATE mil_recruit_origin SET player_id=2`, RecruitCandidate{1, done.player, done.qCity, done.queueID}, true},
		{"done schedule", &done, `UPDATE work_queue SET finish_at=finish_at+interval '1 second'`, RecruitCandidate{1, done.player, done.qCity, done.queueID}, true},
		{"done wrong player", &done, "", RecruitCandidate{1, 2, done.qCity, done.queueID}, true},
		{"done wrong city", &done, "", RecruitCandidate{1, done.player, done.qCity + 1, done.queueID}, true},
		{"done wrong queue", &done, "", RecruitCandidate{1, done.player, done.qCity, done.queueID + 100}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			pool, b, p := completionPG(t)
			if tc.row != nil {
				tc.row.seed(t, pool)
			}
			if tc.sql != "" {
				baseSQL(t, pool, tc.sql)
			}
			o, a, ctx, participant := completionParticipant(t, b, p, catalog)
			completionNoWrite(t, pool, o, ctx, func() {
				if tc.done {
					completionUnavailable(t, participant.DoneHistory(ctx, a, tc.cand))
				} else {
					_, err := participant.CompletionHint(ctx, a, tc.cand)
					completionUnavailable(t, err)
				}
			})
		})
	}
}

func TestPGRecruitDoneHistory(t *testing.T) {
	catalog, _, _, done := completionRows(t)
	pool, b, p := completionPG(t, done)
	baseSQL(t, pool, "DELETE FROM mil_city_origin")
	cand := RecruitCandidate{1, done.player, done.qCity, done.queueID}
	holder, ha, hctx := baseOwner(t, b)
	var one int
	baseOK(t, ha.Scan(hctx, b, `SELECT 1 FROM mil_recruit_receipt WHERE server_id=1 AND queue_id=$1 FOR UPDATE`, []any{done.queueID}, &one))
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	pid, xid := 0, int64(0)
	baseOK(t, a.Scan(ctx, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid))
	baseOK(t, a.Scan(ctx, b, `SELECT txid_current()`, nil, &xid))
	errc := make(chan error, 1)
	go func() { errc <- participant.DoneHistory(ctx, a, cand) }()
	obs := `SELECT count(*) FILTER (WHERE relation=(SELECT oid FROM pg_class WHERE relnamespace=$1 AND relname='work_queue') AND granted),count(*) FILTER (WHERE relation=(SELECT oid FROM pg_class WHERE relnamespace=$1 AND relname='mil_recruit_receipt') AND granted),cardinality(pg_blocking_pids($2)),(SELECT xmax::text::bigint FROM work_queue WHERE queue_id=$3)=$4 FROM pg_locks WHERE pid=$2 AND locktype='tuple'`
	var blocked, q, r int
	var locked bool
	for i := 0; i < 500; i++ {
		baseOK(t, pool.QueryRow(context.Background(), obs, p.SchemaOID, pid, done.queueID, xid).Scan(&q, &r, &blocked, &locked))
		if blocked > 0 && q == 0 && r == 1 && locked {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if blocked == 0 || q != 0 || r != 1 || !locked {
		baseOK(t, holder.Rollback(hctx))
		<-errc
		t.Fatalf("lock order blocked=%d queue=%d receipt=%d locked=%v", blocked, q, r, locked)
	}
	baseOK(t, holder.Rollback(hctx))
	completionNoWrite(t, pool, o, ctx, func() {
		if err := <-errc; err != nil {
			t.Fatal(err)
		}
	})
}

func TestPGRecruitDoneHistoryChanged(t *testing.T) {
	catalog, _, _, done := completionRows(t)
	pool, b, p := completionPG(t, done)
	cand := RecruitCandidate{1, done.player, done.qCity, done.queueID}
	changer, ca, cctx := baseOwner(t, b)
	_, err := ca.Exec(cctx, b, `UPDATE work_queue SET status=1 WHERE server_id=1 AND queue_id=$1`, done.queueID)
	baseOK(t, err)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	pid, blocked := 0, 0
	baseOK(t, a.Scan(ctx, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid))
	errc := make(chan error, 1)
	go func() { errc <- participant.DoneHistory(ctx, a, cand) }()
	for i := 0; i < 500; i++ {
		baseOK(t, pool.QueryRow(context.Background(), `SELECT pg_catalog.cardinality(pg_catalog.pg_blocking_pids($1))`, pid).Scan(&blocked))
		if blocked > 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if blocked == 0 {
		baseOK(t, changer.Rollback(cctx))
		<-errc
		t.Fatal("done history did not wait for the queue lock")
	}
	baseOK(t, changer.Commit(cctx))
	completionNoWrite(t, pool, o, ctx, func() {
		completionUnavailable(t, <-errc)
		if got, err := participant.CompletionHint(ctx, a, cand); err != nil || got != 1 {
			t.Fatal("changed hint", got, err)
		}
	})
}
