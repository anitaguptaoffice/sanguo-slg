package domestic

import (
	"bytes"
	"crypto/sha256"
	"reflect"
	"testing"
)

func TestFreshTemplateCodecDataContract(t *testing.T) {
	initial := &CityState{PlayerID: 7, Buildings: map[string]*BuildingInstance{"hall": {1, 1}}}
	catalog := map[int32]BuildingSpec{1: {ID: 1, BaseTimeSec: 1}}
	versions := FreshTemplateVersions{"template", "rules", "catalog"}
	content, err := encodeFreshTemplate(initial, catalog, versions)
	if err != nil || ValidateFreshTemplateContent(content) != nil {
		t.Fatalf("valid template: %v", err)
	}
	retained := bytes.Clone(content.Bytes)
	initial.Buildings["hall"].Level = 9
	delete(catalog, 1)
	if !bytes.Equal(content.Bytes, retained) {
		t.Fatal("capture borrowed mutable inputs")
	}
	first, firstCatalog, err := decodeFreshTemplate(content, 10)
	if err != nil || first.PlayerID != 10 || first.Buildings["hall"].Level != 1 || len(firstCatalog) != 1 {
		t.Fatalf("restore data mismatch: %v", err)
	}
	second, secondCatalog, err := decodeFreshTemplate(content, 11)
	if err != nil {
		t.Fatal(err)
	}
	first.Buildings["hall"].Level = 5
	delete(firstCatalog, 1)
	content.Bytes[0] ^= 1
	if second.PlayerID != 11 || second.Buildings["hall"].Level != 1 || len(secondCatalog) != 1 {
		t.Fatal("decoded results alias retained/input/output data")
	}
	initial.ID = 1
	result, err := encodeFreshTemplate(initial, secondCatalog, versions)
	if err == nil || !reflect.DeepEqual(result, FreshTemplateContent{}) {
		t.Fatal("nonfresh state returned content")
	}
}

func TestFreshTemplateCodecFailsClosed(t *testing.T) {
	city := &CityState{PlayerID: 1, Buildings: make(map[string]*BuildingInstance)}
	content, err := encodeFreshTemplate(city, map[int32]BuildingSpec{}, FreshTemplateVersions{"a", "b", "c"})
	if err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*FreshTemplateContent){
		func(c *FreshTemplateContent) { c.Bytes = nil },
		func(c *FreshTemplateContent) { c.SHA256[0] ^= 1 },
		func(c *FreshTemplateContent) { c.Versions.RulesVersion = "other" },
		func(c *FreshTemplateContent) {
			c.Bytes = bytes.Clone(c.Bytes)
			c.Bytes[9] = 2
			c.SHA256 = sha256.Sum256(c.Bytes)
		},
	} {
		invalid := content
		mutate(&invalid)
		decoded, catalog, err := decodeFreshTemplate(invalid, 1)
		if err == nil || decoded != nil || catalog != nil || ValidateFreshTemplateContent(invalid) == nil {
			t.Fatal("malformed data returned a usable snapshot")
		}
	}
	for _, player := range []int64{0, -1} {
		decoded, catalog, err := decodeFreshTemplate(content, player)
		if err == nil || decoded != nil || catalog != nil {
			t.Fatal("invalid actor returned a snapshot")
		}
	}
}
