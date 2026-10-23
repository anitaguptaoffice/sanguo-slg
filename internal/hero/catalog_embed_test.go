package hero

import "testing"

func TestEmbeddedCatalogMatchesDATA002FirstHero(t *testing.T) {
	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	tpl := cat[1001]
	if tpl.Name != "玄德府君" || tpl.Code != "xuan_de_lord" {
		t.Fatalf("tpl %+v", tpl)
	}
	if len(cat) < 20 {
		t.Fatalf("expected expanded catalog, got %d", len(cat))
	}
}
