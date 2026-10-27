package march

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"math"
	"strings"
	"sync"
	"testing"
	"time"
)

func evidenceFixture(t *testing.T) RecruitManifest {
	t.Helper()
	m := RecruitManifest{Rules: [4]RecruitRule{
		{1, Resources{40, 20, 0, 0}, 30},
		{2, Resources{80, 40, 20, 0}, 45},
		{3, Resources{50, 60, 0, 0}, 35},
		{4, Resources{100, 80, 30, 40}, 60},
	}}
	var err error
	m.Version, err = RecruitManifestVersion(m.Rules)
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func TestRecruitRuleGolden(t *testing.T) {
	m := evidenceFixture(t)
	if m.Version != "recruit-v1:eba0b17092787c8e796ce47af01d956e74885f8dd71d45b76a25d333447b728f" {
		t.Fatal(m.Version)
	}
	raw, err := recruitRuleBytes(m.Rules[0])
	if err != nil {
		t.Fatal(err)
	}
	if hex.EncodeToString(raw[:]) != "73616e67756f2f726563727569742d72756c652f763100000000010000000000000028000000000000001400000000000000000000000000000000000000000000001e" {
		t.Fatal("rule bytes")
	}
	digest := sha256.Sum256(raw[:])
	if hex.EncodeToString(digest[:]) != "4c1f706ca9b78d06bc4233a6bf52ac682b2998104754aca5f7f3fc5a68f64082" {
		t.Fatal("rule digest")
	}
	for _, change := range []func(*RecruitRule){
		func(r *RecruitRule) { r.UnitCfgID = 2 }, func(r *RecruitRule) { r.Cost.Food++ },
		func(r *RecruitRule) { r.Cost.Wood++ }, func(r *RecruitRule) { r.Cost.Iron++ },
		func(r *RecruitRule) { r.Cost.Stone++ }, func(r *RecruitRule) { r.SecondsPerUnit++ },
	} {
		rule := m.Rules[0]
		change(&rule)
		encoded, err := recruitRuleBytes(rule)
		if err != nil || sha256.Sum256(encoded[:]) == digest {
			t.Fatal("field omitted", err)
		}
	}
}

func TestRecruitRuleValidation(t *testing.T) {
	m := evidenceFixture(t)
	for _, change := range []func(*RecruitRule){
		func(r *RecruitRule) { r.UnitCfgID = 0 }, func(r *RecruitRule) { r.UnitCfgID = 5 },
		func(r *RecruitRule) { r.Cost.Food = -1 }, func(r *RecruitRule) { r.Cost.Wood = -1 },
		func(r *RecruitRule) { r.Cost.Iron = -1 }, func(r *RecruitRule) { r.Cost.Stone = -1 },
		func(r *RecruitRule) { r.SecondsPerUnit = 0 }, func(r *RecruitRule) { r.SecondsPerUnit = -1 },
		func(r *RecruitRule) { r.SecondsPerUnit = math.MaxInt64/int64(time.Second) + 1 },
	} {
		rules := m.Rules
		change(&rules[0])
		if _, err := RecruitManifestVersion(rules); !errors.Is(err, ErrRecruitManifest) {
			t.Fatal("bad rule accepted")
		}
	}
	for _, kind := range []string{"order", "duplicate", "missing"} {
		rules := m.Rules
		switch kind {
		case "order":
			rules[0], rules[1] = rules[1], rules[0]
		case "duplicate":
			rules[1] = rules[0]
		case "missing":
			rules[3] = RecruitRule{}
		}
		if _, err := RecruitManifestVersion(rules); err == nil {
			t.Fatal(kind)
		}
	}
	for _, records := range [][]RecruitManifest{nil, {}, {m, m}, {{Version: strings.ToUpper(m.Version), Rules: m.Rules}}, {{Rules: m.Rules}}} {
		if _, err := NewRecruitCatalog(records, m.Version); err == nil {
			t.Fatal("bad manifest accepted")
		}
	}
	if _, err := NewRecruitCatalog([]RecruitManifest{m}, "missing"); err == nil {
		t.Fatal("missing current")
	}
	changed := m
	changed.Rules[0].Cost.Food++
	if _, err := NewRecruitCatalog([]RecruitManifest{changed}, m.Version); err == nil {
		t.Fatal("version tampering")
	}
}

func TestRecruitCatalogSnapshotAndHistory(t *testing.T) {
	old := evidenceFixture(t)
	newer := old
	newer.Rules[0].Cost.Food++
	var err error
	newer.Version, err = RecruitManifestVersion(newer.Rules)
	if err != nil {
		t.Fatal(err)
	}
	records := []RecruitManifest{old, newer}
	catalog, err := NewRecruitCatalog(records, newer.Version)
	if err != nil {
		t.Fatal(err)
	}
	records[0].Rules[0].Cost.Food = 999
	records[1] = RecruitManifest{}
	current, err := catalog.Current(1)
	if err != nil || current.Rule().Cost.Food != 41 || current.Version() != newer.Version {
		t.Fatal("snapshot/current", err)
	}
	raw, err := recruitRuleBytes(old.Rules[0])
	if err != nil {
		t.Fatal(err)
	}
	oldDigest := sha256.Sum256(raw[:])
	retained, err := catalog.Resolve(old.Version, 1, oldDigest)
	if err != nil || retained.Rule().Cost.Food != 40 {
		t.Fatal("repriced old rule", err)
	}
	copyRule, copyDigest := retained.Rule(), retained.Digest()
	copyRule.Cost.Food = 700
	copyDigest[0]++
	if retained.Rule().Cost.Food != 40 || retained.Digest() != oldDigest {
		t.Fatal("mutable evidence")
	}
	for _, c := range []*RecruitCatalog{nil, {}} {
		if _, err := c.Current(1); err == nil {
			t.Fatal("zero catalog")
		}
		if _, err := c.Resolve(old.Version, 1, oldDigest); err == nil {
			t.Fatal("zero resolve")
		}
	}
	for _, unit := range []int32{0, 5} {
		if _, err := catalog.Current(unit); err == nil {
			t.Fatal("unknown unit")
		}
	}
	if _, err := catalog.Resolve("missing", 1, oldDigest); err == nil {
		t.Fatal("missing history fallback")
	}
	if _, err := catalog.Resolve(old.Version, 2, oldDigest); err == nil {
		t.Fatal("unit digest mismatch")
	}
	if _, err := catalog.Resolve(old.Version, 1, copyDigest); err == nil {
		t.Fatal("digest mismatch")
	}
	var group sync.WaitGroup
	failures := make(chan error, 16)
	for i := 0; i < 16; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for j := 0; j < 100; j++ {
				if _, err := catalog.Resolve(old.Version, 1, oldDigest); err != nil {
					failures <- err
					return
				}
			}
		}()
	}
	group.Wait()
	close(failures)
	for err := range failures {
		t.Error(err)
	}
}

func TestRecruitEvidenceCheckedPlan(t *testing.T) {
	m := evidenceFixture(t)
	catalog, err := NewRecruitCatalog([]RecruitManifest{m}, m.Version)
	if err != nil {
		t.Fatal(err)
	}
	e, err := catalog.Current(1)
	if err != nil {
		t.Fatal(err)
	}
	req := RecruitRequest{CityID: 9, UnitCfgID: 1, Count: 3}
	plan, err := e.Plan(req)
	if err != nil || plan.Request() != req || plan.Cost() != (Resources{120, 60, 0, 0}) || plan.DurationSeconds() != 90 {
		t.Fatal("wrong plan", err)
	}
	if _, err := (RecruitRuleEvidence{}).Plan(req); !errors.Is(err, ErrRecruitEvidence) {
		t.Fatal("zero evidence")
	}
	req.UnitCfgID = 2
	if _, err := e.Plan(req); !errors.Is(err, ErrRecruitEvidence) {
		t.Fatal("mismatched unit")
	}
	req.UnitCfgID, req.Count = 1, 0
	if _, err := e.Plan(req); !errors.Is(err, ErrInvalidCount) {
		t.Fatal("invalid count")
	}
	for _, duration := range []bool{false, true} {
		boundary := m
		if duration {
			boundary.Rules[0].SecondsPerUnit = math.MaxInt64 / int64(time.Second)
		} else {
			boundary.Rules[0].Cost.Food = math.MaxInt64
		}
		boundary.Version, err = RecruitManifestVersion(boundary.Rules)
		if err != nil {
			t.Fatal(err)
		}
		c, err := NewRecruitCatalog([]RecruitManifest{boundary}, boundary.Version)
		if err != nil {
			t.Fatal(err)
		}
		b, err := c.Current(1)
		if err != nil {
			t.Fatal(err)
		}
		req.Count = 1
		if _, err := b.Plan(req); err != nil {
			t.Fatal("valid boundary", err)
		}
		req.Count = 2
		if _, err := b.Plan(req); !errors.Is(err, ErrRecruitOverflow) {
			t.Fatal("overflow")
		}
	}
}
