package api

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// The second gate exposes the committed leader checkpoint before the follower
// can leave its successful wallet read. Both gates observe real transaction SQL.
type recruitReturnTrace struct {
	*returnLifetimeTrace
	walletSQL                   string
	pauseWallet                 bool
	walletReached, walletResume chan struct{}
	walletOnce, walletReleased  sync.Once
}

func (r *recruitReturnTrace) releaseWallet() { r.walletReleased.Do(func() { close(r.walletResume) }) }
func (r *recruitReturnTrace) TraceQueryEnd(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryEndData) {
	r.returnPGTrace.TraceQueryEnd(ctx, conn, data)
	if r.pauseWallet && data.Err == nil && r.events()[ctx.Value(returnPGTraceKey{}).(int)].sql == r.walletSQL {
		r.walletOnce.Do(func() {
			close(r.walletReached)
			select {
			case <-r.walletResume:
			case <-ctx.Done():
			}
		})
	}
}

type recruitReturnCall struct {
	done     chan struct{}
	recruit  recruitAttemptResult
	returned returnAttemptResult
	fault    any
}
type recruitReturnPG struct {
	*returnAttemptPG
	recruit *recruitGeneration
	trace   *recruitReturnTrace
	scope   march.RecruitScope
	intent  march.RecruitIntent
	calls   []*recruitReturnCall
}

func newRecruitReturnPG(t *testing.T, ready int32) *recruitReturnPG {
	t.Helper()
	trace := &recruitReturnTrace{returnLifetimeTrace: returnLifetimeTracer("commit"),
		walletReached: make(chan struct{}), walletResume: make(chan struct{})}
	pool, observer, binding, profile := returnPGFixture(t, trace, func(c *pgxpool.Config) { c.MaxConns = 2 })
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	f := &recruitReturnPG{returnAttemptPG: &returnAttemptPG{ctx: ctx, pool: pool, observer: observer, binding: binding,
		profile: profile, catalog: recruitAttemptPGCatalog(t), due: returnAttemptDue}, trace: trace,
		scope:  march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{9}},
		intent: march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 1, Count: 2}}
	t.Cleanup(func() {
		cancel()
		trace.release()
		trace.releaseWallet()
		clean, stop := context.WithTimeout(context.Background(), 8*time.Second)
		defer stop()
		for _, call := range f.calls {
			select {
			case <-call.done:
			case <-clean.Done():
				t.Error("interop workers did not join; no backend termination attempted")
				return
			}
		}
		if f.generation != nil {
			returnPGOK(t, f.generation.close())
			returnPGOK(t, f.generation.s.admission.waitDrained(clean))
		}
		if f.recruit != nil {
			returnPGOK(t, f.recruit.close())
			returnPGOK(t, f.recruit.s.admission.waitDrained(clean))
		}
		if pool.Stat().AcquiredConns() != 0 {
			t.Error("interop retained pool connections after joined calls")
		}
		returnPGReleased(t, clean, observer, profile)
		reuse, releaseReuse := context.WithTimeout(context.Background(), 5*time.Second)
		defer releaseReuse()
		recruitReturnPoolReusable(t, reuse, pool, observer.PgConn().PID())
		if pool.Stat().AcquiredConns() != 0 {
			t.Error("interop reuse probe did not release both slots")
		}
	})
	var version int
	returnPGOK(t, observer.QueryRow(ctx, "SELECT current_setting('server_version_num')::int").Scan(&version))
	if version < 170000 || version >= 180000 {
		t.Fatal("PostgreSQL 17 required", version)
	}
	body, err := os.ReadFile("../../spec/db/005_hero.sql")
	returnPGOK(t, err)
	returnPGExec(t, ctx, observer, string(body))
	f.candidate = returnAttemptSeed(t, ctx, observer, 1)
	returnPGExec(t, ctx, observer, fmt.Sprintf("UPDATE city_troop SET count=%d WHERE unit_cfg_id=1; SELECT setval('work_queue_id_seq',100,false)", ready))
	p := profile
	p.Objects = make(map[string]freshsource.ObjectIdentity, 34)
	for _, name := range recruitPGNames {
		id, ok := profile.Objects[name]
		if !ok {
			t.Fatal("missing independently inventoried common object", name)
		}
		p.Objects[name] = id
	}
	f.generation, err = newReturnGeneration(binding, profile, f.catalog)
	returnPGOK(t, err)
	f.recruit, err = newRecruitGeneration(binding, p, f.catalog)
	returnPGOK(t, err)
	if len(profile.Objects) != 43 || len(p.Objects) != 34 || !reflect.DeepEqual(f.recruit.s.profile, p) ||
		!reflect.DeepEqual(f.generation.s.profile, profile) || *f.generation.s.binding != *f.recruit.s.binding || f.generation.s.admission.s == f.recruit.s.admission.s {
		t.Fatal("common captured identities or separate dormant ownership changed")
	}
	returnPGOK(t, f.generation.initialize(ctx))
	returnPGOK(t, f.recruit.initialize(ctx))
	trace.walletSQL = "SELECT food,wood,iron,stone,gold FROM " + pgx.Identifier{profile.SchemaName, "player_wallet"}.Sanitize() + " WHERE server_id=$1 AND player_id=$2 FOR UPDATE"
	trace.queries = nil // Both initializations joined before any attempt starts.
	return f
}

func (f *recruitReturnPG) start(recruit bool) *recruitReturnCall {
	call := &recruitReturnCall{done: make(chan struct{})}
	f.calls = append(f.calls, call)
	go func() {
		defer close(call.done)
		defer func() { call.fault = recover() }()
		if recruit {
			call.recruit = f.recruit.admit(f.ctx, 1, f.scope, f.intent)
		} else {
			call.returned = f.generation.complete(f.ctx, f.candidate)
		}
	}()
	return call
}
func (f *recruitReturnPG) join(t *testing.T, call *recruitReturnCall) {
	t.Helper()
	select {
	case <-call.done:
	case <-f.ctx.Done():
		t.Fatal("actual interoperating call did not join")
	}
	if call.fault != nil {
		t.Fatal("actual interoperating call panicked", call.fault)
	}
}
func (f *recruitReturnPG) locked(t *testing.T) {
	t.Helper()
	for _, row := range []struct{ table, predicate string }{
		{"player_wallet", "server_id=1 AND player_id=1"}, {"player_city", "server_id=1 AND city_id=1"},
		{"city_troop", "server_id=1 AND city_id=1 AND unit_cfg_id=1"}, {"city_troop", "server_id=1 AND city_id=1 AND unit_cfg_id=2"},
		{"city_troop", "server_id=1 AND city_id=1 AND unit_cfg_id=3"}, {"city_troop", "server_id=1 AND city_id=1 AND unit_cfg_id=4"},
	} {
		returnPGExec(t, f.ctx, f.observer, "BEGIN")
		_, err := f.observer.Exec(f.ctx, "SELECT 1 FROM "+pgx.Identifier{f.profile.SchemaName, row.table}.Sanitize()+" WHERE "+row.predicate+" FOR UPDATE NOWAIT")
		clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
		_, rollback := f.observer.Exec(clean, "ROLLBACK")
		stop()
		returnPGOK(t, rollback)
		var pg *pgconn.PgError
		if !errors.As(err, &pg) || pg.Code != "55P03" {
			t.Fatal("leading real operation did not retain the exact row lock", row, err)
		}
	}
}

// Hold both real slots at once, prove each is usable, then release even on failure.
func recruitReturnPoolReusable(t *testing.T, ctx context.Context, pool *pgxpool.Pool, observer uint32) {
	t.Helper()
	var acquired [2]*pgxpool.Conn
	defer func() {
		for _, conn := range acquired {
			if conn != nil {
				conn.Release()
			}
		}
	}()
	var ids [2]uint32
	for i := range acquired {
		conn, err := pool.Acquire(ctx)
		returnPGOK(t, err)
		acquired[i] = conn
		returnPGOK(t, conn.QueryRow(ctx, "SELECT pg_catalog.pg_backend_pid()").Scan(&ids[i]))
		if ids[i] == 0 || ids[i] == observer || ids[i] != conn.Conn().PgConn().PID() {
			t.Fatal("pool reuse did not use its own live connection", ids[i], observer)
		}
	}
	if ids[0] == ids[1] {
		t.Fatal("pool reuse did not acquire two distinct slots", ids)
	}
}
