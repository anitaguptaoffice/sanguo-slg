package api

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5/pgxpool"
)

type recruitCompleteReturnPG struct {
	*returnAttemptPG
	recruit  *recruitGeneration
	profileR freshsource.Profile
	trace    *recruitPromotionTrace
	owned    *returnBackendSet
}

func newRecruitCompleteReturnPG(t *testing.T) *recruitCompleteReturnPG {
	t.Helper()
	trace, owned := new(recruitPromotionTrace), new(returnBackendSet)
	pool, observer, binding, p := returnPGFixture(t, trace, func(c *pgxpool.Config) {
		c.MaxConns = 2
		owned.configure(c)
	})
	f := &recruitCompleteReturnPG{returnAttemptPG: &returnAttemptPG{ctx: returnPGContext(t), pool: pool,
		observer: observer, binding: binding, profile: p, catalog: recruitAttemptPGCatalog(t), due: returnAttemptDue}, trace: trace, owned: owned}
	var version int
	returnPGOK(t, observer.QueryRow(f.ctx, "SELECT current_setting('server_version_num')::int").Scan(&version))
	if version < 170000 || version >= 180000 {
		t.Fatal("PostgreSQL 17 required", version)
	}
	body, err := os.ReadFile("../../spec/db/005_hero.sql")
	returnPGOK(t, err)
	returnPGExec(t, f.ctx, observer, string(body))
	f.candidate = returnAttemptSeed(t, f.ctx, observer, 1)
	returnPGExec(t, f.ctx, observer, "UPDATE player_wallet SET food=8,wood=12,iron=20,stone=28,gold=0; SELECT setval('work_queue_id_seq',100,false)")
	r := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "owned-fixture",
		EvidenceRef: "not-production-evidence", ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	returnPGOK(t, observer.QueryRow(f.ctx, `SELECT d.datname,d.oid,n.nspname,n.oid,n.nspowner,current_user,r.oid,session_user,s.oid
FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s
WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`).Scan(
		&r.DatabaseName, &r.DatabaseOID, &r.SchemaName, &r.SchemaOID, &r.SchemaOwnerOID, &r.CurrentRoleName, &r.CurrentRoleOID, &r.SessionRoleName, &r.SessionRoleOID))
	seen := map[uint32]bool{}
	for _, name := range recruitPGNames {
		var id freshsource.ObjectIdentity
		returnPGOK(t, observer.QueryRow(f.ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", r.SchemaOID, name).Scan(&id.OID, &id.OwnerOID))
		if id.OID == 0 || id.OwnerOID == 0 || seen[id.OID] || id != p.Objects[name] {
			t.Fatal("independent common object identity mismatch", name)
		}
		seen[id.OID], r.Objects[name] = true, id
	}
	header := p
	header.Objects = r.Objects
	if len(p.Objects) != 43 || len(recruitPGNames) != 34 || len(r.Objects) != 34 || !reflect.DeepEqual(header, r) {
		t.Fatal("independent 34/43 captured profiles disagree")
	}
	f.profileR, trace.promotion = r, recruitPromotionQuery(r)
	f.generation, err = newReturnGeneration(binding, p, f.catalog)
	returnPGOK(t, err)
	f.recruit, err = newRecruitGeneration(binding, r, f.catalog)
	returnPGOK(t, err)
	t.Cleanup(func() {
		clean, stop := context.WithTimeout(context.Background(), 8*time.Second)
		defer stop()
		for _, err := range []error{f.recruit.close(), f.generation.close(), f.recruit.s.admission.waitDrained(clean), f.generation.s.admission.waitDrained(clean)} {
			if err != nil {
				t.Error("paired generation cleanup", err)
			}
		}
	})
	returnPGOK(t, f.recruit.initialize(f.ctx))
	returnPGOK(t, f.generation.initialize(f.ctx))
	if !reflect.DeepEqual(f.recruit.s.profile, r) || !reflect.DeepEqual(f.generation.s.profile, p) ||
		*f.recruit.s.binding != *f.generation.s.binding || f.recruit.s.admission.s == f.generation.s.admission.s {
		t.Fatal("captured source or separate dormant ownership changed")
	}
	return f
}

func (f *recruitCompleteReturnPG) paid(t *testing.T, i int) (march.RecruitAcceptance, march.RecruitCandidate) {
	t.Helper()
	var lower time.Time
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&lower))
	scope := march.RecruitScope{ServerID: 1, PlayerID: 1, CommandID: march.RecruitCommandID{byte(9 + i)}}
	start := len(f.trace.events())
	result := f.recruit.admit(f.ctx, 1, scope, march.RecruitIntent{Version: 1, CityID: 1, UnitCfgID: 1, Count: 2})
	recruitAttemptPGConfirmed(t, result)
	if i == 0 {
		recruitAttemptPGRecorded(t, f.trace.events()[start:], f.observer, f.profileR, false)
	} else {
		returnPGOK(t, recruitNoeffectRecorded(f.trace.events()[start:], f.observer.PgConn().PID(), f.profileR, true))
	}
	var a march.RecruitAcceptance
	var c march.RecruitCandidate
	var digest []byte
	var version int16
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT q.server_id,q.player_id,q.city_id,q.queue_id,r.intent_version,
r.queue_id,r.city_id,r.unit_cfg_id,r.count,r.food_paid,r.wood_paid,r.iron_paid,r.stone_paid,r.duration_sec,
convert_from(r.catalog_version,'UTF8'),r.rule_digest,r.accepted_at,r.initial_status,r.initial_start_at,r.initial_finish_at
FROM work_queue q JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id=$1`, 100+i).Scan(
		&c.ServerID, &c.PlayerID, &c.CityID, &c.QueueID, &version, &a.QueueID, &a.CityID, &a.UnitCfgID, &a.Count,
		&a.Cost.Food, &a.Cost.Wood, &a.Cost.Iron, &a.Cost.Stone, &a.DurationSeconds, &a.CatalogVersion,
		&digest, &a.AcceptedAt, &a.InitialStatus, &a.InitialStartAt, &a.InitialFinishAt))
	copy(a.RuleDigest[:], digest)
	a.AcceptedAt, a.InitialStartAt, a.InitialFinishAt = a.AcceptedAt.UTC(), a.InitialStartAt.UTC(), a.InitialFinishAt.UTC()
	if c != (march.RecruitCandidate{ServerID: 1, PlayerID: 1, CityID: 1, QueueID: int64(100 + i)}) || a != result.confirmed || version != 1 ||
		a.QueueID != c.QueueID || a.CityID != 1 || a.UnitCfgID != 1 || a.Count != 2 || a.Cost != (march.Resources{Food: 4, Wood: 6, Iron: 10, Stone: 14}) ||
		a.DurationSeconds != 22 || a.CatalogVersion != recruitAttemptPGVersion || len(digest) != 32 || fmt.Sprintf("%x", digest) != recruitReturnPGDigest ||
		a.InitialStatus != int16(1-i) || a.AcceptedAt.Before(lower.UTC().Truncate(time.Millisecond)) || a.AcceptedAt.Nanosecond()%1000000 != 0 ||
		a.InitialStartAt.Before(a.AcceptedAt) || a.InitialFinishAt != a.InitialStartAt.Add(22*time.Second) {
		t.Fatal("independent paid pair acceptance/candidate mismatch", i, a, c)
	}
	var exact bool
	returnPGOK(t, f.observer.QueryRow(f.ctx, `SELECT EXISTS (SELECT FROM work_queue q JOIN mil_recruit_origin o USING(server_id,queue_id)
JOIN mil_recruit_receipt r USING(server_id,queue_id) WHERE q.server_id=1 AND q.queue_id=$1 AND q.player_id=1 AND q.city_id=1 AND q.queue_type=3
AND q.status=r.initial_status AND q.start_at=r.initial_start_at AND q.finish_at=r.initial_finish_at AND r.accepted_at<=clock_timestamp()
AND o.player_id=1 AND o.operation=1 AND o.command_id=$2
AND q.payload=jsonb_build_object('v',1,'unit_cfg_id',1,'count',2,'cost_paid',jsonb_build_object('food',4,'wood',6,'iron',10,'stone',14),
'duration_sec',22,'catalog_version',convert_from(r.catalog_version,'UTF8'),'rule_digest',encode(r.rule_digest,'hex')))`, c.QueueID, scope.CommandID[:]).Scan(&exact))
	if !exact {
		t.Fatal("paid pair payload/origin/schedule mismatch")
	}
	return a, c
}

func recruitCompleteReturnChanges(t *testing.T, before, after map[string]string, changed map[string]bool) {
	t.Helper()
	if len(before) != len(after) {
		t.Fatal("paired relation inventory changed")
	}
	for name, old := range before {
		if (old != after[name]) != changed[name] {
			t.Fatal("unexpected paired relation/allocator change", name)
		}
	}
}

func (f *recruitCompleteReturnPG) complete(t *testing.T, recruit bool, c march.RecruitCandidate, before map[string]string) (time.Time, time.Time) {
	t.Helper()
	call := &recruitNoeffectCall{clock: returnLifetimeTracer(""), commit: returnLifetimeTracer(""), done: make(chan struct{})}
	f.trace.guard.Lock()
	f.trace.call = call // Sequential only: every previous caller has joined.
	f.trace.guard.Unlock()
	ctx, cancel := context.WithTimeout(f.ctx, 30*time.Second)
	t.Cleanup(func() {
		cancel()
		call.clock.release()
		call.commit.release()
		f.owned.cleanup(t, f.returnAttemptPG, call.done)
	})
	var returned returnAttemptResult
	var lower, upper time.Time
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&lower))
	start := len(f.trace.events())
	go func() {
		defer close(call.done)
		defer func() { call.fault = recover() }()
		if recruit {
			call.result = f.recruit.complete(ctx, c)
		} else {
			returned = f.generation.complete(ctx, f.candidate)
		}
	}()
	pid := returnLifetimeReached(t, call.clock)
	returnPGOK(t, f.observer.QueryRow(f.ctx, "SELECT clock_timestamp()").Scan(&upper))
	call.clock.release()
	if pid == 0 || pid == f.observer.PgConn().PID() || returnLifetimeReached(t, call.commit) != pid || !reflect.DeepEqual(before, snapshotReturnAttemptPG(t, f.returnAttemptPG, false)) {
		t.Fatal("paired call escaped actual pre-Commit boundary")
	}
	select {
	case <-call.done:
		t.Fatal("paired call returned before actual Commit")
	default:
	}
	call.commit.release()
	if !returnBackendJoin(call.done, 8*time.Second) {
		t.Fatal("paired actual caller did not join")
	}
	if call.fault != nil {
		t.Fatal("paired actual caller panicked", call.fault)
	}
	f.owned.noLocks(t, f.ctx, f.observer, pid, f.profile.SchemaOID)
	if !recruit {
		returnAttemptConfirmed(t, f.returnAttemptPG, returned, march.ReturnApplied, f.due)
		returnAttemptTrace(t, f.returnAttemptPG, f.trace.events()[start:], true, 1)
		return time.Time{}, time.Time{}
	}
	recruitAttemptPGConfirmed(t, call.result)
	if call.result.completion != march.RecruitCompleted || call.result.confirmed != (march.RecruitAcceptance{}) {
		t.Fatal("paired Recruit disposition or fabricated acceptance", call.result)
	}
	returnPGOK(t, recruitPromotionRecorded(f.trace.events()[start:], f.observer.PgConn().PID(), f.profileR))
	if len(f.trace.args) != 1 || len(f.trace.args[0]) != 6 {
		t.Fatal("missing or duplicate promotion arguments")
	}
	a := f.trace.args[0]
	at, atOK := a[4].(time.Time)
	finish, finishOK := a[5].(time.Time)
	if !atOK || !finishOK || a[0] != int32(1) || a[1] != int64(101) || a[2] != int64(1) || a[3] != int64(1) ||
		at != at.UTC().Truncate(time.Millisecond) || finish != at.Add(22*time.Second) || at.Before(lower.UTC().Truncate(time.Millisecond)) || at.After(upper.UTC().Truncate(time.Millisecond)) {
		t.Fatal("paired promotion target or bounded production time mismatch")
	}
	return at, finish
}
