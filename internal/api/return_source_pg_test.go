package api

import (
	"context"
	"crypto/sha256"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

var returnPGPins = strings.Fields("account player player_wallet player_city mil_city_origin city_troop work_queue mil_recruit_origin mil_recruit_receipt march_order field_army army_troop")

func returnPGRecorded(t *testing.T, trace *returnPGTrace, p freshsource.Profile, pinned bool) {
	t.Helper()
	var want []string
	if pinned {
		for i, name := range returnPGPins {
			prefix, mode := "LOCK TABLE ", "ROW EXCLUSIVE"
			if i >= 4 {
				prefix = "LOCK TABLE ONLY "
			}
			if i < 2 || i == 3 {
				mode = "ROW SHARE"
			}
			want = append(want, prefix+pgx.Identifier{p.SchemaName, name}.Sanitize()+" IN "+mode+" MODE")
		}
	}
	begin, rollback, reads := 0, 0, 0
	var pid uint32
	var pins []string
	for _, q := range trace.events() {
		if pid == 0 {
			pid = q.pid
		}
		if q.pid != pid || q.err != nil {
			t.Fatal("unexpected backend or SQL error", q.pid, q.err)
		}
		switch {
		case q.sql == "begin isolation level read committed":
			begin++
		case q.sql == "rollback":
			rollback++
		case slices.Contains(want, q.sql):
			pins = append(pins, q.sql)
		case returnSQLReviewedRead(q.sql, p):
			reads++
		default:
			t.Fatalf("unexpected validation SQL: %q", q.sql)
		}
	}
	if begin != 1 || rollback != 1 || reads == 0 || !reflect.DeepEqual(pins, want) {
		t.Fatalf("transaction/SQL record: begin=%d rollback=%d reads=%d pins=%v want=%v", begin, rollback, reads, pins, want)
	}
}

// Closed byte-for-byte set, not a SQL parser or a SELECT/WITH prefix heuristic.
func returnSQLReviewedRead(sql string, p freshsource.Profile) bool {
	sequence := "SELECT last_value,is_called FROM " + pgx.Identifier{p.SchemaName, "work_queue_id_seq"}.Sanitize()
	if sql == sequence {
		return true
	}
	digest := fmt.Sprintf("%x", sha256.Sum256([]byte(sql)))
	for _, source := range returnSQLReviewed {
		if digest == source.digest {
			return true
		}
	}
	return false
}

func returnPGReleased(t *testing.T, ctx context.Context, observer *pgx.Conn, p freshsource.Profile) {
	t.Helper()
	var tables []string
	for _, name := range returnPGPins {
		tables = append(tables, pgx.Identifier{p.SchemaName, name}.Sanitize())
	}
	returnPGExec(t, ctx, observer, "BEGIN; LOCK TABLE "+strings.Join(tables, ",")+" IN ACCESS EXCLUSIVE MODE NOWAIT; ROLLBACK")
}

func TestPGReturnGenerationCaptureAndAssembly(t *testing.T) {
	trace := new(returnPGTrace)
	_, observer, binding, profile := returnPGFixture(t, trace)
	ctx, catalog := returnPGContext(t), returnPGCatalog(t)
	saved, err := freshsource.Snapshot(profile)
	returnPGOK(t, err)
	wantRule, err := catalog.Current(1)
	returnPGOK(t, err)
	before := returnPGSnapshot(t, ctx, observer, saved)
	g, err := newReturnGeneration(binding, profile, catalog)
	returnPGOK(t, err)
	mutate := func(n uint32) {
		*binding, *catalog = recruittx.Binding{}, march.RecruitCatalog{}
		profile.Objects["account"] = freshsource.ObjectIdentity{OID: n, OwnerOID: n}
		profile = freshsource.Profile{ServerID: int32(n), Objects: profile.Objects} // Every caller scalar replaced.
	}
	mutate(2)
	returnPGOK(t, g.initialize(ctx))
	mutate(3)
	g.s.mu.Lock()
	bundle, captured, closed, attempted := g.s.bundle, g.s.profile, g.s.closed, g.s.attempted
	gotRule, ruleErr := g.s.catalog.Current(1)
	g.s.mu.Unlock()
	if bundle == nil || bundle.actor == nil || bundle.wallet == nil || bundle.city == nil || bundle.military == nil || closed || !attempted {
		t.Fatal("incomplete generation after confirmed rollback")
	}
	if !reflect.DeepEqual(captured, saved) || gotRule != wantRule || ruleErr != nil {
		t.Fatal("caller replacement reached captured profile/catalog", ruleErr)
	}
	returnPGRecorded(t, trace, saved, true)
	returnPGReleased(t, ctx, observer, saved)
	if !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, saved)) {
		t.Fatal("validation changed business rows or sequences")
	}
	count := len(trace.events())
	alias := *g
	if alias.initialize(ctx) == nil || len(trace.events()) != count {
		t.Fatal("successful generation initialization retried")
	}
	returnPGOK(t, g.close())
	returnPGOK(t, g.s.admission.waitDrained(ctx))
}

func TestPGReturnGenerationRejectsDomainSources(t *testing.T) {
	for _, domain := range []struct{ name, table, ddl, phase string }{
		{"account", "account", "ALTER TABLE account ALTER COLUMN status SET DEFAULT 2", "account constructor"},
		{"domestic", "player_wallet", "ALTER TABLE player_wallet ALTER COLUMN food SET DEFAULT 1", "wallet constructor"},
		{"world", "player_city", "ALTER TABLE player_city ALTER COLUMN wall_level SET DEFAULT 2", "world constructor"},
		{"military", "army_troop", "ALTER TABLE army_troop ALTER COLUMN count SET DEFAULT 1", "military constructor"},
	} {
		for _, mode := range []string{"oid", "owner", "shape"} {
			t.Run(domain.name+"/"+mode, func(t *testing.T) {
				trace := new(returnPGTrace)
				_, observer, binding, profile := returnPGFixture(t, trace)
				ctx := returnPGContext(t)
				if mode == "shape" {
					returnPGExec(t, ctx, observer, domain.ddl) // Valid DDL, unchanged object identity.
				} else {
					id := profile.Objects[domain.table]
					if mode == "owner" {
						id.OwnerOID++
					} else {
						id.OID = ^uint32(0) // Distinct from every actual fixture OID.
					}
					profile.Objects[domain.table] = id
				}
				before := returnPGSnapshot(t, ctx, observer, profile)
				g, err := newReturnGeneration(binding, profile, returnPGCatalog(t))
				returnPGOK(t, err)
				if err = g.initialize(ctx); err == nil {
					t.Fatal("wrong source accepted", domain.name, mode)
				}
				g.s.mu.Lock()
				phase, closed, bundle, cause := g.s.phase, g.s.closed, g.s.bundle, g.s.cause
				g.s.mu.Unlock()
				if phase != domain.phase || !closed || bundle != nil || cause == nil {
					t.Fatal("wrong rejection boundary or partial bundle", phase, closed, fmt.Sprint(cause))
				}
				returnPGRecorded(t, trace, profile, false)
				returnPGReleased(t, ctx, observer, profile)
				returnPGOK(t, g.s.admission.waitDrained(ctx))
				if !reflect.DeepEqual(before, returnPGSnapshot(t, ctx, observer, profile)) {
					t.Fatal("failed validation changed rows or sequences")
				}
				count := len(trace.events())
				alias := *g
				if alias.initialize(ctx) == nil || len(trace.events()) != count {
					t.Fatal("failed generation reopened")
				}
			})
		}
	}
}
