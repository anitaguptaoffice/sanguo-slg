package api

import (
	"context"
	"errors"
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type recruitReturnRowsState struct {
	first, second march.RecruitAcceptance
	candidate     march.RecruitCandidate
	paid          map[string]string
	stable        string
}

func recruitReturnRowsPaid(t *testing.T, f *recruitCompleteReturnPG, observed *recruitReturnObservedTrace) recruitReturnRowsState {
	t.Helper()
	// Setup only, before either actual admission. Never change paid schedules.
	returnPGExec(t, f.ctx, f.observer, "UPDATE city_troop SET count=2147483636 WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1")
	before := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	var state recruitReturnRowsState
	for i := 0; i < 2; i++ {
		selected, _ := observed.snapshot()
		full := len(f.trace.events())
		a, c := f.paid(t, i)
		observed.check(t, f, len(selected), full, nil)
		if i == 0 {
			state.first, state.candidate = a, c
		} else {
			state.second = a
		}
	}
	wantStart := state.second.AcceptedAt
	if state.first.InitialFinishAt.After(wantStart) {
		wantStart = state.first.InitialFinishAt
	}
	if state.first.InitialStartAt != state.first.AcceptedAt || state.second.InitialStartAt != wantStart {
		t.Fatal("near-capacity paid schedules differ from actual admission estimates")
	}
	var exact bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT
(SELECT count(*)=1 AND bool_and(ARRAY[food,wood,iron,stone,gold]=ARRAY[0,0,0,0,0]::bigint[]) FROM player_wallet)
AND (SELECT count(*) FROM work_queue)=3 AND (SELECT count(*) FROM mil_recruit_origin)=2 AND (SELECT count(*) FROM mil_recruit_receipt)=2
AND (SELECT last_value=101 AND is_called FROM work_queue_id_seq)
AND (SELECT array_agg(queue_id ORDER BY queue_id)=ARRAY[100,101]::bigint[] AND array_agg(status ORDER BY queue_id)=ARRAY[1,0]::smallint[]
AND sum((payload->>'count')::bigint)=4 FROM work_queue WHERE queue_type=3)
AND (SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[2147483636,12,13,14]
AND array_agg(wounded ORDER BY unit_cfg_id)=ARRAY[2147483647,2147483647,2147483647,2147483647] FROM city_troop)
AND EXISTS (SELECT FROM mil_city_origin WHERE server_id=1 AND city_id=1 AND owner_player_id=1 AND format_version=1
AND cohort_id=decode('03000000000000000000000000000000','hex'))`).Scan(&exact))
	if !exact {
		t.Fatal("near-capacity paid wallet/stock/pending/marker/allocator mismatch")
	}
	state.paid = snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitCompleteReturnChanges(t, before, state.paid, map[string]bool{"player_wallet": true, "work_queue": true, "mil_recruit_origin": true, "mil_recruit_receipt": true, "work_queue_id_seq": true})
	state.stable = recruitPromotionStable(t, f.ctx, f.observer)
	for {
		var due bool
		returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()>=$1", state.first.InitialFinishAt).Scan(&due))
		if due {
			return state
		}
		select {
		case <-time.After(25 * time.Millisecond):
		case <-f.ctx.Done():
			t.Fatal("near-capacity paid schedule did not become due", f.ctx.Err())
		}
	}
}

func recruitReturnRowsCheckpoint(t *testing.T, f *recruitCompleteReturnPG, state recruitReturnRowsState, lower, upper time.Time) map[string]string {
	t.Helper()
	if len(f.trace.args) != 1 || len(f.trace.args[0]) != 6 {
		t.Fatal("missing or duplicate real promotion arguments")
	}
	a := f.trace.args[0]
	at, atOK := a[4].(time.Time)
	finish, finishOK := a[5].(time.Time)
	if !atOK || !finishOK || a[0] != int32(1) || a[1] != int64(101) || a[2] != int64(1) || a[3] != int64(1) ||
		at != at.UTC().Truncate(time.Millisecond) || finish != at.Add(time.Duration(state.second.DurationSeconds)*time.Second) ||
		at.Before(state.first.InitialFinishAt) || at.Before(lower.UTC().Truncate(time.Millisecond)) || at.After(upper.UTC().Truncate(time.Millisecond)) {
		t.Fatal("near-capacity promotion identity or actual processing-time bounds differ")
	}
	after := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	recruitCompleteReturnChanges(t, state.paid, after, map[string]bool{"city_troop": true, "work_queue": true})
	if state.stable != recruitPromotionStable(t, f.ctx, f.observer) {
		t.Fatal("near-capacity completion changed immutable queue/stock fields or unrelated MVCC")
	}
	var exact bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT
(SELECT array_agg(status ORDER BY queue_id)=ARRAY[2,1]::smallint[] FROM work_queue WHERE queue_type=3)
AND EXISTS (SELECT FROM work_queue WHERE server_id=1 AND queue_id=100 AND start_at=$1 AND finish_at=$2)
AND EXISTS (SELECT FROM work_queue WHERE server_id=1 AND queue_id=101 AND start_at=$3 AND finish_at=$4)
AND (SELECT sum((payload->>'count')::bigint)=2 FROM work_queue WHERE queue_type=3 AND status IN(0,1))
AND (SELECT array_agg(count ORDER BY unit_cfg_id)=ARRAY[2147483638,12,13,14] FROM city_troop)
AND (SELECT count::bigint+(SELECT sum((payload->>'count')::bigint) FROM work_queue WHERE queue_type=3 AND status IN(0,1))=$5
FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1)`, state.first.InitialStartAt, state.first.InitialFinishAt, at, finish, int64(math.MaxInt32-7)).Scan(&exact))
	if !exact {
		t.Fatal("near-capacity committed ready/pending/schedule checkpoint differs")
	}
	return after
}

func recruitReturnRowQueries(schema string) []string {
	var queries []string
	for _, row := range []struct{ table, predicate string }{
		{"player_wallet", "server_id=1 AND player_id=1"}, {"player_city", "server_id=1 AND city_id=1"},
		{"city_troop", "server_id=1 AND city_id=1 AND unit_cfg_id=1"}, {"city_troop", "server_id=1 AND city_id=1 AND unit_cfg_id=2"},
		{"city_troop", "server_id=1 AND city_id=1 AND unit_cfg_id=3"}, {"city_troop", "server_id=1 AND city_id=1 AND unit_cfg_id=4"},
	} {
		queries = append(queries, "SELECT 1 FROM "+pgx.Identifier{schema, row.table}.Sanitize()+" WHERE "+row.predicate+" FOR UPDATE NOWAIT")
	}
	return queries
}

// Each read-only probe owns one bounded transaction, even for expected errors.
func recruitReturnRowProbe(parent context.Context, observer *pgx.Conn, query string, locked bool) (err error) {
	ctx, cancel := context.WithTimeout(parent, 3*time.Second)
	defer cancel()
	tx, err := observer.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		clean, stop := context.WithTimeout(context.Background(), 3*time.Second)
		defer stop()
		err = errors.Join(err, tx.Rollback(clean))
		if observer.PgConn().TxStatus() != 'I' {
			err = errors.Join(err, fmt.Errorf("probe did not return to idle transaction state"))
		}
	}()
	if _, err = tx.Exec(ctx, "SET LOCAL statement_timeout='150ms'"); err != nil {
		return err
	}
	var marker int
	err = tx.QueryRow(ctx, query).Scan(&marker)
	if locked {
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "55P03" {
			return nil
		}
		return errors.Join(fmt.Errorf("expected exact row lock conflict"), err)
	}
	if err != nil {
		return err
	}
	if marker != 1 {
		return fmt.Errorf("probe did not return its exact row marker")
	}
	return nil
}
