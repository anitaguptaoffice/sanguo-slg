package content

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestEmbeddedCatalogMatchesItemsSeed(t *testing.T) {
	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	root := filepath.Join("..", "..")
	raw, err := os.ReadFile(filepath.Join(root, "spec/data/source/items.yml"))
	if err != nil {
		t.Fatal(err)
	}
	codes := regexp.MustCompile(`(?m)^\s+-\s+\{\s*(?:id:\s*\d+,\s*)?code:\s*([a-z0-9_]+)`).FindAllStringSubmatch(string(raw), -1)
	if len(codes) != len(cat.Items) {
		t.Fatalf("item count: seed %d catalog %d", len(codes), len(cat.Items))
	}
	byCode := make(map[string]int32, len(cat.Items))
	for id, def := range cat.Items {
		byCode[def.Code] = id
	}
	for _, m := range codes {
		if _, ok := byCode[m[1]]; !ok {
			t.Fatalf("missing seed code %q in catalog", m[1])
		}
	}
}

func TestLoadCatalogRejectsEmptyItems(t *testing.T) {
	_, err := LoadCatalog(strings.NewReader(`{"bag_max_distinct_items":10,"items":[]}`))
	if err == nil {
		t.Fatal("expected error for empty items")
	}
}
