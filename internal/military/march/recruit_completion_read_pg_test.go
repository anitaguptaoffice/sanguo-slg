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

const completionSnapSQL = `SELECT md5(pg_catalog.concat_ws('|',(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM work_queue t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM mil_recruit_origin t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM mil_recruit_receipt t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.unit_cfg_id) FROM city_troop t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.city_id) FROM mil_city_origin t),(SELECT count(*) FROM player_wallet),(SELECT last_value||','||is_called FROM work_queue_id_seq)))`

func completionState(t *testing.T, ctx context.Context, a *recruittx.Access, b *recruittx.Binding) (state string) {
	t.Helper()
	baseOK(t, a.Scan(ctx, b, completionSnapSQL, nil, &state))
	return state
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
	before := completionState(t, ctx, a, b)
	for _, tc := range []struct {
		row  historyRow
		want int16
	}{{waiting, 0}, {active, 1}, {done, 2}} {
		got, err := participant.CompletionHint(ctx, a, RecruitCandidate{1, tc.row.player, tc.row.qCity, tc.row.queueID})
		if err != nil || got != tc.want {
			t.Fatalf("hint %d = %d, %v", tc.row.queueID, got, err)
		}
	}
	if completionState(t, ctx, a, b) != before {
		t.Fatal("hint mutated rows")
	}
	ids := []uint32{p.Objects["mil_city_origin"].OID, p.Objects["city_troop"].OID, p.Objects["work_queue"].OID, p.Objects["mil_recruit_origin"].OID, p.Objects["mil_recruit_receipt"].OID}
	var tuple, stronger int
	baseOK(t, a.Scan(ctx, b, `SELECT count(*) FILTER (WHERE locktype='tuple'),count(*) FILTER (WHERE mode NOT IN ('RowExclusiveLock','AccessShareLock')) FROM pg_catalog.pg_locks WHERE pid=pg_catalog.pg_backend_pid() AND relation=ANY($1::pg_catalog.oid[])`, []any{ids}, &tuple, &stronger))
	if tuple != 0 || stronger != 0 {
		t.Fatalf("hint locks tuple=%d stronger=%d", tuple, stronger)
	}
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	wo, wa, wctx := baseOwner(t, wrong)
	_, err = participant.CompletionHint(wctx, wa, cand)
	completionUnavailable(t, err)
	baseOK(t, wo.Rollback(wctx))
	eo, ea, ectx := baseOwner(t, b)
	baseOK(t, eo.Rollback(ectx))
	_, err = participant.CompletionHint(ectx, ea, cand)
	completionUnavailable(t, err)
	baseOK(t, o.Rollback(ctx))
}

func TestPGRecruitCompletionReadRejects(t *testing.T) {
	catalog, active, waiting, done := completionRows(t)
	base := RecruitCandidate{1, active.player, active.qCity, active.queueID}
	waitingCand := RecruitCandidate{1, waiting.player, waiting.qCity, waiting.queueID}
	doneCand := RecruitCandidate{1, done.player, done.qCity, done.queueID}
	player, city, queue, server := base, base, base, base
	player.PlayerID, city.CityID, queue.QueueID, server.ServerID = 2, 101, 999, 2
	donePlayer, doneCity, doneQueue := doneCand, doneCand, doneCand
	donePlayer.PlayerID, doneCity.CityID, doneQueue.QueueID = 2, done.qCity+1, done.queueID+100
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
		{"hint wrong player", &active, "", player, false},
		{"hint wrong city", &active, "", city, false},
		{"hint wrong queue", &active, "", queue, false},
		{"hint wrong server", &active, "", server, false},
		{"hint source drift", &active, `ALTER TABLE mil_recruit_origin DROP CONSTRAINT mil_recruit_origin_command_id_check; UPDATE mil_recruit_origin SET command_id=decode(repeat('00',16),'hex')`, base, false},
		{"done waiting", &waiting, "", waitingCand, true},
		{"done active", &active, "", base, true},
		{"done missing receipt", &done, `DELETE FROM mil_recruit_receipt`, doneCand, true},
		{"done receipt digest", &done, `UPDATE mil_recruit_receipt SET rule_digest=decode(repeat('bb',32),'hex')`, doneCand, true},
		{"done origin player", &done, `UPDATE mil_recruit_origin SET player_id=2`, doneCand, true},
		{"done schedule", &done, `UPDATE work_queue SET finish_at=finish_at+interval '1 second'`, doneCand, true},
		{"done wrong player", &done, "", donePlayer, true},
		{"done wrong city", &done, "", doneCity, true},
		{"done wrong queue", &done, "", doneQueue, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			pool, b, p := completionPG(t)
			o, a, ctx, participant := completionParticipant(t, b, p, catalog)
			if tc.row != nil {
				tc.row.seed(t, pool)
			}
			if tc.sql != "" {
				execPrep(t, ctx, a, b, tc.sql)
			}
			if tc.done {
				before := completionState(t, ctx, a, b)
				completionUnavailable(t, participant.DoneHistory(ctx, a, tc.cand))
				if completionState(t, ctx, a, b) != before {
					t.Fatal("rejected done history mutated rows")
				}
			} else {
				_, err := participant.CompletionHint(ctx, a, tc.cand)
				completionUnavailable(t, err)
			}
			baseOK(t, o.Rollback(ctx))
		})
	}
}

func TestPGRecruitDoneHistory(t *testing.T) {
	catalog, _, _, done := completionRows(t)
	pool, b, p := completionPG(t, done)
	cand := RecruitCandidate{1, done.player, done.qCity, done.queueID}
	holder, ha, hctx := baseOwner(t, b)
	var one int
	baseOK(t, ha.Scan(hctx, b, `SELECT 1 FROM mil_recruit_receipt WHERE server_id=1 AND queue_id=$1 FOR UPDATE`, []any{done.queueID}, &one))
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	before := completionState(t, ctx, a, b)
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
	if err := <-errc; err != nil {
		t.Fatal(err)
	}
	if completionState(t, ctx, a, b) != before {
		t.Fatal("done history mutated rows")
	}
	execPrep(t, ctx, a, b, `DELETE FROM mil_city_origin`)
	if err := participant.DoneHistory(ctx, a, cand); err != nil {
		t.Fatal("done history required current ownership", err)
	}
	baseOK(t, o.Rollback(ctx))
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
	completionUnavailable(t, <-errc)
	if got, err := participant.CompletionHint(ctx, a, cand); err != nil || got != 1 {
		t.Fatal("changed hint", got, err)
	}
	baseOK(t, o.Rollback(ctx))
}
