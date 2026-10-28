package march

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func recruitSourceCatalog(t *testing.T) (*RecruitCatalog, RecruitManifest, RecruitManifest) {
	t.Helper()
	first := evidenceFixture(t)
	second := first
	second.Rules[0].Cost.Food++
	var err error
	second.Version, err = RecruitManifestVersion(second.Rules)
	baseOK(t, err)
	c, err := NewRecruitCatalog([]RecruitManifest{first, second}, second.Version)
	baseOK(t, err)
	return c, first, second
}

func TestPGRecruitSourcePinsAndSnapshots(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	catalog, first, second := recruitSourceCatalog(t)
	saved, err := freshsource.Snapshot(p)
	baseOK(t, err)
	o, a, ctx := baseOwner(t, b)
	var before, after string
	baseOK(t, a.Scan(ctx, b, "SELECT current_setting('search_path') || current_setting('TimeZone') || current_setting('DateStyle')", nil, &before))
	source, err := NewRecruitParticipant(ctx, b, a, p, catalog)
	baseOK(t, err)
	baseOK(t, a.Scan(ctx, b, "SELECT current_setting('search_path') || current_setting('TimeZone') || current_setting('DateStyle')", nil, &after))
	if before != after {
		t.Fatal("settings changed")
	}
	baseOK(t, o.Rollback(ctx))
	delete(p.Objects, "mil_city_origin")
	p.SchemaName = "wrong"
	p.ServerID++
	delete(catalog.manifests, first.Version)
	*catalog = RecruitCatalog{}
	if source.catalog.current != second.Version || len(source.catalog.manifests) != 2 || source.catalog.manifests[first.Version] != first.Rules {
		t.Fatal("catalog not copied")
	}
	copied := *source
	o, a, ctx = baseOwner(t, b)
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	wo, wa, wctx := baseOwner(t, wrong)
	if source.Pin(wctx, wa) == nil {
		t.Fatal("wrong binding")
	}
	baseOK(t, wo.Rollback(wctx))
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if source.Pin(cancelled, a) == nil {
		t.Fatal("cancelled")
	}
	baseOK(t, copied.Pin(ctx, a))
	ids := []int64{}
	for _, n := range []string{"mil_city_origin", "city_troop", "work_queue", "mil_recruit_origin", "mil_recruit_receipt"} {
		ids = append(ids, int64(saved.Objects[n].OID))
	}
	var pins int64
	baseOK(t, a.Scan(ctx, b, `SELECT count(*) FROM unnest($1::oid[]) e(oid) WHERE EXISTS(SELECT FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid() AND l.granted AND l.relation=e.oid AND l.mode='RowExclusiveLock')`, []any{ids}, &pins))
	if pins != 5 {
		t.Fatalf("pins = %d", pins)
	}
	var rows int64
	baseOK(t, a.Scan(ctx, b, `SELECT (SELECT count(*) FROM mil_city_origin)+(SELECT count(*) FROM city_troop)+(SELECT count(*) FROM work_queue)+(SELECT count(*) FROM mil_recruit_origin)+(SELECT count(*) FROM mil_recruit_receipt)`, nil, &rows))
	if rows != 0 {
		t.Fatal("constructor/Pin changed fixture data")
	}
	var last int64
	var called bool
	baseOK(t, a.Scan(ctx, b, "SELECT last_value,is_called FROM work_queue_id_seq", nil, &last, &called))
	if last != 1 || called {
		t.Fatal("allocated sequence")
	}
	baseOK(t, o.Rollback(ctx))
	if source.Pin(ctx, a) == nil {
		t.Fatal("ended access")
	}
	o, a, ctx = baseOwner(t, b)
	baseOK(t, source.Pin(ctx, a))
	baseOK(t, o.Rollback(ctx))
	baseSQL(t, pool, "ALTER TABLE mil_city_origin RENAME TO moved_marker")
	o, a, ctx = baseOwner(t, b)
	if source.Pin(ctx, a) == nil {
		t.Fatal("missing source")
	}
	baseOK(t, o.Rollback(ctx))
	baseSQL(t, pool, "ALTER TABLE moved_marker RENAME TO mil_city_origin")
	o, a, ctx = baseOwner(t, b)
	if copied.Pin(ctx, a) == nil {
		t.Fatal("shared retirement reset")
	}
	baseOK(t, o.Rollback(ctx))
}

func TestPGRecruitSourceCatalogAndProfileValidation(t *testing.T) {
	_, b, p := freshSourceFixture(t)
	c, first, _ := recruitSourceCatalog(t)
	o, a, ctx := baseOwner(t, b)
	defer func() { _ = o.Rollback(ctx) }()
	for _, bad := range []*RecruitCatalog{nil, {}, {current: first.Version, manifests: map[string][4]RecruitRule{first.Version: {}}}, {current: "missing", manifests: c.manifests}} {
		if got, err := NewRecruitParticipant(ctx, b, a, p, bad); got != nil || err == nil {
			t.Fatal("invalid catalog")
		}
	}
	for _, mutate := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { delete(p.Objects, "work_queue_id_seq") },
		func(p *freshsource.Profile) { p.Objects["extra"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1} },
		func(p *freshsource.Profile) { p.Objects["work_queue_id_seq"] = p.Objects["work_queue"] },
		func(p *freshsource.Profile) {
			v := p.Objects["work_queue_id_seq"]
			v.OID++
			p.Objects["work_queue_id_seq"] = v
		},
	} {
		bad, err := freshsource.Snapshot(p)
		baseOK(t, err)
		mutate(&bad)
		if got, err := NewRecruitParticipant(ctx, b, a, bad, c); got != nil || err == nil {
			t.Fatal("invalid profile")
		}
	}
}

func TestPGRecruitSourceExhaustionAndDrift(t *testing.T) {
	pool, b, p := freshSourceFixture(t)
	c, _, _ := recruitSourceCatalog(t)
	baseSQL(t, pool, "SELECT setval('work_queue_id_seq',9007199254740991,true)")
	o, a, ctx := baseOwner(t, b)
	source, err := NewRecruitParticipant(ctx, b, a, p, c)
	baseOK(t, err)
	baseOK(t, source.Pin(ctx, a))
	var last int64
	var called bool
	baseOK(t, a.Scan(ctx, b, "SELECT last_value,is_called FROM work_queue_id_seq", nil, &last, &called))
	if last != 9007199254740991 || !called {
		t.Fatal("exhaustion changed")
	}
	baseOK(t, o.Rollback(ctx))
	baseSQL(t, pool, "ALTER SEQUENCE work_queue_id_seq CACHE 2")
	o, a, ctx = baseOwner(t, b)
	if source.Pin(ctx, a) == nil {
		t.Fatal("sequence drift")
	}
	baseOK(t, o.Rollback(ctx))
	baseSQL(t, pool, "ALTER SEQUENCE work_queue_id_seq CACHE 1")
	o, a, ctx = baseOwner(t, b)
	if source.Pin(ctx, a) == nil {
		t.Fatal("retirement reset")
	}
	baseOK(t, o.Rollback(ctx))
}
