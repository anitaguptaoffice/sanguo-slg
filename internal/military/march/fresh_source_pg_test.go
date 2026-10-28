package march

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func freshSourceFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	pool, b, p := freshRetainedFixture(t)
	var seq freshsource.ObjectIdentity
	baseOK(t, pool.QueryRow(context.Background(), "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname='work_queue_id_seq'", p.SchemaOID).Scan(&seq.OID, &seq.OwnerOID))
	p.Objects["work_queue_id_seq"] = seq
	return pool, b, p
}

func TestPGFreshMilitarySourcePinAndCopies(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	o, a, ctx := baseOwner(t, b)
	source, err := NewFreshCityParticipant(ctx, b, a, p)
	baseOK(t, err)
	baseOK(t, o.Rollback(ctx))
	saved, _ := freshsource.Snapshot(p)
	p.SchemaName = "wrong"
	p.ServerID++
	delete(p.Objects, "mil_city_origin")
	copySource := *source
	o, a, ctx = baseOwner(t, b)
	wrong, _ := recruittx.NewBinding(pool)
	wo, wa, wctx := baseOwner(t, wrong)
	if source.Pin(wctx, wa) == nil {
		t.Fatal("wrong binding")
	}
	baseOK(t, wo.Rollback(wctx))
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if source.Pin(cancelled, a) == nil {
		t.Fatal("cancelled access")
	}
	baseOK(t, copySource.Pin(ctx, a))
	ids := []int64{}
	for _, n := range []string{"mil_city_origin", "city_troop", "work_queue", "mil_recruit_origin", "mil_recruit_receipt"} {
		ids = append(ids, int64(saved.Objects[n].OID))
	}
	var pins int64
	baseOK(t, a.Scan(ctx, b, `SELECT count(*) FROM unnest($1::oid[]) WITH ORDINALITY e(oid,n) WHERE EXISTS(SELECT FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid() AND l.granted AND l.relation=e.oid AND l.mode=CASE WHEN e.n<=3 THEN 'RowExclusiveLock' ELSE 'AccessShareLock' END)`, []any{ids}, &pins))
	if pins != 5 {
		t.Fatalf("missing frozen pins: %d", pins)
	}
	var last int64
	var called bool
	baseOK(t, a.Scan(ctx, b, "SELECT last_value,is_called FROM work_queue_id_seq", nil, &last, &called))
	if last != 1 || called {
		t.Fatal("constructor/Pin allocated")
	}
	baseOK(t, o.Rollback(ctx))
	if source.Pin(ctx, a) == nil {
		t.Fatal("ended access")
	}
	o, a, ctx = baseOwner(t, b)
	baseOK(t, source.Pin(ctx, a))
	baseOK(t, o.Rollback(ctx))
	// A definite missing relation retires all copies, even after same-OID restoration.
	baseSQL(t, pool, "ALTER TABLE mil_city_origin RENAME TO moved_marker")
	o, a, ctx = baseOwner(t, b)
	if source.Pin(ctx, a) == nil {
		t.Fatal("missing source")
	}
	baseOK(t, o.Rollback(ctx))
	baseSQL(t, pool, "ALTER TABLE moved_marker RENAME TO mil_city_origin")
	_, a, ctx = baseOwner(t, b)
	if copySource.Pin(ctx, a) == nil {
		t.Fatal("retirement reset")
	}
}

func TestPGFreshMilitarySourceSequenceDrift(t *testing.T) {
	cases := map[string]string{
		"default consumer": "CREATE TABLE unknown_default (id bigint DEFAULT nextval('work_queue_id_seq'))",

		"cache":             "ALTER SEQUENCE work_queue_id_seq CACHE 2",
		"increment":         "ALTER SEQUENCE work_queue_id_seq INCREMENT 2",
		"minimum":           "ALTER SEQUENCE work_queue_id_seq MINVALUE 0",
		"maximum":           "ALTER SEQUENCE work_queue_id_seq MAXVALUE 9007199254740990",
		"start":             "ALTER SEQUENCE work_queue_id_seq START 2",
		"cycle":             "ALTER SEQUENCE work_queue_id_seq CYCLE",
		"owned":             "ALTER SEQUENCE work_queue_id_seq OWNED BY work_queue.queue_id",
		"missing":           "DROP SEQUENCE work_queue_id_seq",
		"replacement":       "DROP SEQUENCE work_queue_id_seq; CREATE SEQUENCE work_queue_id_seq AS bigint MAXVALUE 9007199254740991",
		"exhausted":         "SELECT setval('work_queue_id_seq',9007199254740991,true)",
		"unknown reference": "CREATE TABLE unknown_queue_ref(queue_id bigint)",
		"unknown array":     "CREATE TABLE unknown_queue_refs(queue_ids bigint[])",
	}
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, p := freshSourceFixture(t)
			o, a, ctx := baseOwner(t, b)
			source, err := NewFreshCityParticipant(ctx, b, a, p)
			baseOK(t, err)
			baseOK(t, o.Rollback(ctx))
			baseSQL(t, pool, ddl)
			o, a, ctx = baseOwner(t, b)
			if got, err := NewFreshCityParticipant(ctx, b, a, p); err == nil || got != nil {
				t.Fatal("drift constructor")
			}
			if source.Pin(ctx, a) == nil {
				t.Fatal("drift Pin")
			}
			baseOK(t, o.Rollback(ctx))
			if name == "cache" {
				baseSQL(t, pool, "ALTER SEQUENCE work_queue_id_seq CACHE 1")
			}
			_, a, ctx = baseOwner(t, b)
			if source.Pin(ctx, a) == nil {
				t.Fatal("retired source recovered")
			}
		})
	}
}

func TestPGFreshMilitarySourceProfile(t *testing.T) {
	_, b, p := freshSourceFixture(t)
	_, a, ctx := baseOwner(t, b)
	for _, mutate := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { delete(p.Objects, "work_queue_id_seq") },
		func(p *freshsource.Profile) { p.Objects["extra"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1} },
		func(p *freshsource.Profile) {
			v := p.Objects["work_queue_id_seq"]
			v.OID++
			p.Objects["work_queue_id_seq"] = v
		},
		func(p *freshsource.Profile) {
			v := p.Objects["work_queue_id_seq"]
			v.OwnerOID++
			p.Objects["work_queue_id_seq"] = v
		},
	} {
		bad, _ := freshsource.Snapshot(p)
		mutate(&bad)
		if got, err := NewFreshCityParticipant(ctx, b, a, bad); err == nil || got != nil {
			t.Fatal("bad profile accepted")
		}
	}
}
