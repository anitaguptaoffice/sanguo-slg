package api

import (
	"context"
	"reflect"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

func TestPGRecruitGenerationCaptureAndAssembly(t *testing.T) {
	trace := new(returnPGTrace)
	observer, binding, profile := recruitPGFixture(t, trace)
	ctx, catalog := returnPGContext(t), returnPGCatalog(t)
	saved, err := freshsource.Snapshot(profile)
	returnPGOK(t, err)
	var wantRules [4]march.RecruitRuleEvidence
	for i := range wantRules {
		wantRules[i], err = catalog.Current(int32(i + 1))
		returnPGOK(t, err)
	}
	before := returnPGSnapshot(t, ctx, observer, saved)
	g, err := newRecruitGeneration(binding, profile, catalog)
	returnPGOK(t, err)
	mutate := func(n uint32) {
		*binding, *catalog = recruittx.Binding{}, march.RecruitCatalog{}
		for name := range profile.Objects {
			profile.Objects[name] = freshsource.ObjectIdentity{OID: n, OwnerOID: n}
		}
		profile = freshsource.Profile{ServerID: int32(n), Objects: profile.Objects}
	}
	mutate(2)
	returnPGOK(t, g.initialize(ctx))
	mutate(3)
	g.s.mu.Lock()
	bundle, captured, closed, attempted := g.s.bundle, g.s.profile, g.s.closed, g.s.attempted
	var gotRules [4]march.RecruitRuleEvidence
	var ruleErrors [4]error
	for i := range gotRules {
		gotRules[i], ruleErrors[i] = g.s.catalog.Current(int32(i + 1))
	}
	g.s.mu.Unlock()
	if bundle == nil || bundle.actor == nil || bundle.wallet == nil || bundle.city == nil || bundle.military == nil || closed || !attempted {
		t.Fatal("incomplete generation after confirmed rollback")
	}
	for _, err := range ruleErrors {
		returnPGOK(t, err)
	}
	if !reflect.DeepEqual(captured, saved) || gotRules != wantRules {
		t.Fatal("caller replacement reached captured profile/catalog")
	}
	recruitPGRecorded(t, trace, observer, saved, 9)
	recruitPGReleased(t, ctx, observer, saved)
	if !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, saved)) {
		t.Fatal("validation changed business rows or allocator state")
	}
	count := len(trace.events())
	alias := *g
	if alias.initialize(ctx) == nil || len(trace.events()) != count {
		t.Fatal("copied successful generation retried initialization")
	}
	returnPGOK(t, g.close())
	returnPGOK(t, g.s.admission.waitDrained(ctx))
}

func recruitPGRejected(t *testing.T, ctx context.Context, observer *pgx.Conn, trace *returnPGTrace, binding *recruittx.Binding, expected, actual freshsource.Profile, phase string) {
	t.Helper()
	before := returnPGSnapshot(t, ctx, observer, actual)
	g, err := newRecruitGeneration(binding, expected, returnPGCatalog(t))
	returnPGOK(t, err)
	if err = g.initialize(ctx); err == nil {
		t.Fatal("wrong source accepted")
	}
	g.s.mu.Lock()
	gotPhase, closed, bundle, cause := g.s.phase, g.s.closed, g.s.bundle, g.s.cause
	g.s.mu.Unlock()
	if gotPhase != phase || !closed || bundle != nil || cause == nil {
		t.Fatal("wrong rejection boundary or partial bundle", gotPhase, closed, cause)
	}
	recruitPGRecorded(t, trace, observer, actual, 0)
	recruitPGReleased(t, ctx, observer, actual)
	returnPGOK(t, g.s.admission.waitDrained(ctx))
	if !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, actual)) {
		t.Fatal("failed validation changed rows or allocator state")
	}
	count := len(trace.events())
	alias := *g
	if alias.initialize(ctx) == nil || len(trace.events()) != count {
		t.Fatal("copied failed generation reopened")
	}
}

func TestPGRecruitGenerationRejectsDomainSources(t *testing.T) {
	for _, domain := range []struct{ name, table, ddl, phase string }{
		{"account", "account", "ALTER TABLE account ALTER COLUMN status SET DEFAULT 2", "account constructor"},
		{"domestic", "player_wallet", "ALTER TABLE player_wallet ALTER COLUMN food SET DEFAULT 1", "wallet constructor"},
		{"world", "player_city", "ALTER TABLE player_city ALTER COLUMN wall_level SET DEFAULT 2", "world constructor"},
		{"military", "city_troop", "ALTER TABLE city_troop ALTER COLUMN count SET DEFAULT 1", "military constructor"},
	} {
		for _, mode := range []string{"oid", "owner", "shape"} {
			t.Run(domain.name+"/"+mode, func(t *testing.T) {
				trace := new(returnPGTrace)
				observer, binding, actual := recruitPGFixture(t, trace)
				ctx := returnPGContext(t)
				expected, err := freshsource.Snapshot(actual)
				returnPGOK(t, err)
				if mode == "shape" {
					returnPGExec(t, ctx, observer, domain.ddl)
				} else {
					id := expected.Objects[domain.table]
					if mode == "owner" {
						id.OwnerOID++
					} else {
						id.OID = ^uint32(0)
					}
					expected.Objects[domain.table] = id
				}
				recruitPGRejected(t, ctx, observer, trace, binding, expected, actual, domain.phase)
			})
		}
	}
}

func TestPGRecruitGenerationRejectsSourceIdentity(t *testing.T) {
	for _, field := range []string{"database name", "database oid", "schema name", "schema oid", "schema owner", "current role name", "current role oid", "session role name", "session role oid"} {
		t.Run(field, func(t *testing.T) {
			trace := new(returnPGTrace)
			observer, binding, actual := recruitPGFixture(t, trace)
			expected, err := freshsource.Snapshot(actual)
			returnPGOK(t, err)
			switch field {
			case "database name":
				expected.DatabaseName += "_mismatch"
			case "database oid":
				expected.DatabaseOID++
			case "schema name":
				expected.SchemaName += "_mismatch"
			case "schema oid":
				expected.SchemaOID++
			case "schema owner":
				expected.SchemaOwnerOID++
			case "current role name":
				expected.CurrentRoleName += "_mismatch"
			case "current role oid":
				expected.CurrentRoleOID++
			case "session role name":
				expected.SessionRoleName += "_mismatch"
			case "session role oid":
				expected.SessionRoleOID++
			}
			recruitPGRejected(t, returnPGContext(t), observer, trace, binding, expected, actual, "account constructor")
		})
	}
}

func TestPGRecruitGenerationRejectsMissingCatalogBeforeBegin(t *testing.T) {
	for _, missing := range []string{"nil", "zero"} {
		t.Run(missing, func(t *testing.T) {
			trace := new(returnPGTrace)
			observer, binding, profile := recruitPGFixture(t, trace)
			ctx := returnPGContext(t)
			before := returnPGSnapshot(t, ctx, observer, profile)
			var catalog *march.RecruitCatalog
			if missing == "zero" {
				catalog = new(march.RecruitCatalog)
			}
			if g, err := newRecruitGeneration(binding, profile, catalog); err == nil || g != nil {
				t.Fatal("missing retained catalog accepted")
			}
			if len(trace.events()) != 0 || !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
				t.Fatal("invalid catalog reached pool or changed database")
			}
		})
	}
}

func TestRecruitGenerationSQLAllowlist(t *testing.T) {
	p := freshsource.Profile{SchemaName: `fixture_"Q`}
	read := "SELECT last_value,is_called FROM " + pgx.Identifier{p.SchemaName, "work_queue_id_seq"}.Sanitize()
	pin := "LOCK TABLE " + pgx.Identifier{p.SchemaName, "account"}.Sanitize() + " IN ROW SHARE MODE"
	for sql, kind := range map[string]int{"begin isolation level read committed": 1, "rollback": 2, pin: 3, read: 4, "SELECT (pg_catalog.current_schemas(true))[1]::pg_catalog.text": 4} {
		if got := recruitPGSQLKind(sql, p); got != kind {
			t.Errorf("approved SQL rejected: kind=%d want=%d SQL=%s", got, kind, sql)
		}
	}
	for _, sql := range []string{
		"WITH changed AS (UPDATE player_wallet SET food=0 RETURNING *) SELECT * FROM changed",
		"SELECT * FROM player_wallet FOR UPDATE", "SELECT * FROM player_wallet FOR SHARE",
		"SELECT * FROM player_wallet FOR NO KEY UPDATE", "SELECT * FROM player_wallet FOR KEY SHARE",
		"SELECT nextval('work_queue_id_seq')", "SELECT setval('work_queue_id_seq',1)",
		"SELECT last_value,is_called FROM other.work_queue_id_seq", "SELECT last_value,is_called FROM player_city_id_seq",
		read + "; UPDATE player_wallet SET food=0", pin + "; DELETE FROM city_troop", "rollback; COMMIT",
		read + " FOR KEY SHARE", "SELECT 1", "LOCK TABLE player_wallet IN ACCESS EXCLUSIVE MODE", "",
	} {
		if recruitPGSQLKind(sql, p) != 0 {
			t.Errorf("unapproved SQL accepted: %s", sql)
		}
	}
}
