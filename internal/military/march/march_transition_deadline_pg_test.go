package march

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

func arrivalDeadlineCases(arrive time.Time) []struct {
	name string
	at   time.Time
	ok   bool
} {
	return []struct {
		name string
		at   time.Time
		ok   bool
	}{
		{"before", arrive.Add(-time.Microsecond), false},
		{"equal", arrive, false},
		{"one-nanosecond", arrive.Add(time.Nanosecond), false},
		{"999-nanoseconds", arrive.Add(999 * time.Nanosecond), false},
		{"one-microsecond", arrive.Add(time.Microsecond), true},
		{"fractional-microsecond", arrive.Add(1999 * time.Nanosecond), true},
		{"zoned", arrive.Add(time.Hour).In(time.FixedZone("west", -9*3600)), true},
		{"utc-underflow", time.Date(1, 1, 1, 0, 0, 0, 0, time.FixedZone("east", 3600)), false},
		{"utc-overflow", time.Date(9999, 12, 31, 23, 59, 59, 0, time.FixedZone("west", -3600)), false},
	}
}

func TestArrivalReturnDeadline(t *testing.T) {
	arrive := time.Unix(transitionReturnEpoch-3600, 0).UTC()
	for _, tc := range arrivalDeadlineCases(arrive) {
		t.Run(tc.name, func(t *testing.T) {
			got, err := arrivalReturnDeadline(arrive, tc.at)
			if tc.ok {
				if err != nil || !got.Equal(tc.at.UTC().Truncate(time.Microsecond)) || got.Location() != time.UTC {
					t.Fatalf("deadline %s: %v", got, err)
				}
			} else if !errors.Is(err, ErrMarchTransition) || !got.IsZero() {
				t.Fatalf("invalid deadline %s: %v", got, err)
			}
		})
	}
	if _, err := arrivalReturnDeadline(time.Time{}, arrive); !errors.Is(err, ErrMarchTransition) {
		t.Fatal("accepted invalid arrival")
	}
	preEpoch := time.Date(1960, 1, 1, 0, 0, 0, 0, time.UTC)
	if got, err := arrivalReturnDeadline(preEpoch, preEpoch.Add(1999*time.Nanosecond)); err != nil || !got.Equal(preEpoch.Add(time.Microsecond)) {
		t.Fatalf("pre-Unix-epoch microseconds %s: %v", got, err)
	}
}

const arrivalDeadlineHero = `UPDATE field_army SET hero_ids='{11}' WHERE server_id=1 AND army_id=500;INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,11,7,11,3),(1,12,8,12,1);INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y) VALUES(1,501,8,1,99,88);INSERT INTO army_troop VALUES(1,501,1,17);INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,origin_city_id) VALUES(1,501,501,1,1,2,2,1,'2026-10-29T10:00:00Z','2026-10-29T11:00:00Z',4,101);`

func TestPGMarchArrivalDeadline(t *testing.T) {
	for _, battle := range []string{"battle", "no-battle"} {
		for _, tc := range arrivalDeadlineCases(time.Unix(transitionReturnEpoch-3600, 0).UTC()) {
			t.Run(battle+"/"+tc.name, func(t *testing.T) {
				pool, conn, tr := transitionFixture(t, arrivalDeadlineHero)
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				before := restoreEndSnapshot(t, pool, tr.profile.SchemaName)
				in := transitionCommit(transitionReport())
				in.ReturnAt = tc.at
				if battle == "no-battle" {
					in.Report, in.Survivors = nil, []TroopStack{{1, 200}, {2, 50}}
				}
				tx, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
				baseOK(t, err)
				defer func() { _ = tx.Rollback(ctx) }()
				got, commitErr := tr.Commit(ctx, tx, in)
				if !tc.ok {
					if !errors.Is(commitErr, ErrMarchTransition) || got != (ArrivalCommitted{}) {
						t.Fatalf("accepted invalid arrival: %+v %v", got, commitErr)
					}
					// Deliberately ignore the returned error and commit the caller's tx.
					baseOK(t, tx.Commit(ctx))
					if restoreEndSnapshot(t, pool, tr.profile.SchemaName) != before {
						t.Fatal("rejection changed source rows or any allocator")
					}
					return
				}
				baseOK(t, commitErr)
				if got.Status != 3 || got.ArmyID != 500 || (got.ReportID != 0) != (battle == "battle") {
					t.Fatalf("arrival result %+v", got)
				}
				if transitionSnapshot(t, conn) != transitionSnapshot(t, pool) {
					t.Fatal("independent observer mismatch")
				}
				var status int16
				baseOK(t, conn.QueryRow(ctx, `SELECT status FROM march_order WHERE march_id=500`).Scan(&status))
				if status != 1 {
					t.Fatal("transition committed the caller's transaction")
				}
				baseOK(t, tx.Commit(ctx))
				var persisted time.Time
				baseOK(t, conn.QueryRow(ctx, `SELECT return_finish_at FROM march_order WHERE march_id=500`).Scan(&persisted))
				want := tc.at.UTC().Truncate(time.Microsecond)
				if !persisted.Equal(want) {
					t.Fatalf("stored deadline %s want %s", persisted, want)
				}
				after := restoreEndSnapshot(t, pool, tr.profile.SchemaName)
				r, err := NewMarchRestore(ctx, pool, tr.profile)
				baseOK(t, err)
				h := NewHub(time.Now)
				res, err := r.Restore(ctx, h)
				baseOK(t, err)
				if len(res.Marches) != 1 || len(res.Release) != 0 || len(h.restoreEv) != 1 || len(h.scheduler.events) != 0 ||
					h.marches[500] == nil || h.marches[500].Phase != PhaseReturning || !h.marches[500].ReturnFinishAt.Equal(want) {
					t.Fatalf("unrestorable committed arrival: %+v", res)
				}
				baseOK(t, h.ActivateRestore())
				if len(h.scheduler.events) != 1 || !h.scheduler.NextDue().Equal(want) || restoreEndSnapshot(t, pool, tr.profile.SchemaName) != after {
					t.Fatal("restore changed rows/allocators or lost the returning event")
				}
			})
		}
	}
}

func TestPGMarchArrivalDeadlineTerminal(t *testing.T) {
	pool, conn, tr := transitionFixture(t, arrivalDeadlineHero)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	in := transitionCommit(transitionReport())
	in.Survivors, in.ReturnAt = nil, time.Time{}
	got, err := commitTx(pool, tr, in)
	baseOK(t, err)
	var absent bool
	baseOK(t, conn.QueryRow(ctx, `SELECT return_finish_at IS NULL FROM march_order WHERE march_id=500`).Scan(&absent))
	if got.Status != 4 || got.ReportID == 0 || !absent {
		t.Fatalf("terminal %+v deadline absent=%v", got, absent)
	}
	after := restoreEndSnapshot(t, pool, tr.profile.SchemaName)
	r, err := NewMarchRestore(ctx, pool, tr.profile)
	baseOK(t, err)
	h := NewHub(time.Now)
	res, err := r.Restore(ctx, h)
	baseOK(t, err)
	if len(res.Marches) != 0 || len(res.Release) != 1 || res.Release[0].HeroID != 11 || len(h.restoreEv) != 0 ||
		restoreEndSnapshot(t, pool, tr.profile.SchemaName) != after {
		t.Fatalf("terminal restore %+v", res)
	}
}

func TestPGMarchArrivalDeadlineStatusPrecedence(t *testing.T) {
	for _, tc := range []struct {
		name, sql string
		want      error
	}{
		{"missing", `DELETE FROM march_order WHERE march_id=500`, ErrArrivalMissing},
		{"returning", `UPDATE march_order SET status=3 WHERE march_id=500`, ErrArrivalReplayed},
		{"terminal", `UPDATE march_order SET status=4 WHERE march_id=500`, ErrArrivalReplayed},
		{"returning-infinity", `UPDATE march_order SET status=3,arrive_at='infinity' WHERE march_id=500`, ErrArrivalReplayed},
		{"returning-negative-infinity", `UPDATE march_order SET status=3,arrive_at='-infinity' WHERE march_id=500`, ErrArrivalReplayed},
		{"terminal-positive-infinity", `UPDATE march_order SET status=4,arrive_at='infinity' WHERE march_id=500`, ErrArrivalReplayed},
		{"terminal-infinity", `UPDATE march_order SET status=4,arrive_at='-infinity' WHERE march_id=500`, ErrArrivalReplayed},
		{"arrival-infinity", `UPDATE march_order SET arrive_at='infinity' WHERE march_id=500`, ErrMarchTransition},
		{"arrival-negative-infinity", `UPDATE march_order SET arrive_at='-infinity' WHERE march_id=500`, ErrMarchTransition},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pool, _, tr := transitionFixture(t, tc.sql)
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			before := restoreEndSnapshot(t, pool, tr.profile.SchemaName)
			in := transitionCommit(transitionReport())
			in.ReturnAt = time.Unix(transitionReturnEpoch-3600, 0).UTC()
			tx, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
			baseOK(t, err)
			defer func() { _ = tx.Rollback(ctx) }()
			got, err := tr.Commit(ctx, tx, in)
			if !errors.Is(err, tc.want) || got != (ArrivalCommitted{}) {
				t.Fatalf("status precedence %+v %v", got, err)
			}
			baseOK(t, tx.Commit(ctx))
			if restoreEndSnapshot(t, pool, tr.profile.SchemaName) != before {
				t.Fatal("status refusal changed rows or allocators")
			}
		})
	}
}

func TestPGMarchArrivalDeadlineTerminalInfinity(t *testing.T) {
	for _, value := range []string{"infinity", "-infinity"} {
		t.Run(value, func(t *testing.T) {
			pool, conn, tr := transitionFixture(t, `UPDATE march_order SET arrive_at='`+value+`' WHERE march_id=500`)
			in := transitionCommit(transitionReport())
			in.Survivors, in.ReturnAt = nil, time.Time{}
			got, err := commitTx(pool, tr, in)
			baseOK(t, err)
			var absent bool
			baseOK(t, conn.QueryRow(context.Background(), `SELECT return_finish_at IS NULL FROM march_order WHERE march_id=500`).Scan(&absent))
			if got.Status != 4 || !absent {
				t.Fatalf("terminal classification changed: %+v", got)
			}
		})
	}
}

func TestPGMarchArrivalDeadlineLockedRead(t *testing.T) {
	pool, _, tr := transitionFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	holder, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	baseOK(t, err)
	defer func() { _ = holder.Rollback(ctx) }()
	_, err = holder.Exec(ctx, `UPDATE march_order SET arrive_at='2026-10-29T15:00:00Z' WHERE march_id=500`)
	baseOK(t, err)
	var holderPID, pid int
	baseOK(t, holder.QueryRow(ctx, `SELECT pg_backend_pid()`).Scan(&holderPID))
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	baseOK(t, err)
	defer func() { _ = tx.Rollback(ctx) }()
	baseOK(t, tx.QueryRow(ctx, `SELECT pg_backend_pid()`).Scan(&pid))
	errs := make(chan error, 1)
	go func() {
		_, e := tr.Commit(ctx, tx, transitionCommit(transitionReport()))
		errs <- e
	}()
	if !transitionWait(pool, pid, holderPID, `%march_order%FOR UPDATE%`) {
		_ = holder.Rollback(ctx)
		<-errs
		t.Fatal("arrival did not wait on the locked order")
	}
	// Capture the holder's own row version; only that legitimate update may persist.
	rows := transitionSnapshot(t, holder)
	baseOK(t, holder.Commit(ctx))
	if err := <-errs; !errors.Is(err, ErrMarchTransition) {
		t.Fatalf("accepted stale pre-lock arrival: %v", err)
	}
	before := restoreEndSnapshot(t, pool, tr.profile.SchemaName)
	baseOK(t, tx.Commit(ctx))
	if transitionSnapshot(t, pool) != rows || restoreEndSnapshot(t, pool, tr.profile.SchemaName) != before {
		t.Fatal("refused locked deadline changed rows or allocators")
	}
	var called bool
	baseOK(t, pool.QueryRow(ctx, `SELECT is_called FROM battle_report_report_id_seq`).Scan(&called))
	if called {
		t.Fatal("refused locked deadline allocated a report")
	}
}
