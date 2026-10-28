package world

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func recruitCityFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, *RecruitCityLocker) {
	t.Helper()
	pool, b, p := freshFixture(t, true)
	creationSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES (1,10,7,'city',1,1),(2,11,7,'other shard',2,2)`)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	o, a := sequenceOwner(t, b, ctx)
	l, err := NewRecruitCityLocker(ctx, b, a, p)
	if err != nil {
		t.Fatal(err)
	}
	// Caller mutation must not alter captured expectations.
	p.Objects["player_city"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1}
	p.SchemaName = "substituted"
	p.ServerID = 2
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	return pool, b, l
}

func TestPGRecruitCityLockValidation(t *testing.T) {
	pool, b, l := recruitCityFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	o, a := sequenceOwner(t, b, ctx)
	if err := l.Lock(ctx, a, 7, 10); err == nil {
		t.Fatal("lock without pin")
	}
	if err := l.Pin(ctx, a); err != nil {
		t.Fatal("pin after profile mutation:", err)
	}
	var pins int
	if err := a.Scan(ctx, b, `SELECT count(*) FROM pg_catalog.pg_locks WHERE pid=pg_catalog.pg_backend_pid() AND granted AND mode='RowShareLock' AND relation=$1::pg_catalog.oid`, []any{l.source.profile.Objects["player_city"].OID}, &pins); err != nil || pins != 1 {
		t.Fatal("player_city pin", pins, err)
	}
	for _, tc := range []struct{ player, city int64 }{{0, 10}, {-1, 10}, {7, 0}, {7, -1}, {8, 10}, {7, 11}, {7, 999}} {
		if err := l.Lock(ctx, a, tc.player, tc.city); err == nil {
			t.Fatalf("invalid city admitted: %+v", tc)
		}
	}
	if err := l.Lock(ctx, a, 7, 10); err != nil {
		t.Fatal("owner", err)
	}
	wrong, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	_, foreign := sequenceOwner(t, wrong, ctx)
	if l.Pin(ctx, foreign) == nil || l.Lock(ctx, foreign, 7, 10) == nil {
		t.Fatal("wrong binding")
	}
	canceled, stop := context.WithCancel(ctx)
	stop()
	if l.Pin(canceled, a) == nil || l.Lock(canceled, a, 7, 10) == nil {
		t.Fatal("canceled access")
	}
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if l.Pin(ctx, a) == nil || l.Lock(ctx, a, 7, 10) == nil {
		t.Fatal("ended access")
	}
}

func TestPGRecruitCityRetirementSharedAcrossCopies(t *testing.T) {
	pool, b, l := recruitCityFixture(t)
	copyLocker := *l
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	creationSQL(t, pool, "ALTER TABLE map_cell ADD COLUMN surprise integer")
	o, a := sequenceOwner(t, b, ctx)
	if err := l.Pin(ctx, a); err == nil {
		t.Fatal("source drift accepted")
	}
	if !l.source.sequence.retired.Load() {
		t.Fatal("not retired")
	}
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	creationSQL(t, pool, "ALTER TABLE map_cell DROP COLUMN surprise")
	_, a = sequenceOwner(t, b, ctx)
	if copyLocker.Pin(ctx, a) == nil || copyLocker.Lock(ctx, a, 7, 10) == nil {
		t.Fatal("retired copy reopened")
	}
}

func TestPGRecruitCityOwnerUpdateWaitsForEnd(t *testing.T) {
	for _, commit := range []bool{true, false} {
		t.Run(map[bool]string{true: "commit", false: "rollback"}[commit], func(t *testing.T) {
			pool, b, l := recruitCityFixture(t)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			o, a := sequenceOwner(t, b, ctx)
			if err := l.Pin(ctx, a); err != nil {
				t.Fatal(err)
			}
			if err := l.Lock(ctx, a, 7, 10); err != nil {
				t.Fatal(err)
			}
			conn, err := pool.Acquire(ctx)
			if err != nil {
				t.Fatal(err)
			}
			pid := conn.Conn().PgConn().PID()
			done := make(chan error, 1)
			finished := false
			defer func() {
				if !finished {
					cancel()
					<-done
				}
				conn.Release()
			}()
			go func() {
				_, e := conn.Exec(ctx, "UPDATE player_city SET player_id=8 WHERE server_id=1 AND city_id=10")
				done <- e
			}()
			// Observe a genuine ungranted PostgreSQL lock, not merely a slow goroutine.
			deadline := time.Now().Add(5 * time.Second)
			for {
				var waiting bool
				if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT FROM pg_catalog.pg_locks WHERE pid=$1 AND NOT granted)`, pid).Scan(&waiting); err != nil {
					t.Fatal(err)
				}
				if waiting {
					break
				}
				select {
				case err := <-done:
					finished = true
					t.Fatalf("update completed before end: %v", err)
				default:
				}
				if time.Now().After(deadline) {
					t.Fatal("no observed lock wait")
				}
				time.Sleep(10 * time.Millisecond)
			}
			select {
			case err := <-done:
				finished = true
				t.Fatalf("update completed while locked: %v", err)
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
			err = <-done
			finished = true
			if err != nil {
				t.Fatal("update after end", err)
			}
			var owner int64
			if err := pool.QueryRow(ctx, "SELECT player_id FROM player_city WHERE server_id=1 AND city_id=10").Scan(&owner); err != nil || owner != 8 {
				t.Fatal("update result", owner, err)
			}
		})
	}
}

func TestPGRecruitCityConstructorRejectsWrongExpectations(t *testing.T) {
	pool, b, p := freshFixture(t, false)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, a := sequenceOwner(t, b, ctx)
	wrong, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	if l, err := NewRecruitCityLocker(ctx, wrong, a, p); err == nil || l != nil {
		t.Fatal("wrong binding construction")
	}
	for _, mutate := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { delete(p.Objects, "player_city") },
		func(p *freshsource.Profile) { p.Objects["extra"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1} },
		func(p *freshsource.Profile) { p.ServerID = 0 },
		func(p *freshsource.Profile) { p.DatabaseOID++ },
		func(p *freshsource.Profile) {
			p.Objects["player_city"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1}
		},
	} {
		bad, err := freshsource.Snapshot(p)
		if err != nil {
			t.Fatal(err)
		}
		mutate(&bad)
		if l, err := NewRecruitCityLocker(ctx, b, a, bad); err == nil || l != nil {
			t.Fatal("bad profile accepted")
		}
	}
}
