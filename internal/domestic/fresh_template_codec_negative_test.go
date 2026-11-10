package domestic

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"maps"
	"math"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestFreshTemplateCodecMalformedBytes(t *testing.T) {
	vectors := freshCodecVectors(t)
	maximum := freshCodecContent(t, vectors[2])
	current := freshCodecContent(t, vectors[1])
	cases := map[string]func([]byte) []byte{
		"magic":             func(b []byte) []byte { b[0] ^= 1; return b },
		"encoding":          func(b []byte) []byte { b[9] = 2; return b },
		"embedded label":    func(b []byte) []byte { b[11] = 'q'; return b },
		"empty label":       func(b []byte) []byte { b[10] = 0; return b },
		"long label":        func(b []byte) []byte { b[10] = 65; return b },
		"building count":    func(b []byte) []byte { binary.BigEndian.PutUint16(b[48:50], 1025); return b },
		"catalog count":     func(b []byte) []byte { binary.BigEndian.PutUint16(b[60:62], 1025); return b },
		"huge count":        func(b []byte) []byte { binary.BigEndian.PutUint16(b[48:50], math.MaxUint16); return b },
		"time zero":         func(b []byte) []byte { binary.BigEndian.PutUint64(b[66:74], 0); return b },
		"time overflow":     func(b []byte) []byte { binary.BigEndian.PutUint64(b[66:74], 9223372037); return b },
		"resource four":     func(b []byte) []byte { b[114] = 4; return b },
		"resource 255":      func(b []byte) []byte { b[114] = 255; return b },
		"missing reference": func(b []byte) []byte { binary.BigEndian.PutUint32(b[52:56], 1); return b },
	}
	for _, offset := range []int{16, 24, 32, 40, 66, 74, 82, 90, 98, 106} {
		for _, value := range []uint64{1 << 63, math.MaxUint64} {
			cases[fmt.Sprintf("signed64-%d-%x", offset, value)] = func(b []byte) []byte {
				binary.BigEndian.PutUint64(b[offset:offset+8], value)
				return b
			}
		}
	}
	for _, offset := range []int{52, 56, 62} {
		for _, value := range []uint32{0, 1 << 31, math.MaxUint32} {
			cases[fmt.Sprintf("positive32-%d-%x", offset, value)] = func(b []byte) []byte {
				binary.BigEndian.PutUint32(b[offset:offset+4], value)
				return b
			}
		}
	}
	for name, slot := range map[string]string{
		"empty": "", "nul": "\x00", "bad utf8": "\xff", "overlong": "\xc0\x80", "surrogate": "\xed\xa0\x80",
		"above scalar range": "\xf4\x90\x80\x80", "truncated utf8": "\xf0\x9f\x98", "33 scalars": strings.Repeat("a", 33),
		"129 bytes": strings.Repeat("😀", 32) + "a",
	} {
		cases["slot-"+name] = func(b []byte) []byte {
			out := append(bytes.Clone(b[:50]), byte(len(slot)))
			out = append(out, slot...)
			return append(out, b[52:]...)
		}
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			content := maximum
			content.Bytes = mutate(bytes.Clone(maximum.Bytes))
			content.SHA256 = sha256.Sum256(content.Bytes)
			assertFreshCodecInvalid(t, content)
		})
	}
	for name, mutate := range map[string]func([]byte){
		"building order":      func(b []byte) { left := bytes.Clone(b[94:107]); copy(b[94:107], b[107:120]); copy(b[107:120], left) },
		"duplicate slot":      func(b []byte) { copy(b[107:120], b[94:107]) },
		"catalog order":       func(b []byte) { left := bytes.Clone(b[122:175]); copy(b[122:175], b[175:228]); copy(b[175:228], left) },
		"duplicate ID":        func(b []byte) { copy(b[175:228], b[122:175]) },
		"unused catalog cost": func(b []byte) { b[452] = 128 },
	} {
		t.Run(name, func(t *testing.T) {
			content := current
			content.Bytes = bytes.Clone(current.Bytes)
			mutate(content.Bytes)
			content.SHA256 = sha256.Sum256(content.Bytes)
			assertFreshCodecInvalid(t, content)
		})
	}
}

func TestFreshTemplateCodecReferenceAndSize(t *testing.T) {
	valid := freshCodecContent(t, freshCodecVectors(t)[0])
	for _, mutate := range []func(*FreshTemplateContent){
		func(c *FreshTemplateContent) { c.SHA256[0] ^= 1 },
		func(c *FreshTemplateContent) { c.SHA256 = [32]byte{} },
		func(c *FreshTemplateContent) { c.EncodingVersion = 0 },
		func(c *FreshTemplateContent) { c.EncodingVersion = math.MaxUint32 },
		func(c *FreshTemplateContent) { c.Versions.TemplateVersion = "other" },
		func(c *FreshTemplateContent) { c.Versions.RulesVersion = "other" },
		func(c *FreshTemplateContent) { c.Versions.CatalogVersion = "other" },
		func(c *FreshTemplateContent) { c.Bytes = nil },
		func(c *FreshTemplateContent) { c.Bytes = make([]byte, 262144) },
		func(c *FreshTemplateContent) { c.Bytes = make([]byte, 262145) },
	} {
		content := valid
		mutate(&content)
		assertFreshCodecInvalid(t, content)
	}
	tooLarge := valid
	tooLarge.Bytes = make([]byte, 262145)
	if allocations := testing.AllocsPerRun(20, func() { _ = ValidateFreshTemplateContent(tooLarge) }); allocations != 0 {
		t.Fatalf("overlength input allocated before rejection: %v", allocations)
	}
	city, catalog, _ := freshCodecInput("minimal-empty")
	for _, label := range []string{"", strings.Repeat("x", 65), " ", "a\x00", "é", "a/b", "a\n"} {
		for index := 0; index < 3; index++ {
			labels := [3]string{"a", "b", "c"}
			labels[index] = label
			versions := FreshTemplateVersions{labels[0], labels[1], labels[2]}
			result, err := encodeFreshTemplate(city, catalog, versions)
			if err == nil || !reflect.DeepEqual(result, FreshTemplateContent{}) {
				t.Fatalf("invalid label produced content: %q", label)
			}
			content := valid
			content.Versions = versions
			assertFreshCodecInvalid(t, content)
		}
	}
}

func TestFreshTemplateCodecInvalidSnapshots(t *testing.T) {
	cases := map[string]func(*CityState, map[int32]BuildingSpec){
		"existing city":     func(c *CityState, _ map[int32]BuildingSpec) { c.ID = 1 },
		"negative city":     func(c *CityState, _ map[int32]BuildingSpec) { c.ID = -1 },
		"zero actor":        func(c *CityState, _ map[int32]BuildingSpec) { c.PlayerID = 0 },
		"negative actor":    func(c *CityState, _ map[int32]BuildingSpec) { c.PlayerID = -1 },
		"nil buildings":     func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings = nil },
		"nil building":      func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["hall"] = nil },
		"zero cfg":          func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["hall"].CfgID = 0 },
		"unknown cfg":       func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["hall"].CfgID = 99 },
		"zero level":        func(c *CityState, _ map[int32]BuildingSpec) { c.Buildings["hall"].Level = 0 },
		"nil job":           func(c *CityState, _ map[int32]BuildingSpec) { c.BuildJobs = []*BuildJob{nil} },
		"scheduled job":     func(c *CityState, _ map[int32]BuildingSpec) { c.BuildJobs = []*BuildJob{{FinishAt: time.Unix(0, 0)}} },
		"settled epoch":     func(c *CityState, _ map[int32]BuildingSpec) { c.LastSettleAt = time.Unix(0, 0) },
		"wallet checkpoint": func(c *CityState, _ map[int32]BuildingSpec) { c.walletBase.Food = 1 },
		"saved wallet":      func(c *CityState, _ map[int32]BuildingSpec) { c.walletSaved = true },
		"job sequence":      func(c *CityState, _ map[int32]BuildingSpec) { c.nextJobID = 1 },
		"remainder":         func(c *CityState, _ map[int32]BuildingSpec) { c.productionRemainder[3] = 1 },
		"catalog mismatch":  func(_ *CityState, cat map[int32]BuildingSpec) { cat[9] = BuildingSpec{ID: 8, BaseTimeSec: 1} },
		"negative production": func(_ *CityState, cat map[int32]BuildingSpec) {
			cat[9] = BuildingSpec{ID: 9, BaseTimeSec: 1, ProdPerHour: -1}
		},
		"negative resource": func(_ *CityState, cat map[int32]BuildingSpec) {
			cat[9] = BuildingSpec{ID: 9, BaseTimeSec: 1, ProdRes: -1}
		},
		"large time": func(_ *CityState, cat map[int32]BuildingSpec) { cat[9] = BuildingSpec{ID: 9, BaseTimeSec: 9223372037} },
	}
	for index := 0; index < 4; index++ {
		cases[fmt.Sprintf("wallet-%d", index)] = func(c *CityState, _ map[int32]BuildingSpec) {
			values := []*int64{&c.Wallet.Food, &c.Wallet.Wood, &c.Wallet.Stone, &c.Wallet.Iron}
			*values[index] = -1
		}
		cases[fmt.Sprintf("cost-%d", index)] = func(_ *CityState, cat map[int32]BuildingSpec) {
			spec := cat[7]
			values := []*int64{&spec.BaseCost.Food, &spec.BaseCost.Wood, &spec.BaseCost.Stone, &spec.BaseCost.Iron}
			*values[index] = -1
			cat[7] = spec
		}
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			city, catalog := freshFixture()
			mutate(city, catalog)
			before := *city
			before.Buildings = maps.Clone(city.Buildings)
			for slot, building := range before.Buildings {
				if building != nil {
					value := *building
					before.Buildings[slot] = &value
				}
			}
			beforeCatalog := maps.Clone(catalog)
			result, err := encodeFreshTemplate(city, catalog, FreshTemplateVersions{"a", "b", "c"})
			if err == nil || !reflect.DeepEqual(result, FreshTemplateContent{}) || !reflect.DeepEqual(&before, city) || !reflect.DeepEqual(beforeCatalog, catalog) {
				t.Fatal("invalid snapshot produced content or mutated input")
			}
		})
	}
	for _, count := range []int{1024, 1025} {
		city, catalog, versions := freshCodecInput("minimal-empty")
		for i := 1; i <= count; i++ {
			catalog[int32(i)] = BuildingSpec{ID: int32(i), BaseTimeSec: 1}
			city.Buildings[fmt.Sprint(i)] = &BuildingInstance{int32(i), 1}
		}
		_, err := encodeFreshTemplate(city, catalog, versions)
		if (err == nil) != (count == 1024) {
			t.Fatal("record count bound")
		}
		singleCatalog := map[int32]BuildingSpec{1: {ID: 1, BaseTimeSec: 1}}
		for _, building := range city.Buildings {
			building.CfgID = 1
		}
		_, err = encodeFreshTemplate(city, singleCatalog, versions)
		if (err == nil) != (count == 1024) {
			t.Fatal("building count bound")
		}
		city.Buildings = make(map[string]*BuildingInstance)
		_, err = encodeFreshTemplate(city, catalog, versions)
		if (err == nil) != (count == 1024) {
			t.Fatal("unused catalog count bound")
		}
	}
	city, catalog, versions := freshCodecInput("minimal-empty")
	for _, input := range []struct {
		city    *CityState
		catalog map[int32]BuildingSpec
	}{{nil, catalog}, {city, nil}} {
		result, err := encodeFreshTemplate(input.city, input.catalog, versions)
		if err == nil || !reflect.DeepEqual(result, FreshTemplateContent{}) {
			t.Fatal("nil input returned content")
		}
	}
}

func assertFreshCodecInvalid(t *testing.T, content FreshTemplateContent) {
	t.Helper()
	city, catalog, err := decodeFreshTemplate(content, 42)
	if err == nil || city != nil || catalog != nil || ValidateFreshTemplateContent(content) == nil {
		t.Fatal("invalid content returned usable data")
	}
	oracleCity, oracleCatalog, oracleErr := parseFreshCodecOracle(content, 42)
	if oracleErr == nil || oracleCity != nil || oracleCatalog != nil {
		t.Fatal("independent parser accepted hostile input")
	}
}

func TestFreshTemplateCodecAllTruncations(t *testing.T) {
	for _, v := range freshCodecVectors(t) {
		t.Run(v.Name, func(t *testing.T) {
			want := freshCodecContent(t, v)
			for cut := 0; cut < len(want.Bytes); cut++ {
				truncated := want
				truncated.Bytes = bytes.Clone(want.Bytes[:cut])
				truncated.SHA256 = sha256.Sum256(truncated.Bytes)
				assertFreshCodecInvalid(t, truncated)
			}
			trailing := want
			trailing.Bytes = append(bytes.Clone(want.Bytes), 0)
			trailing.SHA256 = sha256.Sum256(trailing.Bytes)
			assertFreshCodecInvalid(t, trailing)
		})
	}
}
