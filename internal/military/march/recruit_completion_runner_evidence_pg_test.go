package march

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func evidenceBlocked(t *testing.T, pool *pgxpool.Pool, n int, base time.Time) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `INSERT INTO work_queue(server_id,queue_id,player_id,city_id,queue_type,payload,start_at,finish_at,status)
		SELECT 1,1000+g,1,NULL,3,'{}'::jsonb,$1::pg_catalog.timestamptz,$1::pg_catalog.timestamptz+(g||' seconds')::interval,1 FROM pg_catalog.generate_series(1,$2) g`, base, n)
	baseOK(t, err)
}

func evidencePID(t *testing.T, a *recruittx.Access, ctx context.Context, b *recruittx.Binding) (pid int) {
	t.Helper()
	baseOK(t, a.Scan(ctx, b, `SELECT pg_catalog.pg_backend_pid()`, nil, &pid))
	return pid
}

func evidenceBlockedOn(t *testing.T, pool *pgxpool.Pool, pid, by int, like string) bool {
	t.Helper()
	var blocked bool
	baseOK(t, pool.QueryRow(context.Background(), `SELECT $2::pg_catalog.int4 = ANY(pg_catalog.pg_blocking_pids($1::pg_catalog.int4)) AND EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid OPERATOR(pg_catalog.=) $1::pg_catalog.int4 AND wait_event_type OPERATOR(pg_catalog.=) 'Lock' AND query LIKE $3)`, pid, by, like).Scan(&blocked))
	return blocked
}

func evidenceWait(t *testing.T, pool *pgxpool.Pool, pid, by int, like string) bool {
	t.Helper()
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if evidenceBlockedOn(t, pool, pid, by, like) {
			return true
		}
	}
	return false
}

func TestPGDueKeysetBlockedPages(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	pool, b, p := completionPG(t, active, waiting)
	dueWorld(t, pool, 100, 1)
	evidenceBlocked(t, pool, MaxDueRecruits+1, active.qfinish.Add(-2*time.Hour))
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	page1, err := participant.DueRecruits(ctx, a, RecruitDueScope{1}, active.qfinish.UTC(), RecruitDueCursor{}, MaxDueRecruits)
	baseOK(t, err)
	if len(page1) != MaxDueRecruits {
		t.Fatalf("page1 len=%d", len(page1))
	}
	if page1[0].QueueID != 1001 || page1[len(page1)-1].QueueID != 1000+MaxDueRecruits {
		t.Fatalf("page1 first=%d last=%d", page1[0].QueueID, page1[len(page1)-1].QueueID)
	}
	cursor := RecruitDueCursor{FinishAt: page1[len(page1)-1].FinishAt, QueueID: page1[len(page1)-1].QueueID}
	page2, err := participant.DueRecruits(ctx, a, RecruitDueScope{1}, active.qfinish.UTC(), cursor, MaxDueRecruits)
	baseOK(t, err)
	if len(page2) != 2 || page2[0].QueueID != 1000+MaxDueRecruits+1 || page2[1].QueueID != active.queueID {
		t.Fatalf("page2 = %+v", page2)
	}
	before := completionState(t, pool)
	if effects, err := participant.ApplyDueRecruits(ctx, a, page2); effects != nil || !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatalf("blocked-first apply = %+v, %v", effects, err)
	}
	baseOK(t, o.Rollback(ctx))
	if completionState(t, pool) != before {
		t.Fatal("blocked-first batch wrote")
	}
	o, a, ctx, participant = completionParticipant(t, b, p, catalog)
	cursor = RecruitDueCursor{FinishAt: page2[0].FinishAt, QueueID: page2[0].QueueID}
	page3, err := participant.DueRecruits(ctx, a, RecruitDueScope{1}, active.qfinish.UTC(), cursor, MaxDueRecruits)
	baseOK(t, err)
	if len(page3) != 1 || page3[0].QueueID != active.queueID {
		t.Fatalf("page3 = %+v", page3)
	}
	if effects, err := participant.ApplyDueRecruits(ctx, a, page3); err != nil || len(effects) != 1 || effects[0].DoneID != active.queueID {
		t.Fatalf("page3 apply = %+v, %v", effects, err)
	}
	baseOK(t, o.Commit(ctx))
	o, a, ctx, participant = completionParticipant(t, b, p, catalog)
	completionNoWrite(t, pool, o, ctx, func() {
		if rows, err := participant.DueRecruits(ctx, a, RecruitDueScope{1}, active.qfinish.UTC(), cursor, MaxDueRecruits); err != nil || len(rows) != 0 {
			t.Fatalf("restart page = %+v, %v", rows, err)
		}
		if effects, err := participant.ApplyDueRecruits(ctx, a, page3); err != nil || len(effects) != 0 {
			t.Fatalf("restart apply = %+v, %v", effects, err)
		}
	})
}

func TestPGDueRecruitsNoRowLock(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	_, b, p := completionPG(t, active, waiting)
	o1, a1, ctx1 := baseOwner(t, b)
	var one int
	baseOK(t, a1.Scan(ctx1, b, `SELECT 1 FROM work_queue WHERE server_id=$1 AND queue_id=$2 FOR UPDATE`, []any{1, 40}, &one))
	o2, a2, ctx2 := baseOwner(t, b)
	if _, err := a2.Exec(ctx2, b, `SET LOCAL lock_timeout='500ms'`); err != nil {
		t.Fatal(err)
	}
	participant, err := NewRecruitParticipant(ctx2, b, a2, p, catalog)
	baseOK(t, err)
	rows, err := participant.DueRecruits(ctx2, a2, RecruitDueScope{1}, active.qfinish.UTC(), RecruitDueCursor{}, 10)
	baseOK(t, err)
	if len(rows) != 1 || rows[0].QueueID != 40 {
		t.Fatalf("held-row discovery = %+v", rows)
	}
	baseOK(t, o2.Rollback(ctx2))
	baseOK(t, o1.Rollback(ctx1))
}

func TestPGApplyDueWorldLock(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	pool, b, p := completionPG(t, active, waiting)
	dueWorld(t, pool, 100, 1)
	o1, a1, ctx1, first := completionParticipant(t, b, p, catalog)
	pid1 := evidencePID(t, a1, ctx1, b)
	if effects, err := first.ApplyDueRecruits(ctx1, a1, dueOf(active)); err != nil || len(effects) != 1 {
		t.Fatalf("first apply = %+v, %v", effects, err)
	}
	o2, a2, ctx2, second := completionParticipant(t, b, p, catalog)
	pid2 := evidencePID(t, a2, ctx2, b)
	errs := make(chan error, 1)
	go func() {
		effects, err := second.ApplyDueRecruits(ctx2, a2, dueOf(active))
		if err == nil && len(effects) != 0 {
			err = errors.New("second connection applied effects")
		}
		errs <- err
	}()
	if !evidenceWait(t, pool, pid2, pid1, "%player_city%FOR UPDATE%") {
		_ = o1.Commit(ctx1)
		<-errs
		t.Fatalf("second backend %d not blocked on WORLD player_city by %d", pid2, pid1)
	}
	baseOK(t, o1.Commit(ctx1))
	baseOK(t, <-errs)
	baseOK(t, o2.Commit(ctx2))
	var count int32
	baseOK(t, pool.QueryRow(context.Background(), `SELECT count FROM city_troop WHERE unit_cfg_id=1`).Scan(&count))
	if count != 7 {
		t.Fatalf("WORLD-locked completion credited %d", count)
	}
}

func TestPGRecruitCompleteMilLock(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	pool, b, p := completionPG(t, active, waiting)
	o1, a1, ctx1, first := completionParticipant(t, b, p, catalog)
	pid1 := evidencePID(t, a1, ctx1, b)
	if d, err := first.Complete(ctx1, a1, completionCandidate(active)); err != nil || d != RecruitCompleted {
		t.Fatalf("first complete = %d, %v", d, err)
	}
	o2, a2, ctx2, second := completionParticipant(t, b, p, catalog)
	pid2 := evidencePID(t, a2, ctx2, b)
	errs := make(chan error, 1)
	go func() {
		_, err := second.Complete(ctx2, a2, completionCandidate(active))
		errs <- err
	}()
	if !evidenceWait(t, pool, pid2, pid1, "%mil_city_origin%FOR UPDATE%") {
		_ = o1.Commit(ctx1)
		<-errs
		t.Fatalf("second backend %d not blocked on MIL city marker by %d", pid2, pid1)
	}
	baseOK(t, o1.Commit(ctx1))
	baseOK(t, <-errs)
	baseOK(t, o2.Commit(ctx2))
	var count int32
	baseOK(t, pool.QueryRow(context.Background(), `SELECT count FROM city_troop WHERE unit_cfg_id=1`).Scan(&count))
	if count != 7 {
		t.Fatalf("MIL-locked completion credited %d", count)
	}
}

func TestPGApplyDueRejectsDrift(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	due := dueOf(active)
	for _, drift := range []string{
		`UPDATE player_city SET player_id=2`,
		`UPDATE mil_city_origin SET owner_player_id=2`,
		`UPDATE mil_city_origin SET cohort_id=decode(repeat('aa',16),'hex')`,
		`DELETE FROM city_troop WHERE unit_cfg_id=4`,
		`INSERT INTO city_troop VALUES(1,100,5,0,0)`,
		`UPDATE city_troop SET count=2147483647 WHERE unit_cfg_id=1`,
		`UPDATE mil_recruit_receipt SET rule_digest=decode(repeat('bb',32),'hex') WHERE queue_id=40`,
	} {
		pool, b, p := completionPG(t, active, waiting)
		dueWorld(t, pool, 100, 1)
		baseSQL(t, pool, drift)
		o, a, ctx, participant := completionParticipant(t, b, p, catalog)
		before := completionState(t, pool)
		if effects, err := participant.ApplyDueRecruits(ctx, a, due); effects != nil || !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatalf("drift %q = %+v, %v", drift, effects, err)
		}
		baseOK(t, o.Rollback(ctx))
		if completionState(t, pool) != before {
			t.Fatalf("drift %q persisted a write", drift)
		}
	}
}

func TestPGApplyDueOutcomes(t *testing.T) {
	catalog, active, waiting, done := completionRows(t)
	early := active
	start := time.Now().UTC().Add(time.Hour).Truncate(time.Millisecond)
	early.qstart, early.rstart, early.accepted = start, start, start
	early.qfinish, early.rfinish = start.Add(time.Minute), start.Add(time.Minute)
	for _, tc := range []struct {
		rows []historyRow
		cand historyRow
	}{{[]historyRow{active, waiting}, waiting}, {[]historyRow{early}, early}, {[]historyRow{done}, done}} {
		pool, b, p := completionPG(t, tc.rows...)
		dueWorld(t, pool, 100, 1)
		o, a, ctx, participant := completionParticipant(t, b, p, catalog)
		completionNoWrite(t, pool, o, ctx, func() {
			if effects, err := participant.ApplyDueRecruits(ctx, a, dueOf(tc.cand)); err != nil || len(effects) != 0 {
				t.Fatalf("outcome apply = %+v, %v", effects, err)
			}
		})
	}
}

func TestPGApplyDueFailureRollback(t *testing.T) {
	catalog, active, waiting, _ := completionRows(t)
	pool, b, p := completionPG(t, active, waiting)
	dueWorld(t, pool, 100, 1)
	o, a, ctx, participant := completionParticipant(t, b, p, catalog)
	before := completionState(t, pool)
	due := append(dueOf(active), RecruitDueJob{RecruitCandidate: RecruitCandidate{1, 1, 100, 9999}, FinishAt: active.qfinish.UTC()})
	if effects, err := participant.ApplyDueRecruits(ctx, a, due); effects != nil || !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatalf("failure = %+v, %v", effects, err)
	}
	var credited int32
	baseOK(t, a.Scan(ctx, b, `SELECT count FROM city_troop WHERE unit_cfg_id=1`, nil, &credited))
	if credited != 7 {
		t.Fatalf("credit not applied before failure: %d", credited)
	}
	baseOK(t, o.Rollback(ctx))
	if completionState(t, pool) != before {
		t.Fatal("failure persisted a partial effect")
	}
}
