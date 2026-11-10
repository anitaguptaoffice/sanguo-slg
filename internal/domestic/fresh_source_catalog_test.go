package domestic

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func freshCatalogProfile() freshsource.Profile {
	p := freshsource.Profile{
		ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2},
		ClusterRef: "fixture", EvidenceRef: "fixture-not-enrollment",
		DatabaseName: "fixture", SchemaName: `Mixed "Schema" `,
		CurrentRoleName: "Fixture Role", SessionRoleName: "Fixture Role",
		DatabaseOID: 1, SchemaOID: 2, SchemaOwnerOID: 3, CurrentRoleOID: 3, SessionRoleOID: 3,
		ServerID: 1, Cohort: [16]byte{4}, Objects: map[string]freshsource.ObjectIdentity{},
	}
	for i, name := range []string{"player_wallet", "player_wallet_pkey", "city_production_checkpoint",
		"city_production_checkpoint_pkey", "idx_city_production_player", "city_building", "city_building_pkey", "idx_city_building_cfg"} {
		p.Objects[name] = freshsource.ObjectIdentity{OID: uint32(i + 10), OwnerOID: 3}
	}
	return p
}

func TestFreshCatalogProfileSnapshot(t *testing.T) {
	p := freshCatalogProfile()
	copyProfile, err := snapshotFreshSourceProfile(p)
	if err != nil || !reflect.DeepEqual(p, copyProfile) {
		t.Fatal("literal expectation data changed", err)
	}
	p.Objects["city_building"] = freshsource.ObjectIdentity{OID: 99, OwnerOID: 99}
	delete(p.Objects, "player_wallet")
	p.Cohort[0], p.ReleaseDigest[0], p.EvidenceDigest[0] = 0, 0, 0
	p.SchemaName = "other"
	if !reflect.DeepEqual(copyProfile, freshCatalogProfile()) {
		t.Fatal("caller mutation reached private snapshot")
	}
}

func TestFreshCatalogRejectsMalformedExpectations(t *testing.T) {
	changes := map[string]func(*freshsource.Profile){
		"release":        func(p *freshsource.Profile) { p.ReleaseDigest = [32]byte{} },
		"evidence":       func(p *freshsource.Profile) { p.EvidenceDigest = [32]byte{} },
		"cluster":        func(p *freshsource.Profile) { p.ClusterRef = "" },
		"record":         func(p *freshsource.Profile) { p.EvidenceRef = "" },
		"database":       func(p *freshsource.Profile) { p.DatabaseName = "" },
		"namespace":      func(p *freshsource.Profile) { p.SchemaName = "" },
		"current role":   func(p *freshsource.Profile) { p.CurrentRoleName = "" },
		"session role":   func(p *freshsource.Profile) { p.SessionRoleName = "" },
		"database OID":   func(p *freshsource.Profile) { p.DatabaseOID = 0 },
		"schema OID":     func(p *freshsource.Profile) { p.SchemaOID = 0 },
		"schema owner":   func(p *freshsource.Profile) { p.SchemaOwnerOID = 0 },
		"current OID":    func(p *freshsource.Profile) { p.CurrentRoleOID = 0 },
		"session OID":    func(p *freshsource.Profile) { p.SessionRoleOID = 0 },
		"shard":          func(p *freshsource.Profile) { p.ServerID = -1 },
		"cohort":         func(p *freshsource.Profile) { p.Cohort = [16]byte{} },
		"nil objects":    func(p *freshsource.Profile) { p.Objects = nil },
		"extra object":   func(p *freshsource.Profile) { p.Objects["other"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 3} },
		"OID":            func(p *freshsource.Profile) { p.Objects["city_building"] = freshsource.ObjectIdentity{OID: 0, OwnerOID: 3} },
		"owner":          func(p *freshsource.Profile) { p.Objects["city_building"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 0} },
		"reserved":       func(p *freshsource.Profile) { p.SchemaName = "pg_catalog" },
		"information":    func(p *freshsource.Profile) { p.SchemaName = "information_schema" },
		"database bytes": func(p *freshsource.Profile) { p.DatabaseName = "bad\xff" },
		"schema bytes":   func(p *freshsource.Profile) { p.SchemaName = "bad\xff" },
		"current bytes":  func(p *freshsource.Profile) { p.CurrentRoleName = "bad\xff" },
		"session bytes":  func(p *freshsource.Profile) { p.SessionRoleName = "bad\xff" },
		"NUL":            func(p *freshsource.Profile) { p.SchemaName = "bad\x00" },
	}
	for key := range freshCatalogProfile().Objects {
		key := key
		changes["missing "+key] = func(p *freshsource.Profile) { delete(p.Objects, key) }
		changes["substituted "+key] = func(p *freshsource.Profile) {
			delete(p.Objects, key)
			p.Objects["substitute"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 3}
		}
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			p := freshCatalogProfile()
			change(&p)
			out, err := snapshotFreshSourceProfile(p)
			if !errors.Is(err, freshsource.ErrProfile) || !reflect.DeepEqual(out, freshsource.Profile{}) {
				t.Fatal("malformed profile accepted", err)
			}
			if err = validateFreshSource(context.Background(), nil, nil, p); !errors.Is(err, freshsource.ErrProfile) {
				t.Fatal("malformed data misclassified as observed metadata drift", err)
			}
		})
	}
}

func TestFreshCatalogInvalidAccessPreservesBindingError(t *testing.T) {
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	for _, ctx := range []context.Context{nil, context.Background(), canceled} {
		for _, b := range []*recruittx.Binding{nil, {}} {
			for _, a := range []*recruittx.Access{nil, {}} {
				if err := validateFreshSource(ctx, b, a, freshCatalogProfile()); !errors.Is(err, recruittx.ErrBinding) {
					t.Fatal("invalid handle error changed", err)
				}
			}
		}
	}
}

func TestFreshCatalogFixedShapeConstants(t *testing.T) {
	for _, shape := range []string{freshCityColumns, freshCityConstraints, freshCityIndexes} {
		if !json.Valid([]byte(shape)) {
			t.Fatal("invalid fixed shape JSON")
		}
	}
}
