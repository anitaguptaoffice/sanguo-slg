package march

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Exact retained artifact bytes from DATA-RECRUIT-MANIFEST-001, not runtime IO.
const recruitManifestJSON = `{
  "format": 1,
  "version": "recruit-v1:eba0b17092787c8e796ce47af01d956e74885f8dd71d45b76a25d333447b728f",
  "rules": [
    {
      "unit_cfg_id": 1,
      "cost_per_unit": {
        "food": 40,
        "wood": 20,
        "iron": 0,
        "stone": 0
      },
      "seconds_per_unit": 30
    },
    {
      "unit_cfg_id": 2,
      "cost_per_unit": {
        "food": 80,
        "wood": 40,
        "iron": 20,
        "stone": 0
      },
      "seconds_per_unit": 45
    },
    {
      "unit_cfg_id": 3,
      "cost_per_unit": {
        "food": 50,
        "wood": 60,
        "iron": 0,
        "stone": 0
      },
      "seconds_per_unit": 35
    },
    {
      "unit_cfg_id": 4,
      "cost_per_unit": {
        "food": 100,
        "wood": 80,
        "iron": 30,
        "stone": 40
      },
      "seconds_per_unit": 60
    }
  ]
}
`

func requireManifestReject(t *testing.T, raw []byte) {
	t.Helper()
	got, err := DecodeRecruitManifest(raw)
	if !errors.Is(err, ErrRecruitManifest) || got != (RecruitManifest{}) {
		t.Fatalf("invalid JSON yielded partial/valid record: %v", err)
	}
}

func TestRecruitManifestDecodeGolden(t *testing.T) {
	raw := []byte(recruitManifestJSON)
	digest := sha256.Sum256(raw)
	if hex.EncodeToString(digest[:]) != "90499740432ff308e3b7a6f2bd9f54ff5af127d98acc091a4c13af18fc561262" {
		t.Fatal("fixture no longer matches published artifact")
	}
	got, err := DecodeRecruitManifest(raw)
	if err != nil || got != evidenceFixture(t) {
		t.Fatal("golden decode", err)
	}
	want := got
	for i := range raw {
		raw[i] = 'x'
	}
	if got != want {
		t.Fatal("borrowed input memory")
	}
	catalog, err := NewRecruitCatalog([]RecruitManifest{got}, got.Version)
	if err != nil {
		t.Fatal(err)
	}
	evidence, err := catalog.Current(1)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := evidence.Plan(RecruitRequest{CityID: 1, UnitCfgID: 1, Count: 2})
	if err != nil || plan.Cost().Food != 80 {
		t.Fatal("decoded plan", err)
	}
	var reordered map[string]any
	if err := json.Unmarshal([]byte(recruitManifestJSON), &reordered); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(reordered)
	if err != nil {
		t.Fatal(err)
	}
	if again, err := DecodeRecruitManifest(encoded); err != nil || again != want {
		t.Fatal("key order", err)
	}
}

func TestRecruitManifestDecodeOriginalTokens(t *testing.T) {
	for _, pair := range [][2]string{
		{`"format": 1`, `"format": 1, "format": 1`},
		{`"format": 1`, `"format": 1, "\u0066ormat": 1`},
		{`"unit_cfg_id": 1`, `"unit_cfg_id": 1, "unit_cfg_id": 1`},
		{`"food": 40`, `"food": 40, "food": 40`},
		{`"format": 1`, `"format": true`},
		{`"food": 40`, `"food": "40"`},
		{`"food": 40`, `"food": 40.0`},
		{`"food": 40`, `"food": 4e1`},
		{`"iron": 0`, `"iron": null`},
		{`"iron": 0`, `"iron": false`},
		{`"food": 40`, `"food": -1`},
		{`"food": 40`, `"food": 9223372036854775808`},
		{`"seconds_per_unit": 30`, `"seconds_per_unit": 0`},
		{`"seconds_per_unit": 30`, `"seconds_per_unit": 9223372037`},
		{`"unit_cfg_id": 1`, `"unit_cfg_id": 0`},
		{`"unit_cfg_id": 1`, `"unit_cfg_id": 5`},
		{`"food": 40`, `"food": NaN`},
		{`"food": 40`, `"food": Infinity`},
		{`"version": "recruit-v1:`, `"version": "RECRUIT-v1:`},
		{`"food": 40`, `"food": 41`},
	} {
		changed := strings.Replace(recruitManifestJSON, pair[0], pair[1], 1)
		if changed == recruitManifestJSON {
			t.Fatal("test mutation missed")
		}
		requireManifestReject(t, []byte(changed))
	}
	for _, bad := range [][]byte{nil, []byte("null"), []byte("[]"), []byte(recruitManifestJSON + "{}"),
		append([]byte{0xff}, []byte(recruitManifestJSON)...),
		append([]byte{0xef, 0xbb, 0xbf}, []byte(recruitManifestJSON)...)} {
		requireManifestReject(t, bad)
	}
}

func TestRecruitManifestDecodeShape(t *testing.T) {
	for _, mutate := range []func(map[string]any){
		func(d map[string]any) { delete(d, "format") },
		func(d map[string]any) { d["extra"] = 1 },
		func(d map[string]any) { d["rules"] = nil },
		func(d map[string]any) { d["rules"] = d["rules"].([]any)[:3] },
		func(d map[string]any) { r := d["rules"].([]any); d["rules"] = append(r, r[0]) },
		func(d map[string]any) { r := d["rules"].([]any); r[0], r[1] = r[1], r[0] },
		func(d map[string]any) { r := d["rules"].([]any); r[1] = r[0] },
		func(d map[string]any) { r := d["rules"].([]any)[0].(map[string]any); delete(r, "seconds_per_unit") },
		func(d map[string]any) { d["rules"].([]any)[0].(map[string]any)["extra"] = 1 },
		func(d map[string]any) {
			c := d["rules"].([]any)[0].(map[string]any)["cost_per_unit"].(map[string]any)
			delete(c, "iron")
		},
		func(d map[string]any) {
			d["rules"].([]any)[0].(map[string]any)["cost_per_unit"].(map[string]any)["gold"] = 0
		},
	} {
		var doc map[string]any
		if err := json.Unmarshal([]byte(recruitManifestJSON), &doc); err != nil {
			t.Fatal(err)
		}
		mutate(doc)
		raw, err := json.Marshal(doc)
		if err != nil {
			t.Fatal(err)
		}
		requireManifestReject(t, raw)
	}
}

func TestRecruitManifestDecodeBounds(t *testing.T) {
	padding := bytes.Repeat([]byte(" "), 65536-len(recruitManifestJSON))
	if _, err := DecodeRecruitManifest(append(padding, []byte(recruitManifestJSON)...)); err != nil {
		t.Fatal("exact size", err)
	}
	requireManifestReject(t, append(append(padding, ' '), []byte(recruitManifestJSON)...))
	want := evidenceFixture(t)
	want.Rules[0].Cost.Food = math.MaxInt64
	want.Rules[0].SecondsPerUnit = math.MaxInt64 / int64(time.Second)
	var err error
	oldVersion := want.Version
	want.Version, err = RecruitManifestVersion(want.Rules)
	if err != nil {
		t.Fatal(err)
	}
	raw := strings.Replace(recruitManifestJSON, oldVersion, want.Version, 1)
	raw = strings.Replace(raw, `"food": 40`, `"food": `+strconv.FormatInt(math.MaxInt64, 10), 1)
	raw = strings.Replace(raw, `"seconds_per_unit": 30`, `"seconds_per_unit": 9223372036`, 1)
	if got, err := DecodeRecruitManifest([]byte(raw)); err != nil || got != want {
		t.Fatal("integer boundary", err)
	}
}
