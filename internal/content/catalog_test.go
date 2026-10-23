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
	codes := regexp.MustCompile(`(?m)^\s+-\s+\{\s*code:\s*([a-z0-9_]+)`).FindAllStringSubmatch(string(raw), -1)
	if len(codes) != len(cat.Items) {
		t.Fatalf("item count: seed %d catalog %d", len(codes), len(cat.Items))
	}
	for i, m := range codes {
		id := int32(2001 + i)
		def, ok := cat.Items[id]
		if !ok {
			t.Fatalf("missing id %d", id)
		}
		if def.Code != m[1] {
			t.Fatalf("id %d code %q seed %q", id, def.Code, m[1])
		}
	}
}

func TestLoadCatalogRejectsEmptyItems(t *testing.T) {
	_, err := LoadCatalog(strings.NewReader(`{"bag_max_distinct_items":10,"items":[]}`))
	if err == nil {
		t.Fatal("expected error for empty items")
	}
}
