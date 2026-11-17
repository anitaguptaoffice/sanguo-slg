package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

var returnTestNames = [4]string{
	"account account_pkey uq_account_login_name account_account_id_seq account_session account_session_pkey idx_account_session_account player player_pkey uq_player_account_per_server idx_player_account",
	"player_wallet player_wallet_pkey",
	"map_cell map_cell_pkey player_city player_city_pkey player_city_server_id_x_y_key idx_player_city_owner player_city_id_seq",
	"mil_city_origin mil_city_origin_pkey city_troop city_troop_pkey work_queue work_queue_pkey idx_work_queue_due idx_work_queue_player mil_recruit_origin mil_recruit_receipt mil_recruit_origin_pkey mil_recruit_origin_server_id_player_id_operation_command_id_key mil_recruit_receipt_pkey work_queue_id_seq march_order march_order_pkey idx_march_arrive idx_march_return field_army field_army_pkey idx_field_army_owner army_troop army_troop_pkey",
}

func returnSourceFixture(t *testing.T) (*recruittx.Binding, freshsource.Profile, *march.RecruitCatalog) {
	t.Helper()
	binding, err := recruittx.NewBinding(&pgxpool.Pool{}) // Capture only; no database.
	if err != nil {
		t.Fatal(err)
	}
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2},
		ClusterRef: "fixture", EvidenceRef: "not-enrollment", DatabaseName: "fixture", SchemaName: `Mixed "Schema"`,
		CurrentRoleName: "fixture", SessionRoleName: "fixture", DatabaseOID: 1, SchemaOID: 2,
		SchemaOwnerOID: 3, CurrentRoleOID: 3, SessionRoleOID: 3, ServerID: 7, Cohort: [16]byte{4},
		Objects: make(map[string]freshsource.ObjectIdentity)}
	for _, group := range returnTestNames {
		for _, name := range strings.Fields(group) {
			p.Objects[name] = freshsource.ObjectIdentity{OID: uint32(100 + len(p.Objects)), OwnerOID: 3}
		}
	}
	var rules [4]march.RecruitRule
	for i := range rules {
		rules[i] = march.RecruitRule{UnitCfgID: int32(i + 1), SecondsPerUnit: 1}
	}
	version, _ := march.RecruitManifestVersion(rules)
	catalog, err := march.NewRecruitCatalog([]march.RecruitManifest{{Version: version, Rules: rules}}, version)
	if err != nil {
		t.Fatal(err)
	}
	return binding, p, catalog
}

func TestReturnSourceCaptureAndProjections(t *testing.T) {
	binding, p, catalog := returnSourceFixture(t)
	g, err := newReturnGeneration(binding, p, catalog)
	if err != nil {
		t.Fatal(err)
	}
	for i, names := range returnSourceInventories() {
		if !reflect.DeepEqual(names, strings.Fields(returnTestNames[i])) {
			t.Fatal("inventory differs from adopted contract", i)
		}
		projection := returnSourceProjection(g.s.profile, names)
		if len(projection.Objects) != len(names) {
			t.Fatal("wrong projection size")
		}
		for _, name := range names {
			if projection.Objects[name] != p.Objects[name] {
				t.Fatal("object identity changed", name)
			}
		}
		projection.Objects = p.Objects
		if !reflect.DeepEqual(projection, p) {
			t.Fatal("common source metadata changed")
		}
	}
	savedBinding, savedProfile, savedCatalog := *binding, g.s.profile, *catalog
	*binding, *catalog = recruittx.Binding{}, march.RecruitCatalog{}
	delete(p.Objects, "account")
	p.ServerID = 99
	if g.s.binding == binding || *g.s.binding != savedBinding || g.s.admission.s.binding != g.s.binding || len(savedProfile.Objects) != 43 || g.s.profile.ServerID != 7 {
		t.Fatal("caller input mutation reached captured generation")
	}
	want, _ := savedCatalog.Current(1)
	got, err := g.s.catalog.Current(1)
	if err != nil || got != want {
		t.Fatal("catalog wrapper replacement reached capture", err)
	}
}

func TestReturnSourceRejectsInvalidCapture(t *testing.T) {
	for _, change := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { delete(p.Objects, "account") },
		func(p *freshsource.Profile) { p.Objects["extra"] = freshsource.ObjectIdentity{OID: 999, OwnerOID: 3} },
		func(p *freshsource.Profile) { p.Objects["account"] = p.Objects["player_wallet"] },
		func(p *freshsource.Profile) { p.Objects["account"] = freshsource.ObjectIdentity{} },
		func(p *freshsource.Profile) { *p = freshsource.Profile{} },
		func(p *freshsource.Profile) { p.ServerID = 0 },
		func(p *freshsource.Profile) { p.EvidenceDigest = [32]byte{} },
	} {
		b, p, c := returnSourceFixture(t)
		change(&p)
		if g, err := newReturnGeneration(b, p, c); err == nil || g != nil {
			t.Fatal("invalid profile accepted")
		}
	}
	b, p, c := returnSourceFixture(t)
	for _, invalid := range []*recruittx.Binding{nil, {}} {
		if g, err := newReturnGeneration(invalid, p, c); err == nil || g != nil {
			t.Fatal("invalid binding accepted")
		}
	}
	for _, invalid := range []*march.RecruitCatalog{nil, {}} {
		if g, err := newReturnGeneration(b, p, invalid); err == nil || g != nil {
			t.Fatal("invalid catalog accepted")
		}
	}
}

func TestReturnSourceOneShotContextAndClose(t *testing.T) {
	canceled, cancel := context.WithTimeout(context.Background(), time.Second)
	cancel()
	for _, ctx := range []context.Context{nil, context.Background(), canceled} {
		b, p, c := returnSourceFixture(t)
		g, _ := newReturnGeneration(b, p, c)
		alias := *g
		if err := g.initialize(ctx); err == nil || ctx == canceled && !errors.Is(err, context.Canceled) {
			t.Fatal("invalid context accepted", err)
		}
		if alias.initialize(context.Background()) == nil || g.s.bundle != nil || !g.s.closed || !g.s.attempted || g.s.admission.s.pending != 0 {
			t.Fatal("copy reopened or exposed a partial generation")
		}
		if err := alias.s.admission.waitDrained(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	for _, invalid := range []*returnGeneration{nil, {}} {
		if invalid.initialize(context.Background()) == nil || invalid.close() == nil {
			t.Fatal("invalid generation accepted")
		}
	}
	b, p, c := returnSourceFixture(t)
	g, _ := newReturnGeneration(b, p, c)
	alias := *g
	if alias.close() != nil || g.initialize(context.Background()) == nil || !g.s.closed {
		t.Fatal("closed generation reopened")
	}
}
