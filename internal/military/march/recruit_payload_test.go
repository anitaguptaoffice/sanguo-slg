package march

import (
	"bytes"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"testing"
)

const payloadGolden = `{"v":1,"unit_cfg_id":1,"count":2,"cost_paid":{"food":80,"wood":40,"iron":0,"stone":0},"duration_sec":60,"catalog_version":"recruit-v1:eba0b17092787c8e796ce47af01d956e74885f8dd71d45b76a25d333447b728f","rule_digest":"4c1f706ca9b78d06bc4233a6bf52ac682b2998104754aca5f7f3fc5a68f64082"}`

func payloadCatalog(t *testing.T) *RecruitCatalog {
	t.Helper()
	m := evidenceFixture(t)
	catalog, err := NewRecruitCatalog([]RecruitManifest{m}, m.Version)
	if err != nil {
		t.Fatal(err)
	}
	return catalog
}

func TestRecruitPayloadRoundTrip(t *testing.T) {
	c := payloadCatalog(t)
	for unit := int32(1); unit <= 4; unit++ {
		e, err := c.Current(unit)
		if err != nil {
			t.Fatal(err)
		}
		req := RecruitRequest{CityID: 42, UnitCfgID: unit, Count: 2}
		raw, err := encodeRecruitPayload(e, req)
		if err != nil {
			t.Fatal(err)
		}
		if unit == 1 && string(raw) != payloadGolden {
			t.Fatalf("golden mismatch %s", raw)
		}
		before := bytes.Clone(raw)
		got, err := decodeRecruitPayload(raw, c)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(raw, before) || got.Unit != unit || got.Count != 2 {
			t.Fatal("input or result mismatch")
		}
		encoded, err := json.Marshal(got)
		if err != nil || !bytes.Equal(encoded, raw) {
			t.Fatal("roundtrip", err)
		}
		raw[0] = '!'
		if got.validate(c) != nil {
			t.Fatal("retained input alias")
		}
	}
	old := evidenceFixture(t)
	newer := old
	newer.Rules[0].Cost.Food++
	var err error
	newer.Version, err = RecruitManifestVersion(newer.Rules)
	if err != nil {
		t.Fatal(err)
	}
	retained, err := NewRecruitCatalog([]RecruitManifest{old, newer}, newer.Version)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = decodeRecruitPayload([]byte(payloadGolden), retained); err != nil {
		t.Fatal("repriced historical payload", err)
	}
	currentOnly, err := NewRecruitCatalog([]RecruitManifest{newer}, newer.Version)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = decodeRecruitPayload([]byte(payloadGolden), currentOnly); err == nil {
		t.Fatal("fallback to current")
	}
}

func TestRecruitPayloadOriginalJSON(t *testing.T) {
	c := payloadCatalog(t)
	cases := map[string][]byte{
		"duplicateRoot":    []byte(strings.Replace(payloadGolden, `"v":1`, `"v":1,"v":1`, 1)),
		"duplicateEscaped": []byte(strings.Replace(payloadGolden, `"v":1`, `"v":1,"\u0076":1`, 1)),
		"duplicateCost":    []byte(strings.Replace(payloadGolden, `"food":80`, `"food":80,"food":80`, 1)),
		"escapedCost":      []byte(strings.Replace(payloadGolden, `"food":80`, `"food":80,"\u0066ood":80`, 1)),
		"extraRoot":        []byte(strings.Replace(payloadGolden, `"v":1`, `"v":1,"other":0`, 1)),
		"missingRoot":      []byte(strings.Replace(payloadGolden, `"v":1,`, "", 1)),
		"extraCost":        []byte(strings.Replace(payloadGolden, `"food":80`, `"food":80,"gold":0`, 1)),
		"missingCost":      []byte(strings.Replace(payloadGolden, `"food":80,`, "", 1)),
		"costArray":        []byte(strings.Replace(payloadGolden, `{"food":80,"wood":40,"iron":0,"stone":0}`, `[]`, 1)),
		"trailing":         []byte(payloadGolden + ` {}`), "rootNull": []byte(`null`), "rootArray": []byte(`[]`),
		"invalidUTF8": append([]byte(payloadGolden), 0xff), "BOM": append([]byte{0xef, 0xbb, 0xbf}, []byte(payloadGolden)...),
		"oversize": []byte(strings.Repeat(" ", 65537)), "empty": nil,
	}
	for field, original := range map[string]string{"v": "1", "unit_cfg_id": "1", "count": "2", "duration_sec": "60", "food": "80"} {
		for _, bad := range []string{`null`, `true`, `"2"`, `2.0`, `2e0`, `-1`, `9223372036854775808`} {
			cases[field+bad] = []byte(strings.Replace(payloadGolden, `"`+field+`":`+original, `"`+field+`":`+bad, 1))
		}
	}
	for field, original := range map[string]string{"catalog_version": `"recruit-v1:eba0b17092787c8e796ce47af01d956e74885f8dd71d45b76a25d333447b728f"`, "rule_digest": `"4c1f706ca9b78d06bc4233a6bf52ac682b2998104754aca5f7f3fc5a68f64082"`} {
		for _, bad := range []string{`null`, `0`, `true`, `""`, `[]`} {
			cases[field+bad] = []byte(strings.Replace(payloadGolden, `"`+field+`":`+original, `"`+field+`":`+bad, 1))
		}
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			before := bytes.Clone(raw)
			got, err := decodeRecruitPayload(raw, c)
			if !errors.Is(err, errRecruitPayload) || got != (recruitPayload{}) {
				t.Fatalf("accepted %s: %+v %v", raw, got, err)
			}
			if !bytes.Equal(before, raw) {
				t.Fatal("mutated raw input")
			}
		})
	}
	// Key order and whitespace have no semantic significance.
	var reordered map[string]any
	if err := json.Unmarshal([]byte(payloadGolden), &reordered); err != nil {
		t.Fatal(err)
	}
	raw, err := json.MarshalIndent(reordered, "", " ")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = decodeRecruitPayload(raw, c); err != nil {
		t.Fatal("reordered keys rejected", err)
	}
}

func TestRecruitPayloadEvidence(t *testing.T) {
	c := payloadCatalog(t)
	good, err := decodeRecruitPayload([]byte(payloadGolden), c)
	if err != nil {
		t.Fatal(err)
	}
	for name, change := range map[string]func(*recruitPayload){
		"version": func(p *recruitPayload) { p.Version = 2 }, "unit": func(p *recruitPayload) { p.Unit = 5 },
		"countZero": func(p *recruitPayload) { p.Count = 0 }, "countChanged": func(p *recruitPayload) { p.Count++ },
		"food": func(p *recruitPayload) { p.Cost.Food++ }, "wood": func(p *recruitPayload) { p.Cost.Wood++ },
		"iron": func(p *recruitPayload) { p.Cost.Iron++ }, "stone": func(p *recruitPayload) { p.Cost.Stone++ },
		"negativeCost": func(p *recruitPayload) { p.Cost.Food = -1 }, "duration": func(p *recruitPayload) { p.Seconds++ },
		"zeroSeconds": func(p *recruitPayload) { p.Seconds = 0 }, "maxSeconds": func(p *recruitPayload) { p.Seconds = math.MaxInt64 },
		"unknownCatalog": func(p *recruitPayload) { p.Catalog = "unknown" }, "upperDigest": func(p *recruitPayload) { p.Digest = strings.ToUpper(p.Digest) },
		"badDigest": func(p *recruitPayload) { p.Digest = strings.Repeat("0", 64) }, "longDigest": func(p *recruitPayload) { p.Digest += "00" },
	} {
		t.Run(name, func(t *testing.T) {
			changed := good
			change(&changed)
			raw, err := json.Marshal(changed)
			if err != nil {
				t.Fatal(err)
			}
			if got, err := decodeRecruitPayload(raw, c); !errors.Is(err, errRecruitPayload) || got != (recruitPayload{}) {
				t.Fatal("accepted corrupt fields", got, err)
			}
		})
	}
	if _, err = decodeRecruitPayload([]byte(payloadGolden), nil); err == nil {
		t.Fatal("nil catalog")
	}
	e, err := c.Current(1)
	if err != nil {
		t.Fatal(err)
	}
	for _, req := range []RecruitRequest{{UnitCfgID: 1, Count: 0}, {UnitCfgID: 2, Count: 1}, {UnitCfgID: 1, Count: math.MaxInt32}} {
		if raw, err := encodeRecruitPayload(e, req); !errors.Is(err, errRecruitPayload) || raw != nil {
			t.Fatal("invalid producer", err)
		}
	}
	if raw, err := encodeRecruitPayload(RecruitRuleEvidence{}, RecruitRequest{UnitCfgID: 1, Count: 1}); err == nil || raw != nil {
		t.Fatal("zero evidence")
	}
}

func TestRecruitPayloadArithmeticLimits(t *testing.T) {
	m := evidenceFixture(t)
	m.Rules[0].Cost = Resources{}
	m.Rules[0].SecondsPerUnit = 1
	m.Rules[1].Cost = Resources{Food: math.MaxInt64}
	m.Rules[1].SecondsPerUnit = 9223372036
	var err error
	m.Version, err = RecruitManifestVersion(m.Rules)
	if err != nil {
		t.Fatal(err)
	}
	c, err := NewRecruitCatalog([]RecruitManifest{m}, m.Version)
	if err != nil {
		t.Fatal(err)
	}
	for _, req := range []RecruitRequest{{UnitCfgID: 1, Count: math.MaxInt32}, {UnitCfgID: 2, Count: 1}} {
		e, err := c.Current(req.UnitCfgID)
		if err != nil {
			t.Fatal(err)
		}
		raw, err := encodeRecruitPayload(e, req)
		if err != nil {
			t.Fatal(err)
		}
		if got, err := decodeRecruitPayload(raw, c); err != nil || got.Count != req.Count {
			t.Fatal("valid boundary rejected", err)
		}
	}
	e, err := c.Current(2)
	if err != nil {
		t.Fatal(err)
	}
	if raw, err := encodeRecruitPayload(e, RecruitRequest{UnitCfgID: 2, Count: 2}); err == nil || raw != nil {
		t.Fatal("cost/duration overflow accepted")
	}
	for _, raw := range []string{
		strings.Replace(payloadGolden, `"count":2`, `"count":2147483648`, 1),
		strings.Replace(payloadGolden, `"duration_sec":60`, `"duration_sec":9223372037`, 1),
	} {
		if got, err := decodeRecruitPayload([]byte(raw), payloadCatalog(t)); err == nil || got != (recruitPayload{}) {
			t.Fatal("range boundary accepted")
		}
	}
}
