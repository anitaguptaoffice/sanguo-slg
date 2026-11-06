package world

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestPGReturnOriginValidationAndNoWrites(t *testing.T) {
	pool, b, l := recruitCityFixture(t) // Quoted schema and mutated caller profile.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	creationSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES
 (2,10,8,'same ID',12,13),(1,12,7,'zero',0,0),(1,13,7,'upper',499,499),
 (1,14,7,'negative x',-1,1),(1,15,7,'negative y',1,-1),
 (1,16,7,'outside x',500,1),(1,17,7,'outside y',1,500)`)
	snapshot := func() string {
		var state string
		if err := pool.QueryRow(ctx, `SELECT jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(c) ORDER BY server_id,city_id) FROM player_city c),
 (SELECT jsonb_agg(to_jsonb(m) ORDER BY server_id,x,y) FROM map_cell m),
 last_value,log_cnt,is_called)::text FROM player_city_id_seq`).Scan(&state); err != nil {
			t.Fatal(err)
		}
		return state
	}
	before := snapshot()
	o, a := sequenceOwner(t, b, ctx)
	rejectReturnOrigin(t, l, ctx, a, 7, 10, ErrFreshCitySource)
	if err := l.Pin(ctx, a); err != nil {
		t.Fatal("pin after caller profile mutation", err)
	}
	var pins int
	if err := a.Scan(ctx, b, `SELECT count(*) FROM pg_catalog.pg_locks WHERE pid=pg_backend_pid()
 AND granted AND mode='RowShareLock' AND relation=$1::oid`, []any{l.source.profile.Objects["player_city"].OID}, &pins); err != nil || pins != 1 {
		t.Fatal("city pin", pins, err)
	}
	for _, ids := range [][2]int64{{0, 10}, {-1, 10}, {7, 0}, {7, -1}, {8, 10}, {7, 11}, {7, 999}, {7, 14}, {7, 15}, {7, 16}, {7, 17}} {
		rejectReturnOrigin(t, l, ctx, a, ids[0], ids[1], ErrRecruitCity)
	}
	copyLocker, copyAccess := *l, *a
	for _, want := range []ReturnOrigin{{1, 7, 10, 1, 1}, {1, 7, 12, 0, 0}, {1, 7, 13, 499, 499}} {
		got, err := copyLocker.LockReturnOrigin(ctx, &copyAccess, want.PlayerID, want.CityID)
		if err != nil || got != want {
			t.Fatal("captured scope or bounds", got, err)
		}
	}
	wrong, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	foreignOwner, foreign := sequenceOwner(t, wrong, ctx)
	rejectReturnOrigin(t, l, ctx, foreign, 7, 10, recruittx.ErrBinding)
	if err := foreignOwner.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	canceled, stop := context.WithCancel(ctx)
	stop()
	rejectReturnOrigin(t, l, canceled, a, 7, 10, context.Canceled)
	if l.source.sequence.retired.Load() {
		t.Fatal("business, binding or cancellation error retired source")
	}
	if err := o.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	rejectReturnOrigin(t, l, ctx, &copyAccess, 7, 10, recruittx.ErrInactive)
	if after := snapshot(); after != before {
		t.Fatal("city/map rows or explicit sequence fields changed")
	}
	_, a = sequenceOwner(t, b, ctx)
	if err := l.Pin(ctx, a); err != nil {
		t.Fatal(err)
	}
	if got, err := l.LockReturnOrigin(ctx, a, 7, 10); err != nil || got != (ReturnOrigin{1, 7, 10, 1, 1}) {
		t.Fatal("source failed to remain usable", got, err)
	}
}

func TestPGReturnOriginDriftRetirement(t *testing.T) {
	pool, b, l := recruitCityFixture(t)
	copyLocker := *l
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	o, a := sequenceOwner(t, b, ctx)
	if err := l.Pin(ctx, a); err != nil {
		t.Fatal(err)
	}
	// Drift after Pin forces the companion itself to revalidate the source.
	creationSQL(t, pool, "ALTER TABLE map_cell ADD COLUMN surprise integer")
	rejectReturnOrigin(t, l, ctx, a, 7, 10, ErrFreshCitySource)
	if !copyLocker.source.sequence.retired.Load() {
		t.Fatal("definitive drift did not retire copies")
	}
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	creationSQL(t, pool, "ALTER TABLE map_cell DROP COLUMN surprise")
	_, a = sequenceOwner(t, b, ctx)
	rejectReturnOrigin(t, &copyLocker, ctx, a, 7, 10, ErrRecruitCity)
}

func TestPGReturnOriginWriterWaitsForEnd(t *testing.T) {
	for _, commit := range []bool{false, true} {
		t.Run(map[bool]string{false: "rollback", true: "commit"}[commit], func(t *testing.T) {
			pool, b, l := recruitCityFixture(t)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			o, a := sequenceOwner(t, b, ctx)
			if err := l.Pin(ctx, a); err != nil {
				t.Fatal(err)
			}
			old, err := l.LockReturnOrigin(ctx, a, 7, 10)
			if err != nil || old != (ReturnOrigin{1, 7, 10, 1, 1}) {
				t.Fatal(old, err)
			}
			var holding uint32
			if err := a.Scan(ctx, b, "SELECT pg_backend_pid()", nil, &holding); err != nil {
				t.Fatal(err)
			}
			writer, err := pool.Acquire(ctx)
			if err != nil {
				t.Fatal(err)
			}
			done, finished := make(chan error, 1), false
			defer func() {
				cancel()
				if !finished {
					<-done
				}
				writer.Release()
			}()
			go func() {
				_, err := writer.Exec(ctx, "UPDATE player_city SET player_id=8,x=23,y=24 WHERE server_id=1 AND city_id=10")
				done <- err
			}()
			awaitOwnerBlock(t, pool, writer.Conn().PgConn().PID(), holding)
			select {
			case err := <-done:
				finished = true
				t.Fatalf("writer escaped retained lock: %v", err)
			default:
			}
			if commit {
				err = o.Commit(ctx)
			} else {
				err = o.Rollback(ctx)
			}
			if err != nil {
				t.Fatal(err)
			}
			err, finished = <-done, true
			if err != nil {
				t.Fatal("writer did not resume", err)
			}
			rejectReturnOrigin(t, l, ctx, a, 8, 10, recruittx.ErrInactive)
			_, fresh := sequenceOwner(t, b, ctx)
			if err := l.Pin(ctx, fresh); err != nil {
				t.Fatal(err)
			}
			rejectReturnOrigin(t, l, ctx, fresh, 7, 10, ErrRecruitCity)
			got, err := l.LockReturnOrigin(ctx, fresh, 8, 10)
			if err != nil || got != (ReturnOrigin{1, 8, 10, 23, 24}) || old != (ReturnOrigin{1, 7, 10, 1, 1}) {
				t.Fatal("fresh snapshot or copied value", got, old, err)
			}
		})
	}
}

func TestPGReturnOriginWaitReadsLockedSnapshot(t *testing.T) {
	pool, b, l := recruitCityFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	holder := creationBegin(t, pool)
	if _, err := holder.Exec(ctx, "UPDATE player_city SET x=31,y=32 WHERE server_id=1 AND city_id=10"); err != nil {
		t.Fatal(err)
	}
	_, a := sequenceOwner(t, b, ctx)
	if err := l.Pin(ctx, a); err != nil {
		t.Fatal(err)
	}
	var waiting uint32
	if err := a.Scan(ctx, b, "SELECT pg_backend_pid()", nil, &waiting); err != nil {
		t.Fatal(err)
	}
	type result struct {
		origin ReturnOrigin
		err    error
	}
	done, finished := make(chan result, 1), false
	defer func() {
		cancel()
		if !finished {
			<-done
		}
	}()
	go func() {
		got, err := l.LockReturnOrigin(ctx, a, 7, 10)
		done <- result{got, err}
	}()
	awaitOwnerBlock(t, pool, waiting, holder.Conn().PgConn().PID())
	if err := holder.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	got := <-done
	finished = true
	if got.err != nil || got.origin != (ReturnOrigin{1, 7, 10, 31, 32}) {
		t.Fatal("read coordinates before acquiring row lock", got)
	}
}

func TestPGReturnOriginCancellationKeepsSourceAndCallerOwnership(t *testing.T) {
	pool, b, l := recruitCityFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	holder := creationBegin(t, pool)
	if _, err := holder.Exec(ctx, "UPDATE player_city SET x=41,y=42 WHERE server_id=1 AND city_id=10"); err != nil {
		t.Fatal(err)
	}
	o, a := sequenceOwner(t, b, ctx)
	if err := l.Pin(ctx, a); err != nil {
		t.Fatal(err)
	}
	var waiting uint32
	if err := a.Scan(ctx, b, "SELECT pg_backend_pid()", nil, &waiting); err != nil {
		t.Fatal(err)
	}
	call, stop := context.WithCancel(ctx)
	type result struct {
		origin ReturnOrigin
		err    error
	}
	done, finished := make(chan result, 1), false
	defer func() {
		stop()
		if !finished {
			<-done
		}
	}()
	go func() {
		got, err := l.LockReturnOrigin(call, a, 7, 10)
		done <- result{got, err}
	}()
	awaitOwnerBlock(t, pool, waiting, holder.Conn().PgConn().PID())
	stop()
	got := <-done
	finished = true
	if got.origin != (ReturnOrigin{}) || !errors.Is(got.err, context.Canceled) || l.source.sequence.retired.Load() {
		t.Fatal("cancellation result or retirement", got)
	}
	// SQL cancellation may close the connection; caller still owns cleanup.
	_ = o.Rollback(ctx)
	if err := holder.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	o, a = sequenceOwner(t, b, ctx)
	if err := l.Pin(ctx, a); err != nil {
		t.Fatal("source retired after cancellation", err)
	}
	if _, err := a.Exec(ctx, b, "UPDATE player_city SET player_id=8,x=41,y=42 WHERE server_id=1 AND city_id=10"); err != nil {
		t.Fatal(err)
	}
	origin, err := l.LockReturnOrigin(ctx, a, 8, 10)
	if err != nil || origin != (ReturnOrigin{1, 8, 10, 41, 42}) {
		t.Fatal("did not use caller transaction", origin, err)
	}
	for _, afterEnd := range []bool{false, true} {
		if afterEnd {
			if err := o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
		}
		var owner int64
		var x, y int32
		if err := pool.QueryRow(ctx, "SELECT player_id,x,y FROM player_city WHERE server_id=1 AND city_id=10").Scan(&owner, &x, &y); err != nil || owner != 7 || x != 1 || y != 1 {
			t.Fatal("caller mutation committed or rollback lost", owner, x, y, err)
		}
	}
}
