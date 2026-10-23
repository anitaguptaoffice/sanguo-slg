package content

import (
	"bytes"
	_ "embed"
)

//go:embed seed/catalog.json
var embeddedCatalogJSON []byte

// EmbeddedCatalog loads the compile-time embedded seed catalog.
func EmbeddedCatalog() (*Catalog, error) {
	return LoadCatalog(bytes.NewReader(embeddedCatalogJSON))
}
