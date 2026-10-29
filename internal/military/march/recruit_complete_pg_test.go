package march

import (
	"bytes"
	"context"
	"errors"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const completionCash = `SELECT md5(pg_catalog.concat_ws('|',(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM mil_recruit_receipt t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.server_id,t.player_id) FROM player_wallet t)))`

const completionObserved = `SELECT pg_catalog.concat_ws('|',
(SELECT count FROM city_troop WHERE unit_cfg_id=1),(SELECT wounded FROM city_troop WHERE unit_cfg_id=1),
(SELECT status FROM work_queue WHERE queue_id=40),(SELECT status FROM work_queue WHERE queue_id=41),(SELECT status FROM work_queue WHERE queue_id=43),
(SELECT CASE WHEN start_at > $1 THEN 'y' ELSE 'n' END FROM work_queue WHERE queue_id=41),(SELECT CASE WHEN finish_at = start_at + interval '1 minute' THEN 'y' ELSE 'n' END FROM work_queue WHERE queue_id=41),
(SELECT CASE WHEN start_at = $2 AND finish_at = $3 THEN 'y' ELSE 'n' END FROM work_queue WHERE queue_id=43),
(SELECT count FROM city_troop WHERE unit_cfg_id=1) + (SELECT sum((payload->>'count')::int) FROM work_queue WHERE status IN (0,1)))`

func completionScalar(t *testing.T, pool *pgxpool.Pool, q string, args ...any) (out string) {
	t.Helper()
	baseOK(t, pool.QueryRow(context.Background(), q, args...).Scan(&out))
	return out
}

func completionCandidate(h historyRow) RecruitCandidate {
	return RecruitCandidate{ServerID: 1, PlayerID: h.player, CityID: h.qCity, QueueID: h.queueID}
}

func TestPGRecruitComplete(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	last := waiting
	last.queueID, last.command, last.qstart, last.qfinish, last.rstart, last.rfinish = 43, RecruitCommandID{4}, waiting.qstart.Add(time.Minute), waiting.qfinish.Add(time.Minute), waiting.rstart.Add(time.Minute), waiting.rfinish.Add(time.Minute)
	pool, b, p := completionPG(t, active, waiting, last)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	before := completionScalar(t, pool, completionCash)
	var one int
	baseOK(t, a.Scan(ctx, b, `SELECT 1 FROM mil_city_origin WHERE server_id=1 AND city_id=100 FOR UPDATE`, nil, &one))
	got, err := participant.Complete(ctx, a, completionCandidate(active))
	baseOK(t, err)
	if got != RecruitCompleted {
		t.Fatal(got)
	}
	// A second connection waits on the same city marker and observes done.
	o2, a2, ctx2, second := completionParticipant(t, b, p, catalog)
	errc := make(chan error, 1)
	go func() {
		got, err := second.Complete(ctx2, a2, completionCandidate(active))
		if err == nil && got != RecruitAlreadyDone {
			err = errors.New("second completion did not observe done")
		}
		errc <- err
	}()
	time.Sleep(100 * time.Millisecond)
	baseOK(t, o.Commit(ctx))
	if err = <-errc; err != nil {
		t.Fatal(err)
	}
	baseOK(t, o2.Commit(ctx2))
	if state := completionScalar(t, pool, completionObserved, active.qfinish, last.qstart, last.qfinish); state != "7|1|2|1|0|y|y|y|11" {
		t.Fatal(state)
	}
	if after := completionScalar(t, pool, completionCash); after != before {
		t.Fatal("receipt or wallet changed")
	}
}

func TestPGRecruitCompleteNoEffect(t *testing.T) {
	catalog, active, waiting, done := completionRows(t)
	at := time.Now().UTC().Add(time.Hour).Truncate(time.Millisecond)
	early := active
	early.accepted, early.qstart, early.rstart = at, at, at
	early.qfinish, early.rfinish = at.Add(time.Minute), at.Add(time.Minute)
	for _, tc := range []struct {
		rows []historyRow
		cand RecruitCandidate
		want RecruitCompletion
	}{
		{[]historyRow{early, waiting}, completionCandidate(early), RecruitEarly},
		{[]historyRow{active, waiting}, completionCandidate(waiting), RecruitWaiting},
		{[]historyRow{done}, completionCandidate(done), RecruitAlreadyDone},
	} {
		pool, b, p := completionPG(t, tc.rows...)
		o, a, ctx, participant := completionParticipant(t, b, p, catalog)
		completionNoWrite(t, pool, o, ctx, func() {
			for i := 0; i < 2; i++ {
				got, err := participant.Complete(ctx, a, tc.cand)
				if err != nil || got != tc.want {
					t.Fatalf("complete %d = %d, %v", i, got, err)
				}
			}
		})
	}
}

func TestPGRecruitCompleteRejects(t *testing.T) {
	catalog, active, waiting, done := completionRows(t)
	other := waiting
	other.player, other.queueID, other.command = 2, 50, RecruitCommandID{6}
	cand := completionCandidate(active)
	cases := []struct {
		rows []historyRow
		sql  string
		c    RecruitCandidate
	}{
		{[]historyRow{active, waiting}, "", RecruitCandidate{1, 1, 100, 999}},
		{[]historyRow{active, waiting}, "", RecruitCandidate{1, 2, 100, 40}},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET status=3 WHERE queue_id=40`, cand},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET status=4 WHERE queue_id=40`, cand},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET payload='{"v":1}'::jsonb WHERE queue_id=40`, cand},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET payload='{"v":1}'::jsonb WHERE queue_id=41`, cand},
		{[]historyRow{active, waiting}, `DELETE FROM mil_recruit_receipt WHERE queue_id=41`, cand},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET status=1 WHERE queue_id=41`, cand},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET status=CASE WHEN queue_id=40 THEN 0 ELSE 1 END WHERE queue_id IN(40,41)`, cand},
		{[]historyRow{active, waiting}, `DELETE FROM city_troop WHERE unit_cfg_id=4`, cand},
		{[]historyRow{active, waiting}, `INSERT INTO city_troop VALUES(1,100,5,0,0)`, cand},
		{[]historyRow{active, waiting}, `UPDATE city_troop SET count=2147483647 WHERE unit_cfg_id=1`, cand},
		{[]historyRow{active, waiting, other}, "", cand},
		{[]historyRow{done}, `UPDATE mil_recruit_receipt SET rule_digest=decode(repeat('bb',32),'hex')`, completionCandidate(done)},
	}
	for _, tc := range cases {
		pool, b, p := completionPG(t, tc.rows...)
		if tc.sql != "" {
			baseSQL(t, pool, tc.sql)
		}
		o, a, ctx, participant := completionParticipant(t, b, p, catalog)
		completionNoWrite(t, pool, o, ctx, func() {
			_, err := participant.Complete(ctx, a, tc.c)
			completionUnavailable(t, err)
		})
	}
}

func TestPGRecruitCompleteFailure(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	pool, b, p := completionPG(t, active, waiting)
	cand := completionCandidate(active)
	var before, after string
	o, a, ctx := baseOwner(t, b)
	_, err := a.Exec(ctx, b, `SET TRANSACTION READ ONLY`)
	baseOK(t, err)
	participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	before = completionScalar(t, pool, completionSnapSQL)
	if _, err = participant.Complete(ctx, a, cand); err == nil || !strings.Contains(err.Error(), "read-only") {
		t.Fatalf("read-only credit: %v", err)
	}
	baseOK(t, o.Rollback(ctx))
	if after = completionScalar(t, pool, completionSnapSQL); after != before {
		t.Fatal("credit failure wrote")
	}
	o, a, ctx, participant = completionParticipant(t, b, p, catalog)
	before = completionScalar(t, pool, completionSnapSQL)
	st, err := participant.recruitCompletionLocked(ctx, a, cand)
	baseOK(t, err)
	st.plan.promotionID = 999
	if err = participant.recruitCompletionApply(ctx, a, cand, st); err == nil || !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatalf("promotion failure: %v", err)
	}
	_ = o.Commit(ctx) // an aborted transaction cannot publish the earlier credit
	if after = completionScalar(t, pool, completionSnapSQL); after != before {
		t.Fatal("partial completion persisted")
	}
}

func TestRecruitCompleteDormant(t *testing.T) {
	src, err := os.ReadFile("recruit_complete.go")
	baseOK(t, err)
	if bytes.Contains(src, []byte("Hub")) || bytes.Contains(src, []byte("cache")) {
		t.Fatal("completion references Hub or cache")
	}
}

type completionTrace struct{ clock, locks, late, seq atomic.Int32 }

func (t *completionTrace) TraceQueryStart(ctx context.Context, _ *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	switch {
	case strings.Contains(d.SQL, "clock_timestamp"):
		t.clock.Add(1)
	case strings.Contains(d.SQL, "FOR UPDATE"):
		t.locks.Add(1)
		if t.clock.Load() != 0 {
			t.late.Add(1)
		}
	case strings.Contains(d.SQL, "nextval"):
		t.seq.Add(1)
	}
	return ctx
}

func (t *completionTrace) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

func TestPGRecruitCompleteClockOnce(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	_, _, p := completionPG(t, active, waiting)
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	baseOK(t, err)
	cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{p.SchemaName}.Sanitize()
	tr := &completionTrace{}
	cfg.ConnConfig.Tracer = tr
	tp, err := pgxpool.NewWithConfig(context.Background(), cfg)
	baseOK(t, err)
	t.Cleanup(tp.Close)
	tb, err := recruittx.NewBinding(tp)
	baseOK(t, err)
	o, a, ctx := baseOwner(t, tb)
	participant, err := NewRecruitParticipant(ctx, tb, a, p, catalog)
	baseOK(t, err)
	baseOK(t, participant.Pin(ctx, a))
	got, err := participant.Complete(ctx, a, completionCandidate(active))
	baseOK(t, err)
	if got != RecruitCompleted {
		t.Fatal(got)
	}
	baseOK(t, o.Commit(ctx))
	if tr.clock.Load() != 1 || tr.locks.Load() < 4 || tr.late.Load() != 0 || tr.seq.Load() != 0 {
		t.Fatalf("clock=%d locks=%d late=%d seq=%d", tr.clock.Load(), tr.locks.Load(), tr.late.Load(), tr.seq.Load())
	}
}
