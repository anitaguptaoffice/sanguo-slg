package domestic

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"os"
	"reflect"
	"strings"
	"testing"
)

type freshCodecVector struct {
	Name      string
	Length    int
	SHA256    string
	HexChunks []string `json:"hex_chunks"`
}

func freshCodecVectors(t *testing.T) []freshCodecVector {
	t.Helper()
	data, err := os.ReadFile("../../spec/rules/fixtures/fresh_city_template_codec_v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct{ Vectors []freshCodecVector }
	if err := json.Unmarshal(data, &fixture); err != nil || len(fixture.Vectors) != 4 {
		t.Fatalf("invalid literal fixture: %v", err)
	}
	return fixture.Vectors
}

func freshCodecInput(name string) (*CityState, map[int32]BuildingSpec, FreshTemplateVersions) {
	city := &CityState{PlayerID: 42, Buildings: make(map[string]*BuildingInstance)}
	catalog := make(map[int32]BuildingSpec)
	versions := FreshTemplateVersions{"a", "b", "c"}
	switch name {
	case "current-default":
		city.Wallet = Resources{8000, 8000, 5000, 5000}
		city.Buildings = map[string]*BuildingInstance{"farm": {2, 1}, "hall": {1, 1}}
		catalog = map[int32]BuildingSpec{
			1: {1, 60, Resources{200, 200, 100, 50}, 0, 0},
			2: {2, 45, Resources{50, 150, 30, 0}, 120, 0},
			3: {3, 45, Resources{50, 100, 50, 0}, 100, 1},
			4: {4, 50, Resources{80, 80, 100, 0}, 80, 2},
			5: {5, 55, Resources{100, 80, 80, 50}, 60, 3},
			6: {6, 90, Resources{150, 200, 150, 100}, 0, 0},
			7: {7, 120, Resources{100, 100, 300, 150}, 0, 0},
		}
		versions = FreshTemplateVersions{"dom-first-city-1", "first-city-rules-1", "dom-default-1"}
	case "int64-max":
		versions = FreshTemplateVersions{"x", "y", "z"}
		city.Wallet = Resources{math.MaxInt64, math.MaxInt64, math.MaxInt64, math.MaxInt64}
		city.Buildings["x"] = &BuildingInstance{math.MaxInt32, math.MaxInt32}
		catalog[math.MaxInt32] = BuildingSpec{math.MaxInt32, 9223372036, city.Wallet, math.MaxInt64, 3}
	case "unicode-32":
		versions = FreshTemplateVersions{"u", "u", "u"}
		city.Buildings[strings.Repeat("😀", 32)] = &BuildingInstance{1, 1}
		catalog[1] = BuildingSpec{ID: 1, BaseTimeSec: 1, ProdRes: 3}
	}
	return city, catalog, versions
}

func freshCodecContent(t *testing.T, v freshCodecVector) FreshTemplateContent {
	t.Helper()
	data, err := hex.DecodeString(strings.Join(v.HexChunks, ""))
	if err != nil || len(data) != v.Length || fmt.Sprintf("%x", sha256.Sum256(data)) != v.SHA256 {
		t.Fatalf("literal vector %s changed: %v", v.Name, err)
	}
	_, _, versions := freshCodecInput(v.Name)
	return FreshTemplateContent{versions, 1, sha256.Sum256(data), data}
}

func TestFreshTemplateCodecGolden(t *testing.T) {
	for _, v := range freshCodecVectors(t) {
		t.Run(v.Name, func(t *testing.T) {
			want := freshCodecContent(t, v)
			city, catalog, versions := freshCodecInput(v.Name)
			got, err := encodeFreshTemplate(city, catalog, versions)
			if err != nil || !reflect.DeepEqual(got, want) {
				t.Fatalf("literal encode mismatch: %v", err)
			}
			decoded, decodedCatalog, err := decodeFreshTemplate(want, city.PlayerID)
			if err != nil || !reflect.DeepEqual(decoded, city) || !reflect.DeepEqual(decodedCatalog, catalog) {
				t.Fatalf("typed decode mismatch: %v", err)
			}
			oracleCity, oracleCatalog, oracleErr := parseFreshCodecOracle(want, city.PlayerID)
			if oracleErr != nil || !reflect.DeepEqual(oracleCity, city) || !reflect.DeepEqual(oracleCatalog, catalog) {
				t.Fatalf("independent parser mismatch: %v", oracleErr)
			}
			if err := ValidateFreshTemplateContent(want); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestFreshTemplateCodecMaximumAndIsolation(t *testing.T) {
	city, catalog, _ := freshCodecInput("minimal-empty")
	versions := FreshTemplateVersions{strings.Repeat("A", 64), strings.Repeat("b", 64), strings.Repeat("9", 64)}
	for i := 1; i <= 1024; i++ {
		slot := strings.Repeat("😀", 31) + string(rune(0x10000+i))
		city.Buildings[slot] = &BuildingInstance{int32(i), math.MaxInt32}
		catalog[int32(i)] = BuildingSpec{int32(i), 9223372036, Resources{math.MaxInt64, 0, 0, 0}, math.MaxInt64, 3}
	}
	content, err := encodeFreshTemplate(city, catalog, versions)
	if err != nil || len(content.Bytes) != 194801 {
		t.Fatalf("exact maximum: %d, %v", len(content.Bytes), err)
	}
	first, firstCatalog, err := decodeFreshTemplate(content, 7)
	if err != nil || first.PlayerID != 7 || !reflect.DeepEqual(first.Buildings, city.Buildings) || !reflect.DeepEqual(firstCatalog, catalog) {
		t.Fatalf("maximum did not roundtrip: %v", err)
	}
	oracleCity, oracleCatalog, oracleErr := parseFreshCodecOracle(content, 7)
	if oracleErr != nil || !reflect.DeepEqual(oracleCity, first) || !reflect.DeepEqual(oracleCatalog, firstCatalog) {
		t.Fatalf("maximum independent parser mismatch: %v", oracleErr)
	}
	second, secondCatalog, err := decodeFreshTemplate(content, 9)
	if err != nil || second.PlayerID != 9 || second.ID != 0 || second.BuildJobs != nil || !second.LastSettleAt.IsZero() {
		t.Fatalf("fixed values/actor: %v", err)
	}
	for _, invalidPlayer := range []int64{0, -1, math.MinInt64} {
		c, cat, err := decodeFreshTemplate(content, invalidPlayer)
		if err == nil || c != nil || cat != nil {
			t.Fatal("invalid player returned data")
		}
	}
	slot := strings.Repeat("😀", 31) + string(rune(0x10001))
	city.Buildings[slot].Level = 2
	delete(catalog, 1)
	first.Buildings[slot].Level = 3
	delete(firstCatalog, 2)
	content.Bytes[0] ^= 255
	if second.Buildings[slot].Level != math.MaxInt32 || len(secondCatalog) != 1024 || len(firstCatalog) != 1023 {
		t.Fatal("mutable template results aliased")
	}
}

func TestFreshTemplateCodecCanonicalRoundtrip(t *testing.T) {
	rng := rand.New(rand.NewSource(2440))
	slots := []string{"é", "e\u0301", "\ufffd", " ", "a", "Z", "😀"}
	for iteration := 0; iteration < 200; iteration++ {
		city, catalog, versions := freshCodecInput("minimal-empty")
		for _, index := range rng.Perm(len(slots)) {
			id := int32(index + 1)
			city.Buildings[slots[index]] = &BuildingInstance{id, rng.Int31n(math.MaxInt32) + 1}
			catalog[id] = BuildingSpec{id, 1 + rng.Int63n(9223372036), Resources{rng.Int63(), rng.Int63(), rng.Int63(), rng.Int63()}, rng.Int63(), int8(index % 4)}
		}
		catalog[99] = BuildingSpec{ID: 99, BaseTimeSec: 1, ProdRes: 3}
		city.Wallet = Resources{rng.Int63(), rng.Int63(), rng.Int63(), rng.Int63()}
		content, err := encodeFreshTemplate(city, catalog, versions)
		if err != nil {
			t.Fatal(err)
		}
		decoded, decodedCatalog, err := decodeFreshTemplate(content, city.PlayerID)
		if err != nil || !reflect.DeepEqual(decoded, city) || !reflect.DeepEqual(decodedCatalog, catalog) {
			t.Fatalf("roundtrip %d: %v", iteration, err)
		}
		city.PlayerID = 99
		city.BuildJobs = make([]*BuildJob, 0, 4)
		again, err := encodeFreshTemplate(city, catalog, versions)
		if err != nil || !reflect.DeepEqual(again, content) {
			t.Fatal("actor/nil-versus-empty jobs changed canonical content")
		}
		reversed := make(map[string]*BuildingInstance)
		for index := len(slots) - 1; index >= 0; index-- {
			reversed[slots[index]] = city.Buildings[slots[index]]
		}
		city.Buildings = reversed
		again, err = encodeFreshTemplate(city, catalog, versions)
		if err != nil || !reflect.DeepEqual(again, content) {
			t.Fatal("insertion order changed canonical content")
		}
	}
}

func TestFreshTemplateCodecDoesNotSelectSemantics(t *testing.T) {
	city, catalog, _ := freshCodecInput("minimal-empty")
	content, err := encodeFreshTemplate(city, catalog, FreshTemplateVersions{"unknown", "R2", "C2"})
	if err != nil || ValidateFreshTemplateContent(content) != nil {
		t.Fatal("pure grammar validation acquired manifest/catalog coupling")
	}
	// Acceptance here grants no semantic support. APP must reject an unknown tuple
	// or full-byte mismatch against its independently retained immutable manifest.
}
