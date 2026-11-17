package domestic

import (
	"bytes"
	"crypto/sha256"
	"maps"
	"reflect"
	"sync"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

// Private data fixture only: successful constructor/PG evidence is separate.
func freshTemplateSourceUnit(t *testing.T) *FreshCityParticipant {
	t.Helper()
	s := freshSourceUnitState()
	var err error
	s.binding, err = recruittx.NewBinding(s.pool)
	if err != nil {
		t.Fatal(err)
	}
	return &FreshCityParticipant{state: s}
}

func freshTemplateSourceInput() (*CityState, FreshTemplateVersions) {
	return &CityState{PlayerID: 7, Wallet: Resources{8000, 8000, 5000, 5000},
			Buildings: map[string]*BuildingInstance{"farm": {2, 1}, "hall": {1, 1}}},
		FreshTemplateVersions{"dom-first-city-1", "first-city-rules-1", "dom-default-1"}
}

// Every field is changed on unused ID 7. ID changes preserve map-key equality.
func freshTemplateSourceCatalogChanges() map[string]func(map[int32]BuildingSpec) {
	fields := map[string]func(*BuildingSpec){
		"time":     func(s *BuildingSpec) { s.BaseTimeSec++ },
		"food":     func(s *BuildingSpec) { s.BaseCost.Food++ },
		"wood":     func(s *BuildingSpec) { s.BaseCost.Wood++ },
		"stone":    func(s *BuildingSpec) { s.BaseCost.Stone++ },
		"iron":     func(s *BuildingSpec) { s.BaseCost.Iron++ },
		"rate":     func(s *BuildingSpec) { s.ProdPerHour++ },
		"resource": func(s *BuildingSpec) { s.ProdRes = (s.ProdRes + 1) % 4 },
	}
	changes := map[string]func(map[int32]BuildingSpec){
		"removed": func(c map[int32]BuildingSpec) { delete(c, 7) },
		"added":   func(c map[int32]BuildingSpec) { c[8] = BuildingSpec{ID: 8, BaseTimeSec: 1} },
		"id": func(c map[int32]BuildingSpec) {
			s := c[7]
			s.ID = 8
			delete(c, 7)
			c[8] = s
		},
	}
	for name, change := range fields {
		changes[name] = func(c map[int32]BuildingSpec) {
			s := c[7]
			change(&s)
			c[7] = s
		}
	}
	return changes
}

func TestFreshTemplateSourceIsolation(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, versions := freshTemplateSourceInput()
	first, err := p.CaptureTemplate(initial, versions)
	if err != nil || ValidateFreshTemplateContent(first) != nil {
		t.Fatal(err)
	}
	initial.PlayerID = 99
	second, err := p.CaptureTemplate(initial, versions)
	if err != nil || first.SHA256 != second.SHA256 || !bytes.Equal(first.Bytes, second.Bytes) {
		t.Fatal("actor changed bytes", err)
	}
	retained := bytes.Clone(second.Bytes)
	initial.Buildings["hall"].Level = 9
	initial.Wallet.Food = 0
	first.Bytes[0] ^= 1
	one, err := p.RestoreTemplate(second, 10)
	if err != nil {
		t.Fatal(err)
	}
	two, err := p.RestoreTemplate(second, 11)
	if err != nil || one.PlayerID != 10 || two.PlayerID != 11 || one.Buildings["hall"].Level != 1 || one.Wallet.Food != 8000 {
		t.Fatal("restore changed data", err)
	}
	one.Buildings["hall"].Level = 4
	one.Wallet.Food = 2
	if two.Buildings["hall"].Level != 1 || two.Wallet.Food != 8000 || !bytes.Equal(second.Bytes, retained) {
		t.Fatal("results alias inputs or each other")
	}
	second.Bytes[0] ^= 1
	if two.ID != 0 || two.BuildJobs != nil || !two.LastSettleAt.IsZero() || two.walletSaved ||
		two.walletBase != (Resources{}) || two.nextJobID != 0 || two.productionRemainder != ([4]int64{}) {
		t.Fatal("restore fixed invariants changed")
	}
	initial, _ = freshTemplateSourceInput()
	again, err := p.CaptureTemplate(initial, versions)
	if err != nil || !bytes.Equal(again.Bytes, retained) {
		t.Fatal("caller mutation reached capture", err)
	}
}

func TestFreshTemplateSourceCatalogEquality(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, versions := freshTemplateSourceInput()
	original := maps.Clone(p.state.catalog)
	for name, change := range freshTemplateSourceCatalogChanges() {
		t.Run(name, func(t *testing.T) {
			changed := maps.Clone(original)
			change(changed)
			content, err := encodeFreshTemplate(initial, changed, versions)
			if err != nil || ValidateFreshTemplateContent(content) != nil {
				t.Fatal("invalid mismatch fixture", err)
			}
			if got, err := p.RestoreTemplate(content, 1); err == nil || got != nil {
				t.Fatal("catalog mismatch admitted")
			}
			if p.state.retired.Load() || !maps.Equal(original, p.state.catalog) {
				t.Fatal("data mismatch retired or mutated source")
			}
		})
	}
}

func TestFreshTemplateSourceCapturedOnly(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, versions := freshTemplateSourceInput()
	before, err := p.CaptureTemplate(initial, versions)
	if err != nil {
		t.Fatal(err)
	}
	p.state.hub.cat = nil // Sequential illegal drift, not synchronized production use.
	p.state.hub.store = nil
	after, err := p.CaptureTemplate(initial, versions)
	if err != nil || !bytes.Equal(before.Bytes, after.Bytes) {
		t.Fatal("data method read current Hub", err)
	}
	if got, err := p.RestoreTemplate(before, 8); err != nil || got.PlayerID != 8 {
		t.Fatal("restore read current Hub", err)
	}
	alias := *p
	if p.state.checkWiring() == nil {
		t.Fatal("drift not detected")
	}
	p.state.hub.store, p.state.hub.cat = p.state.store, maps.Clone(p.state.catalog)
	for _, q := range []*FreshCityParticipant{p, &alias} {
		if got, err := q.CaptureTemplate(initial, versions); err == nil || !reflect.DeepEqual(got, FreshTemplateContent{}) {
			t.Fatal("retired capture returned usable content")
		}
		if got, err := q.RestoreTemplate(before, 1); err == nil || got != nil {
			t.Fatal("retired restore returned usable state")
		}
	}
	if ValidateFreshTemplateContent(before) != nil {
		t.Fatal("retirement made retained data unreadable")
	}
}

func TestFreshTemplateSourceInvalidHandles(t *testing.T) {
	initial, versions := freshTemplateSourceInput()
	valid, err := freshTemplateSourceUnit(t).CaptureTemplate(initial, versions)
	if err != nil {
		t.Fatal(err)
	}
	changes := map[string]func(*freshDomesticSource){
		"binding": func(s *freshDomesticSource) { s.binding = nil },
		"hub":     func(s *freshDomesticSource) { s.hub = nil },
		"store":   func(s *freshDomesticSource) { s.store = nil },
		"pool":    func(s *freshDomesticSource) { s.pool = nil },
		"shard":   func(s *freshDomesticSource) { s.profile.ServerID = 0 },
		"catalog": func(s *freshDomesticSource) { s.catalog = nil },
		"retired": func(s *freshDomesticSource) { s.retired.Store(true) },
		"overcount": func(s *freshDomesticSource) {
			for i := int32(1); i <= 1025; i++ {
				s.catalog[i] = BuildingSpec{ID: i, BaseTimeSec: 1}
			}
		},
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			p := freshTemplateSourceUnit(t)
			change(p.state)
			if got, err := p.CaptureTemplate(initial, versions); err == nil || !reflect.DeepEqual(got, FreshTemplateContent{}) {
				t.Fatal("invalid capture admitted")
			}
			if got, err := p.RestoreTemplate(valid, 1); err == nil || got != nil {
				t.Fatal("invalid restore admitted")
			}
		})
	}
	for _, p := range []*FreshCityParticipant{nil, {}, {state: &freshDomesticSource{}}} {
		if got, err := p.CaptureTemplate(initial, versions); err == nil || !reflect.DeepEqual(got, FreshTemplateContent{}) {
			t.Fatal("uninitialized capture admitted")
		}
		if got, err := p.RestoreTemplate(valid, 1); err == nil || got != nil {
			t.Fatal("uninitialized restore admitted")
		}
	}
}

func TestFreshTemplateSourceRejectsData(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, versions := freshTemplateSourceInput()
	valid, err := p.CaptureTemplate(initial, versions)
	if err != nil {
		t.Fatal(err)
	}
	changes := map[string]func(*FreshTemplateContent){
		"digest":    func(c *FreshTemplateContent) { c.SHA256[0] ^= 1 },
		"version":   func(c *FreshTemplateContent) { c.EncodingVersion = 2 },
		"metadata":  func(c *FreshTemplateContent) { c.Versions.RulesVersion = "other" },
		"label":     func(c *FreshTemplateContent) { c.Versions.TemplateVersion = "" },
		"truncated": func(c *FreshTemplateContent) { c.Bytes = c.Bytes[:52] },
		"trailing":  func(c *FreshTemplateContent) { c.Bytes = append(c.Bytes, 0) },
		"magic":     func(c *FreshTemplateContent) { c.Bytes[0] ^= 1 },
		"oversize":  func(c *FreshTemplateContent) { c.Bytes = make([]byte, freshTemplateMaxBytes+1) },
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			bad := valid
			bad.Bytes = bytes.Clone(valid.Bytes)
			change(&bad)
			if name != "digest" {
				bad.SHA256 = sha256.Sum256(bad.Bytes)
			}
			before := bytes.Clone(bad.Bytes)
			if got, err := p.RestoreTemplate(bad, 1); err == nil || got != nil || !bytes.Equal(before, bad.Bytes) {
				t.Fatal("malformed input admitted or mutated")
			}
		})
	}
	for _, player := range []int64{0, -1} {
		if got, err := p.RestoreTemplate(valid, player); err == nil || got != nil {
			t.Fatal("invalid actor admitted")
		}
	}
	for _, invalid := range []*CityState{nil, {PlayerID: 1}, {ID: 1, PlayerID: 1, Buildings: map[string]*BuildingInstance{}}} {
		if got, err := p.CaptureTemplate(invalid, versions); err == nil || !reflect.DeepEqual(got, FreshTemplateContent{}) {
			t.Fatal("invalid initial admitted")
		}
	}
	if p.state.retired.Load() || ValidateFreshTemplateContent(valid) != nil {
		t.Fatal("bad data changed source or history")
	}
}

func TestFreshTemplateSourceEmptyAndLabels(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	p.state.catalog = map[int32]BuildingSpec{} // Fixed pure fixture, not enrollment.
	initial := &CityState{PlayerID: 1, Buildings: map[string]*BuildingInstance{}}
	versions := FreshTemplateVersions{"retained-unknown-template", "rules-old", "catalog-old"}
	content, err := p.CaptureTemplate(initial, versions)
	if err != nil {
		t.Fatal(err)
	}
	got, err := p.RestoreTemplate(content, 2)
	if err != nil || got.Buildings == nil || len(got.Buildings) != 0 || got.BuildJobs != nil {
		t.Fatal("empty data or labels rejected", err)
	}
	initial.BuildJobs = []*BuildJob{}
	other, err := p.CaptureTemplate(initial, versions)
	if err != nil || !bytes.Equal(content.Bytes, other.Bytes) {
		t.Fatal("empty jobs changed bytes", err)
	}
	versions.RulesVersion = "bad label"
	if got, err := p.CaptureTemplate(initial, versions); err == nil || !reflect.DeepEqual(got, FreshTemplateContent{}) {
		t.Fatal("invalid label admitted")
	}
}

func TestFreshTemplateSourceConcurrentCopies(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, versions := freshTemplateSourceInput()
	content, err := p.CaptureTemplate(initial, versions)
	if err != nil {
		t.Fatal(err)
	}
	var group sync.WaitGroup
	for i := int64(1); i <= 16; i++ {
		alias := *p
		group.Add(1)
		go func() {
			defer group.Done()
			got, err := alias.RestoreTemplate(content, i)
			if err != nil || got.PlayerID != i {
				t.Error("isolated concurrent restore", err)
				return
			}
			got.Buildings["hall"].Level++
			captured, err := alias.CaptureTemplate(initial, versions)
			if err != nil || !bytes.Equal(content.Bytes, captured.Bytes) {
				t.Error("isolated concurrent capture", err)
			}
		}()
	}
	group.Wait()
	p.state.retired.Store(true)
	if got, err := p.RestoreTemplate(content, 1); err == nil || got != nil {
		t.Fatal("retired copy admitted")
	}
}
