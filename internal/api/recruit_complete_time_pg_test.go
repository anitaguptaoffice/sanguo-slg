package api

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
)

// Advance actual paid jobs only after proving the real caller rejects early completion.
// Receipts move with schedules so replay expectations describe the controlled fixture.
func advancePaidRecruitSchedules(t *testing.T, ctx context.Context, observer *pgx.Conn, profile freshsource.Profile, g *recruitGeneration, accepted ...*march.RecruitAcceptance) {
	t.Helper()
	if len(accepted) == 0 {
		t.Fatal("time fixture requires a paid active job")
	}
	before := returnPGSnapshot(t, ctx, observer, profile)
	early := g.complete(ctx, march.RecruitCandidate{ServerID: 1, PlayerID: 1, CityID: 1, QueueID: accepted[0].QueueID})
	recruitAttemptPGConfirmed(t, early)
	if early.completion != march.RecruitEarly || early.confirmed != (march.RecruitAcceptance{}) || !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
		t.Fatal("pre-advance completion was not an unchanged Early result", early)
	}
	recruitLifetimeState(t, g, 0, false, true)
	immutable := func() string {
		var value string
		returnPGOK(t, observer.QueryRow(ctx, `SELECT jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(q)-'start_at'-'finish_at' ORDER BY server_id,queue_id) FROM work_queue q),
 (SELECT jsonb_agg(to_jsonb(r)-'accepted_at'-'initial_start_at'-'initial_finish_at' ORDER BY server_id,queue_id) FROM mil_recruit_receipt r))::text`).Scan(&value))
		return value
	}
	nonTime := immutable()
	tx, err := observer.Begin(ctx)
	returnPGOK(t, err)
	defer func() { _ = tx.Rollback(ctx) }()
	for i, a := range accepted {
		status := int16(0)
		if i == 0 {
			status = 1
		}
		if a.QueueID != int64(100+i) || a.CityID != 1 || a.InitialStatus != status {
			t.Fatal("unexpected paid fixture identity/status", a)
		}
		for _, query := range []string{
			`UPDATE work_queue SET start_at=start_at-interval '1 hour',finish_at=finish_at-interval '1 hour'
 WHERE server_id=1 AND player_id=1 AND city_id=1 AND queue_type=3 AND queue_id=$1 AND status=$2
 AND start_at=$3 AND finish_at=$4 AND $5::timestamptz<=start_at`,
			`UPDATE mil_recruit_receipt r SET accepted_at=accepted_at-interval '1 hour',initial_start_at=initial_start_at-interval '1 hour',initial_finish_at=initial_finish_at-interval '1 hour'
 WHERE server_id=1 AND city_id=1 AND queue_id=$1 AND initial_status=$2
 AND initial_start_at=$3 AND initial_finish_at=$4 AND accepted_at=$5
 AND EXISTS(SELECT FROM mil_recruit_origin o WHERE o.server_id=r.server_id AND o.queue_id=r.queue_id AND o.player_id=1)`,
		} {
			tag, err := tx.Exec(ctx, query, a.QueueID, status, a.InitialStartAt, a.InitialFinishAt, a.AcceptedAt)
			returnPGOK(t, err)
			if tag.RowsAffected() != 1 {
				t.Fatal("time fixture must update exactly one owned expected row", tag)
			}
		}
	}
	returnPGOK(t, tx.Commit(ctx))
	if nonTime != immutable() {
		t.Fatal("time fixture changed non-time fields")
	}
	after := returnPGSnapshot(t, ctx, observer, profile)
	if len(before) != len(after) {
		t.Fatal("time fixture changed relation inventory")
	}
	for name, old := range before {
		if name != "work_queue" && name != "mil_recruit_receipt" && old != after[name] {
			t.Fatal("time fixture changed unrelated relation", name)
		}
	}
	for _, a := range accepted {
		a.AcceptedAt = a.AcceptedAt.Add(-time.Hour)
		a.InitialStartAt = a.InitialStartAt.Add(-time.Hour)
		a.InitialFinishAt = a.InitialFinishAt.Add(-time.Hour)
		var valid bool
		returnPGOK(t, observer.QueryRow(ctx, `SELECT q.start_at=$2 AND q.finish_at=$3 AND r.accepted_at=$4
 AND q.start_at=r.initial_start_at AND q.finish_at=r.initial_finish_at
 AND q.finish_at=q.start_at+r.duration_sec*interval '1 second' AND r.duration_sec=$5
 AND r.accepted_at<=q.start_at AND q.finish_at<clock_timestamp()
 FROM work_queue q JOIN mil_recruit_receipt r USING(server_id,queue_id)
 WHERE q.server_id=1 AND q.queue_id=$1`, a.QueueID, a.InitialStartAt, a.InitialFinishAt, a.AcceptedAt, a.DurationSeconds).Scan(&valid))
		if !valid {
			t.Fatal("time fixture lost exact schedule/receipt/duration", a.QueueID)
		}
	}
}
