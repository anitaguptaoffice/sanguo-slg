package march

import (
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

const completionCash = `md5(pg_catalog.concat_ws('|',(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.queue_id) FROM mil_recruit_receipt t),(SELECT pg_catalog.string_agg(pg_catalog.row_to_json(t)::text,'|' ORDER BY t.server_id,t.player_id) FROM player_wallet t)))`

const completionObserved = `SELECT pg_catalog.concat_ws('|',(SELECT count FROM city_troop WHERE unit_cfg_id=1),(SELECT wounded FROM city_troop WHERE unit_cfg_id=1),(SELECT status FROM work_queue WHERE queue_id=40),(SELECT status FROM work_queue WHERE queue_id=41),(SELECT status FROM work_queue WHERE queue_id=43),(SELECT CASE WHEN start_at=$1 AND finish_at=$2 THEN 'y' ELSE 'n' END FROM work_queue WHERE queue_id=43),(SELECT (SELECT count FROM city_troop WHERE unit_cfg_id=1)+(SELECT sum((payload->>'count')::int) FROM work_queue WHERE status IN (0,1))),(` + completionCash + `))`

func completionScalar(t *testing.T, pool *pgxpool.Pool, q string, args ...any) (out string) {
	baseOK(t, pool.QueryRow(context.Background(), q, args...).Scan(&out))
	return out
}

func completionCandidate(h historyRow) RecruitCandidate {
	return RecruitCandidate{ServerID: 1, PlayerID: h.player, CityID: h.qCity, QueueID: h.queueID}
}

func completionWant(t *testing.T, got RecruitCompletion, err error, want RecruitCompletion) {
	if want == 0 && errors.Is(err, ErrRecruitUnavailable) {
		return
	}
	if err != nil || got != want {
		t.Fatalf("complete = %d, %v, want %d", got, err, want)
	}
}

// completeUnderCityLock takes the real WORLD player_city row lock first, as the production caller must.
func completeUnderCityLock(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p *RecruitParticipant, c RecruitCandidate) (RecruitCompletion, error) {
	var one int
	if err := a.Scan(ctx, b, `SELECT 1 FROM player_city WHERE server_id=$1 AND city_id=$2 FOR UPDATE`, []any{c.ServerID, c.CityID}, &one); err != nil {
		return 0, err
	}
	return p.Complete(ctx, a, c)
}

func TestPGRecruitComplete(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	last := waiting
	last.queueID, last.command, last.qstart, last.qfinish, last.rstart, last.rfinish = 43, RecruitCommandID{4}, waiting.qstart.Add(time.Minute), waiting.qfinish.Add(time.Minute), waiting.rstart.Add(time.Minute), waiting.rfinish.Add(time.Minute)
	pool, b, p := completionPG(t, active, waiting, last)
	body, err := os.ReadFile("../../../spec/db/002_world.sql")
	baseOK(t, err)
	baseSQL(t, pool, string(body)+` INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,100,1,'capital',0,0)`)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	before := completionScalar(t, pool, `SELECT `+completionCash)
	var pid1, pid2 int
	baseOK(t, a.Scan(ctx, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid1))
	var t0, t1 time.Time
	baseOK(t, a.Scan(ctx, b, `SELECT pg_catalog.clock_timestamp()`, nil, &t0))
	got, err := completeUnderCityLock(ctx, a, b, participant, completionCandidate(active))
	completionWant(t, got, err, RecruitCompleted)
	baseOK(t, a.Scan(ctx, b, `SELECT pg_catalog.clock_timestamp()`, nil, &t1))
	// Both callers take the same WORLD city lock; the second must block until the first commits.
	o2, a2, ctx2, second := completionParticipant(t, b, p, catalog)
	baseOK(t, a2.Scan(ctx2, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid2))
	type outcome struct {
		got RecruitCompletion
		err error
	}
	out := make(chan outcome, 1)
	go func() {
		g, e := completeUnderCityLock(ctx2, a2, b, second, completionCandidate(active))
		out <- outcome{g, e}
	}()
	blocked := false
	for deadline := time.Now().Add(5 * time.Second); !blocked && time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		baseOK(t, pool.QueryRow(context.Background(), `SELECT $2::pg_catalog.int4 = ANY(pg_catalog.pg_blocking_pids($1::pg_catalog.int4)) AND EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid OPERATOR(pg_catalog.=) $1::pg_catalog.int4 AND wait_event_type OPERATOR(pg_catalog.=) 'Lock' AND query LIKE '%player_city%FOR UPDATE%')`, pid2, pid1).Scan(&blocked))
	}
	if !blocked {
		_ = o.Commit(ctx)
		<-out
		t.Fatalf("second backend %d not blocked by %d", pid2, pid1)
	}
	t.Logf("city lock: backend %d blocked by %d", pid2, pid1)
	baseOK(t, o.Commit(ctx))
	r := <-out
	completionWant(t, r.got, r.err, RecruitAlreadyDone)
	baseOK(t, o2.Commit(ctx2))
	t0, t1 = t0.UTC().Truncate(time.Millisecond), t1.UTC().Truncate(time.Millisecond)
	var start, finish time.Time
	baseOK(t, pool.QueryRow(ctx, `SELECT start_at,finish_at FROM work_queue WHERE queue_id=41`).Scan(&start, &finish))
	start = start.UTC().Truncate(time.Millisecond)
	if t1.Sub(t0) >= time.Second || start.Before(t0) || start.After(t1) || !finish.UTC().Equal(start.Add(time.Minute)) {
		t.Fatalf("promotion start=%v finish=%v sampled bound=[%v,%v]", start, finish, t0, t1)
	}
	if state := completionScalar(t, pool, completionObserved, last.qstart, last.qfinish); state != "7|1|2|1|0|y|11|"+before {
		t.Fatal(state)
	}
}

func TestPGRecruitCompleteOutcomes(t *testing.T) {
	catalog, active, waiting, done := completionRows(t)
	other := waiting
	other.player, other.queueID, other.command = 2, 50, RecruitCommandID{6}
	at := time.Now().UTC().Add(time.Hour).Truncate(time.Millisecond)
	early := active
	early.accepted, early.qstart, early.rstart = at, at, at
	early.qfinish, early.rfinish = at.Add(time.Minute), at.Add(time.Minute)
	cand := completionCandidate(active)
	cases := []struct {
		rows []historyRow
		sql  string
		c    RecruitCandidate
		want RecruitCompletion // zero means unavailable
	}{
		{[]historyRow{early, waiting}, "", completionCandidate(early), RecruitEarly},
		{[]historyRow{active, waiting}, "", completionCandidate(waiting), RecruitWaiting},
		{[]historyRow{done}, "", completionCandidate(done), RecruitAlreadyDone},
		{[]historyRow{active, waiting}, "", RecruitCandidate{1, 1, 101, 40}, 0},
		{[]historyRow{active, waiting}, "", RecruitCandidate{1, 1, 100, 999}, 0},
		{[]historyRow{active, waiting}, "", RecruitCandidate{1, 2, 100, 40}, 0},
		{[]historyRow{active, waiting}, "", RecruitCandidate{2, 1, 100, 40}, 0},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET status=3 WHERE queue_id=40`, cand, 0},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET status=4 WHERE queue_id=40`, cand, 0},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET payload='{"v":1}'::jsonb WHERE queue_id=40`, cand, 0},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET payload='{"v":1}'::jsonb WHERE queue_id=41`, cand, 0},
		{[]historyRow{active, waiting}, `DELETE FROM mil_recruit_receipt WHERE queue_id=41`, cand, 0},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET status=1 WHERE queue_id=41`, cand, 0},
		{[]historyRow{active, waiting}, `UPDATE work_queue SET status=CASE WHEN queue_id=40 THEN 0 ELSE 1 END WHERE queue_id IN(40,41)`, cand, 0},
		{[]historyRow{active, waiting}, `DELETE FROM city_troop WHERE unit_cfg_id=4`, cand, 0},
		{[]historyRow{active, waiting}, `INSERT INTO city_troop VALUES(1,100,5,0,0)`, cand, 0},
		{[]historyRow{active, waiting}, `UPDATE city_troop SET count=2147483647 WHERE unit_cfg_id=1`, cand, 0},
		{[]historyRow{active, waiting, other}, "", cand, 0},
		{[]historyRow{active, waiting}, `UPDATE mil_city_origin SET owner_player_id=2`, cand, 0},
		{[]historyRow{active, waiting}, `UPDATE mil_city_origin SET cohort_id=decode(repeat('aa',16),'hex')`, cand, 0},
		{[]historyRow{active, waiting}, `DELETE FROM mil_city_origin`, cand, 0},
		{[]historyRow{done}, `UPDATE mil_recruit_receipt SET rule_digest=decode(repeat('bb',32),'hex')`, completionCandidate(done), 0},
	}
	for _, tc := range cases {
		pool, b, p := completionPG(t, tc.rows...)
		if tc.sql != "" {
			baseSQL(t, pool, tc.sql)
		}
		o, a, ctx, participant := completionParticipant(t, b, p, catalog)
		completionNoWrite(t, pool, o, ctx, func() {
			for i := 0; i < 2; i++ {
				got, err := participant.Complete(ctx, a, tc.c)
				completionWant(t, got, err, tc.want)
			}
		})
	}
}

func TestPGRecruitCompleteGuards(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	for _, tc := range []struct {
		inject  string
		aborted bool
	}{
		{`UPDATE city_troop SET count=count+1 WHERE unit_cfg_id=1`, false},
		{`UPDATE work_queue SET status=0 WHERE queue_id=40`, true},
		{`UPDATE work_queue SET status=2 WHERE queue_id=41`, true},
	} {
		pool, b, p := completionPG(t, active, waiting)
		before := completionScalar(t, pool, completionSnapSQL)
		o, a, ctx := baseOwner(t, b)
		participant, err := NewRecruitParticipant(ctx, b, a, p, catalog)
		baseOK(t, err)
		baseOK(t, participant.Pin(ctx, a))
		st, err := participant.recruitCompletionLocked(ctx, a, completionCandidate(active))
		baseOK(t, err)
		_, err = a.Exec(ctx, b, tc.inject)
		baseOK(t, err)
		if err = participant.recruitCompletionApply(ctx, a, completionCandidate(active), st); !errors.Is(err, ErrRecruitUnavailable) || !errors.Is(err, errRecruitCompletionWrite) {
			t.Fatalf("guard %q: %v", tc.inject, err)
		}
		if _, err = a.Exec(ctx, b, `SELECT 1`); tc.aborted != (err != nil) {
			t.Fatalf("guard %q poison: %v", tc.inject, err)
		}
		if tc.aborted {
			_ = o.Commit(ctx)
		} else {
			baseOK(t, o.Rollback(ctx))
		}
		if after := completionScalar(t, pool, completionSnapSQL); after != before {
			t.Fatalf("guards %q persisted a write", tc.inject)
		}
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
	tr := &completionTrace{}
	cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{p.SchemaName}.Sanitize()
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
	completionWant(t, got, err, RecruitCompleted)
	baseOK(t, o.Commit(ctx))
	if tr.clock.Load() != 1 || tr.locks.Load() < 4 || tr.late.Load() != 0 || tr.seq.Load() != 0 {
		t.Fatalf("clock=%d locks=%d late=%d seq=%d", tr.clock.Load(), tr.locks.Load(), tr.late.Load(), tr.seq.Load())
	}
}
