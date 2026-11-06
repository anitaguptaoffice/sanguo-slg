package api

import (
	"context"
	"reflect"
	"testing"
	"time"
)

func TestPGRecruitReturnFixtureIsolationAndPoolReuse(t *testing.T) {
	f := newRecruitReturnPG(t, 11)
	before := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	recruitReturnPoolReusable(t, ctx, f.pool, f.observer.PgConn().PID())
	cancel()
	if !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("two-slot fixture read changed durable state")
	}
	call := f.start(true)
	pid := returnLifetimeReached(t, f.trace.returnLifetimeTrace)
	if pid == f.observer.PgConn().PID() {
		t.Fatal("fixture observer reused as actual writer")
	}
	f.locked(t)
	visible := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	for name, old := range before {
		if name != "work_queue_id_seq" && old != visible[name] {
			t.Fatal("uncommitted fixture admission visible", name)
		}
	}
	f.trace.release()
	f.join(t, call)
	recruitAttemptPGConfirmed(t, call.recruit)
	returnLifetimeNoLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
	returnPGReleased(t, f.ctx, f.observer, f.profile)
	accepted := snapshotReturnAttemptPG(t, f.returnAttemptPG, false)
	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
	recruitReturnPoolReusable(t, ctx, f.pool, f.observer.PgConn().PID())
	cancel()
	if !reflect.DeepEqual(accepted, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("post-attempt two-slot read changed durable state")
	}
	if f.pool.Stat().AcquiredConns() != 0 {
		t.Fatal("standalone fixture left an acquired slot")
	}
}
