package march

import (
	"context"
	"errors"
	"math"
	"reflect"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestReturnAtomicInvalid(t *testing.T) {
	c, origin := ReturnCandidate{1, 42, 9, 1, 1}, ReturnOrigin{1, 42, 9, 0, 0}
	for _, p := range []*ReturnParticipant{nil, {}, {source: &freshMilitarySource{}},
		{source: &freshMilitarySource{binding: &recruittx.Binding{}}, catalog: payloadCatalog(t)}} {
		for _, run := range []func(context.Context, *recruittx.Access, ReturnCandidate, ReturnOrigin) (ReturnObservation, error){p.Complete, p.Readback} {
			for _, a := range []*recruittx.Access{nil, {}} {
				got, err := run(context.Background(), a, c, origin)
				if err == nil || got != (ReturnObservation{}) {
					t.Fatal("invalid participant/access returned observation", got, err)
				}
			}
			got, err := run(nil, nil, ReturnCandidate{}, ReturnOrigin{})
			if !errors.Is(err, ErrReturnSource) || got != (ReturnObservation{}) {
				t.Fatal("nil context/source", got, err)
			}
		}
	}
}

func atomicPendingFixture(t *testing.T) (recruitScope, recruitPendingSnapshot, *RecruitCatalog) {
	scope, stock, rows, catalog := pendingFixture(t)
	return scope, recruitPendingSnapshot{stock: stock, ids: []int64{1}, players: []int64{scope.player}, statuses: []int16{1},
		starts: []time.Time{rows[0].start}, finishes: []time.Time{rows[0].finish}, payloads: []string{payloadGolden}}, catalog
}

func TestReturnAtomicCapacity(t *testing.T) {
	scope, pending, catalog := atomicPendingFixture(t)
	pending.stock[0].ready, pending.stock[0].wounded = math.MaxInt32-3, math.MaxInt32
	ready, err := returnCapacity(scope, pending, []int32{1, 4}, []int32{1, 9}, catalog)
	if err != nil || ready != ([4]int64{math.MaxInt32 - 2, 0, 0, 9}) || pending.stock[0].ready != math.MaxInt32-3 {
		t.Fatal("boundary capacity or mutated input", ready, err)
	}
	pending.stock[0].ready++ // R+S fits; R+P+S does not.
	if got, err := returnCapacity(scope, pending, []int32{1}, []int32{1}, catalog); err == nil || got != ([4]int64{}) {
		t.Fatal("pending reservation ignored", got, err)
	}
	pending.stock[0].ready++ // Overflow in an unrelated unit must also reject.
	if _, err := returnCapacity(scope, pending, []int32{4}, []int32{1}, catalog); err == nil {
		t.Fatal("unrelated pending overflow ignored")
	}
	for _, change := range []func(*recruitPendingSnapshot){
		func(s *recruitPendingSnapshot) { s.players[0]++ },
		func(s *recruitPendingSnapshot) { s.statuses[0] = 0 },
		func(s *recruitPendingSnapshot) { s.payloads[0] = `{}` },
		func(s *recruitPendingSnapshot) { s.finishes[0] = s.starts[0] },
		func(s *recruitPendingSnapshot) { s.starts = nil },
		func(s *recruitPendingSnapshot) { s.stock = s.stock[:3] },
	} {
		scope, pending, catalog := atomicPendingFixture(t)
		change(&pending)
		if got, err := returnCapacity(scope, pending, []int32{1}, []int32{1}, catalog); err == nil || got != ([4]int64{}) {
			t.Fatal("malformed pending accepted", got, err)
		}
	}
	for _, units := range [][]int32{nil, {0}, {5}, {1, 1}, {2, 1}} {
		scope, pending, catalog := atomicPendingFixture(t)
		counts := make([]int32, len(units))
		for i := range counts {
			counts[i] = 1
		}
		if _, err := returnCapacity(scope, pending, units, counts, catalog); err == nil {
			t.Fatal("malformed survivors accepted", units)
		}
	}
	for _, counts := range [][]int32{nil, {0}, {-1}, {1, 2}} {
		scope, pending, catalog := atomicPendingFixture(t)
		if _, err := returnCapacity(scope, pending, []int32{1}, counts, catalog); err == nil {
			t.Fatal("malformed survivor counts accepted", counts)
		}
	}
}

func TestReturnAtomicAllPendingAndStoredRules(t *testing.T) {
	scope, pending, _ := atomicPendingFixture(t)
	old := evidenceFixture(t)
	newer := old
	newer.Rules[0].Cost.Food++
	var err error
	newer.Version, err = RecruitManifestVersion(newer.Rules)
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := NewRecruitCatalog([]RecruitManifest{old, newer}, newer.Version)
	if err != nil {
		t.Fatal(err)
	}
	for id := int64(2); id <= 1000; id++ {
		pending.ids = append(pending.ids, id)
		pending.players = append(pending.players, scope.player)
		pending.statuses = append(pending.statuses, 0)
		pending.starts = append(pending.starts, pending.starts[0])
		pending.finishes = append(pending.finishes, pending.finishes[0])
		pending.payloads = append(pending.payloads, payloadGolden)
	}
	before := append([]string(nil), pending.payloads...)
	if got, err := returnCapacity(scope, pending, []int32{1}, []int32{7}, catalog); err != nil || got[0] != 7 || !reflect.DeepEqual(before, pending.payloads) {
		t.Fatal("stored rules or complete pending", got, err)
	}
	pending.payloads[999] = `{}`
	if _, err := returnCapacity(scope, pending, []int32{1}, []int32{7}, catalog); err == nil {
		t.Fatal("last pending row ignored")
	}
}
