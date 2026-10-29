package api

import (
	"sync"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func evidenceProfile() freshsource.Profile {
	return freshsource.Profile{
		ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "cluster", EvidenceRef: "evidence",
		DatabaseName: "db", SchemaName: "schema", CurrentRoleName: "role", SessionRoleName: "role",
		DatabaseOID: 1, SchemaOID: 2, SchemaOwnerOID: 3, CurrentRoleOID: 4, SessionRoleOID: 5,
		ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{"object": {OID: 6, OwnerOID: 7}},
	}
}

func TestMilitaryDurableParticipantCopies(t *testing.T) {
	recruit, fresh := &march.RecruitParticipant{}, &march.FreshCityParticipant{}
	handle, err := NewMilitaryDurable(&recruittx.Binding{}, evidenceProfile(), recruit, fresh)
	if err != nil {
		t.Fatal(err)
	}
	*recruit, *fresh = march.RecruitParticipant{}, march.FreshCityParticipant{}
	if handle.Recruit() == recruit || handle.FreshCity() == fresh {
		t.Fatal("constructor stores caller participant pointers")
	}
	gotRecruit, gotFresh := handle.Recruit(), handle.FreshCity()
	if gotRecruit == nil || gotFresh == nil || gotRecruit == handle.Recruit() || gotFresh == handle.FreshCity() {
		t.Fatal("accessor returns the stored participant")
	}
	*gotRecruit, *gotFresh = march.RecruitParticipant{}, march.FreshCityParticipant{}
	if handle.Recruit() == gotRecruit || handle.FreshCity() == gotFresh {
		t.Fatal("mutating an accessor copy changed the stored participant")
	}
}

func TestMilitaryDurableParticipantConcurrentCopies(t *testing.T) {
	handle, err := NewMilitaryDurable(&recruittx.Binding{}, evidenceProfile(), &march.RecruitParticipant{}, &march.FreshCityParticipant{})
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	wg.Add(8)
	for range 8 {
		go func() {
			defer wg.Done()
			for range 500 {
				recruit, fresh := handle.Recruit(), handle.FreshCity()
				*recruit, *fresh = march.RecruitParticipant{}, march.FreshCityParticipant{}
			}
		}()
	}
	wg.Wait()
}
