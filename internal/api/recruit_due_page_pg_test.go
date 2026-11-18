package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type recruitDuePGTrace struct {
	returnPGTrace
	beforeRollback func(uint32)
}

func (r *recruitDuePGTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if data.SQL == "rollback" && r.beforeRollback != nil {
		hook := r.beforeRollback
		r.beforeRollback = nil
		hook(conn.PgConn().PID())
	}
	return r.returnPGTrace.TraceQueryStart(ctx, conn, data)
}

type recruitDuePG struct {
	ctx      context.Context
	observer *pgx.Conn
	binding  *recruittx.Binding
	profile  freshsource.Profile
	catalog  *march.RecruitCatalog
}

func newRecruitDuePG(t *testing.T, trace *recruitDuePGTrace) recruitDuePG {
	t.Helper()
	observer, binding, profile := recruitPGFixture(t, &trace.returnPGTrace, func(c *pgxpool.Config) {
		c.ConnConfig.Tracer = trace
	})
	var rules [4]march.RecruitRule
	for i := range rules {
		rules[i] = march.RecruitRule{UnitCfgID: int32(i + 1), Cost: march.Resources{Food: 2, Wood: 3}, SecondsPerUnit: 120}
	}
	version, err := march.RecruitManifestVersion(rules)
	returnPGOK(t, err)
	catalog, err := march.NewRecruitCatalog([]march.RecruitManifest{{Version: version, Rules: rules}}, version)
	returnPGOK(t, err)
	return recruitDuePG{ctx: returnPGContext(t), observer: observer, binding: binding, profile: profile, catalog: catalog}
}

func (f recruitDuePG) start(t *testing.T) *recruitGeneration {
	t.Helper()
	g, err := newRecruitGeneration(f.binding, f.profile, f.catalog)
	returnPGOK(t, err)
	returnPGOK(t, g.initialize(f.ctx))
	t.Cleanup(func() { returnPGOK(t, g.close()) })
	return g
}

func (f recruitDuePG) pay(t *testing.T, g *recruitGeneration) march.RecruitAcceptance {
	t.Helper()
	returnPGExec(t, f.ctx, f.observer, "SELECT setval('work_queue_id_seq',100,false)")
	result := g.admit(f.ctx, 1, march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{71}},
		march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 1, Count: 1})
	recruitAttemptPGConfirmed(t, result)
	return result.confirmed
}

func (f recruitDuePG) snapshot(t *testing.T) map[string]string {
	t.Helper()
	return returnPGSnapshot(t, f.ctx, f.observer, f.profile)
}

func TestPGRecruitDuePageCompletesPaidJobExactlyOnce(t *testing.T) {
	trace := new(recruitDuePGTrace)
	f := newRecruitDuePG(t, trace)
	g := f.start(t)
	paid := f.pay(t, g)
	before := f.snapshot(t)
	offset := len(trace.events())
	count, err := g.completeDuePage(context.Background(), 1)
	if count != 0 || !errors.Is(err, recruittx.ErrDeadline) || len(trace.events()) != offset {
		t.Fatal("unbounded scan accessed the database", count, err)
	}
	count, err = g.completeDuePage(f.ctx, 1)
	returnPGOK(t, err)
	if count != 0 || !reflect.DeepEqual(before, f.snapshot(t)) {
		t.Fatal("early scan changed committed state", count)
	}
	recruitLifetimeState(t, g, 0, false, true)

	advancePaidRecruitSchedules(t, f.ctx, f.observer, f.profile, g, &paid)
	before = f.snapshot(t)
	offset = len(trace.events())
	count, err = g.completeDuePage(f.ctx, 1)
	returnPGOK(t, err)
	if count != 1 {
		t.Fatal("due job did not report one confirmed credit", count)
	}
	events := trace.events()[offset:]
	scan := -1
	for i, event := range events {
		if strings.HasPrefix(event.sql, "SELECT COALESCE(pg_catalog.array_agg(queue_id ORDER BY finish_at,queue_id)") {
			if scan != -1 || event.err != nil || event.pid == f.observer.PgConn().PID() ||
				strings.Contains(event.sql, "FOR UPDATE") || i == 0 || events[i-1].sql != "SELECT pg_catalog.clock_timestamp()" {
				t.Fatal("unexpected due-query evidence", i, event)
			}
			scan = i
		}
	}
	if scan < 0 || scan+2 >= len(events) || events[scan+1].sql != "rollback" ||
		events[scan+1].pid != events[scan].pid || events[scan+1].err != nil ||
		events[scan+2].sql != "begin isolation level read committed" || events[len(events)-1].sql != "commit" {
		t.Fatal("completion ran before a confirmed end of the scan transaction")
	}
	after := f.snapshot(t)
	for name, old := range before {
		if (old != after[name]) != (name == "city_troop" || name == "work_queue") {
			t.Fatal("unexpected relation change during completion", name)
		}
	}
	var ready int32
	var status int16
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT count FROM city_troop WHERE server_id=1 AND city_id=1 AND unit_cfg_id=1").Scan(&ready))
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT status FROM work_queue WHERE server_id=1 AND queue_id=$1", paid.QueueID).Scan(&status))
	if ready != 12 || status != 2 {
		t.Fatal("observer saw incorrect stock or status", ready, status)
	}
	returnPGOK(t, g.close())
	returnPGOK(t, g.s.admission.waitDrained(f.ctx))
	if count, err = g.completeDuePage(f.ctx, 1); count != 0 || !errors.Is(err, errRecruitGeneration) {
		t.Fatal("closed source accepted a scan", count, err)
	}
	count, err = f.start(t).completeDuePage(f.ctx, 1)
	returnPGOK(t, err)
	if count != 0 || !reflect.DeepEqual(after, f.snapshot(t)) {
		t.Fatal("fresh source repeated an already committed credit", count)
	}
}

func TestPGRecruitDuePageWithUnconfirmedReadRollback(t *testing.T) {
	trace := new(recruitDuePGTrace)
	f := newRecruitDuePG(t, trace)
	g := f.start(t)
	paid := f.pay(t, g)
	advancePaidRecruitSchedules(t, f.ctx, f.observer, f.profile, g, &paid)
	before := f.snapshot(t)

	var pid uint32
	var terminated bool
	var closeErr error
	trace.beforeRollback = func(backend uint32) {
		pid = backend
		closeErr = f.observer.QueryRow(f.ctx, "SELECT pg_catalog.pg_terminate_backend($1, 5000)", backend).Scan(&terminated)
	}
	count, err := g.completeDuePage(f.ctx, 1)
	returnPGOK(t, closeErr)
	if pid == 0 || pid == f.observer.PgConn().PID() || !terminated || count != 0 || !errors.Is(err, errRecruitGeneration) {
		t.Fatal("unconfirmed read shutdown did not withhold discovered jobs", pid, terminated, count, err)
	}
	recruitLifetimeState(t, g, 1, true, false)
	recruitLifetimeNotDrained(t, g)
	if !reflect.DeepEqual(before, f.snapshot(t)) {
		t.Fatal("read rollback failure changed persistent state")
	}
}

func TestPGRecruitDuePageWithholdsInterruptedScan(t *testing.T) {
	for _, stopGeneration := range []bool{false, true} {
		name := "request canceled"
		if stopGeneration {
			name = "generation closed"
		}
		t.Run(name, func(t *testing.T) {
			trace := new(recruitDuePGTrace)
			f := newRecruitDuePG(t, trace)
			g := f.start(t)
			paid := f.pay(t, g)
			advancePaidRecruitSchedules(t, f.ctx, f.observer, f.profile, g, &paid)
			before := f.snapshot(t)
			offset := len(trace.events())

			ctx, cancel := context.WithCancel(f.ctx)
			defer cancel()
			atRollback, release := make(chan struct{}), make(chan struct{})
			var once sync.Once
			unblock := func() { once.Do(func() { close(release) }) }
			defer unblock()
			trace.beforeRollback = func(uint32) { close(atRollback); <-release }
			type result struct {
				count int
				err   error
			}
			done := make(chan result, 1)
			go func() {
				count, err := g.completeDuePage(ctx, 1)
				done <- result{count, err}
			}()
			select {
			case <-atRollback:
			case <-f.ctx.Done():
				t.Fatal("scan did not reach the rollback boundary")
			}
			expected := context.Canceled
			if stopGeneration {
				returnPGOK(t, g.close())
				expected = errRecruitGeneration
			} else {
				cancel()
			}
			recruitLifetimeState(t, g, 1, stopGeneration, !stopGeneration)
			unblock()
			select {
			case got := <-done:
				if got.count != 0 || !errors.Is(got.err, expected) {
					t.Fatal("interrupted read published candidates or effects", got)
				}
			case <-f.ctx.Done():
				t.Fatal("scan did not finish after rollback release")
			}
			recruitLifetimeState(t, g, 0, stopGeneration, !stopGeneration)
			if stopGeneration {
				returnPGOK(t, g.s.admission.waitDrained(f.ctx))
			}
			events := trace.events()[offset:]
			begins := 0
			for _, event := range events {
				if event.sql == "begin isolation level read committed" {
					begins++
				}
			}
			if begins != 1 || events[len(events)-1].sql != "rollback" || events[len(events)-1].err != nil ||
				!reflect.DeepEqual(before, f.snapshot(t)) {
				t.Fatal("interrupted scan ran a completion transaction or changed state")
			}
		})
	}
}
