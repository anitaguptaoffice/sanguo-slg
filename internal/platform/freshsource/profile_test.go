package freshsource

import (
	"errors"
	"reflect"
	"sync"
	"testing"
)

func fixture() Profile {
	return Profile{
		ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2},
		ClusterRef: "fixture-cluster", EvidenceRef: "fixture-only-not-activation",
		DatabaseName: "fixture", SchemaName: `Mixed "Schema" `,
		CurrentRoleName: "Fixture Role", SessionRoleName: "Fixture Role",
		DatabaseOID: 1, SchemaOID: 2, SchemaOwnerOID: 3, CurrentRoleOID: 3, SessionRoleOID: 3,
		ServerID: 1, Cohort: [16]byte{4},
		Objects: map[string]ObjectIdentity{"player_city": {OID: 5, OwnerOID: 3}},
	}
}

func TestSnapshotCopiesLiteralData(t *testing.T) {
	input := fixture()
	copyProfile, err := Snapshot(input)
	if err != nil || !reflect.DeepEqual(input, copyProfile) {
		t.Fatal("changed input data", err)
	}
	input.Objects["player_city"] = ObjectIdentity{99, 99}
	input.Objects["extra"] = ObjectIdentity{98, 98}
	input.Cohort[0], input.ReleaseDigest[0], input.EvidenceDigest[0] = 0, 0, 0
	if !reflect.DeepEqual(copyProfile, fixture()) {
		t.Fatal("caller mutation reached snapshot")
	}
	second, err := Snapshot(copyProfile)
	if err != nil {
		t.Fatal(err)
	}
	delete(second.Objects, "player_city")
	second.Objects["other"] = ObjectIdentity{6, 3}
	if !reflect.DeepEqual(copyProfile, fixture()) {
		t.Fatal("second snapshot mutation reached original")
	}
}

func TestSnapshotRejectsIncompleteInputs(t *testing.T) {
	cases := map[string]func(*Profile){
		"release":           func(p *Profile) { p.ReleaseDigest = [32]byte{} },
		"evidence":          func(p *Profile) { p.EvidenceDigest = [32]byte{} },
		"cluster ref":       func(p *Profile) { p.ClusterRef = "" },
		"evidence ref":      func(p *Profile) { p.EvidenceRef = "" },
		"database name":     func(p *Profile) { p.DatabaseName = "" },
		"schema name":       func(p *Profile) { p.SchemaName = "" },
		"current role name": func(p *Profile) { p.CurrentRoleName = "" },
		"session role name": func(p *Profile) { p.SessionRoleName = "" },
		"database OID":      func(p *Profile) { p.DatabaseOID = 0 },
		"schema OID":        func(p *Profile) { p.SchemaOID = 0 },
		"schema owner":      func(p *Profile) { p.SchemaOwnerOID = 0 },
		"current role OID":  func(p *Profile) { p.CurrentRoleOID = 0 },
		"session role OID":  func(p *Profile) { p.SessionRoleOID = 0 },
		"zero shard":        func(p *Profile) { p.ServerID = 0 },
		"negative shard":    func(p *Profile) { p.ServerID = -1 },
		"cohort":            func(p *Profile) { p.Cohort = [16]byte{} },
		"nil objects":       func(p *Profile) { p.Objects = nil },
		"empty objects":     func(p *Profile) { p.Objects = map[string]ObjectIdentity{} },
		"empty object name": func(p *Profile) { p.Objects[""] = ObjectIdentity{6, 3} },
		"zero object OID":   func(p *Profile) { p.Objects["bad"] = ObjectIdentity{0, 3} },
		"zero object owner": func(p *Profile) { p.Objects["bad"] = ObjectIdentity{6, 0} },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			input := fixture()
			change(&input)
			got, err := Snapshot(input)
			if !errors.Is(err, ErrProfile) || !reflect.DeepEqual(got, Profile{}) {
				t.Fatal("invalid or partial result accepted", err)
			}
		})
	}
	if _, err := Snapshot(Profile{}); !errors.Is(err, ErrProfile) {
		t.Fatal("zero profile accepted")
	}
}

func TestSnapshotIsNotAnInventoryCertificate(t *testing.T) {
	p := fixture()
	// This utility intentionally cannot know the domain's required inventory.
	// Domain constructors must reject missing, extra or mismatching objects.
	p.Objects = map[string]ObjectIdentity{"not_a_world_relation": {OID: 42, OwnerOID: 3}}
	if _, err := Snapshot(p); err != nil {
		t.Fatal("structural utility invented object authority", err)
	}
}

func TestConcurrentIndependentSnapshots(t *testing.T) {
	input := fixture() // shared input remains read-only
	var group sync.WaitGroup
	failures := make(chan error, 16)
	for i := 0; i < 16; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			p, err := Snapshot(input)
			if err != nil {
				failures <- err
				return
			}
			p.Objects["local"] = ObjectIdentity{7, 3}
			delete(p.Objects, "player_city")
		}()
	}
	group.Wait()
	close(failures)
	for err := range failures {
		t.Error(err)
	}
	if !reflect.DeepEqual(input, fixture()) {
		t.Fatal("independent snapshot changed shared input")
	}
}
