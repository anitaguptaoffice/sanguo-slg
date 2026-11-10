package domestic

import (
	"crypto/sha256"
	"reflect"
	"testing"
)

func FuzzFreshTemplateCodec(f *testing.F) {
	for _, name := range []string{"minimal-empty", "current-default", "int64-max", "unicode-32"} {
		city, catalog, versions := freshCodecInput(name)
		content, err := encodeFreshTemplate(city, catalog, versions)
		if err != nil {
			f.Fatal(err)
		}
		f.Add(content.Bytes)
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		// Parse candidate embedded labels independently, even if malformed. This
		// exercises framing after recomputing SHA rather than rejecting every edit
		// solely because it differs from a seed's reference metadata.
		var labels [3]string
		offset := 10
		for i := range labels {
			if offset >= len(data) {
				break
			}
			n := int(data[offset])
			offset++
			if n > len(data)-offset {
				break
			}
			labels[i] = string(data[offset : offset+n])
			offset += n
		}
		content := FreshTemplateContent{FreshTemplateVersions{labels[0], labels[1], labels[2]}, 1, sha256.Sum256(data), data}
		city, catalog, err := decodeFreshTemplate(content, 42)
		oracleCity, oracleCatalog, oracleErr := parseFreshCodecOracle(content, 42)
		if (err == nil) != (oracleErr == nil) || !reflect.DeepEqual(city, oracleCity) || !reflect.DeepEqual(catalog, oracleCatalog) {
			t.Fatal("production and independent parser disagree")
		}
		if err != nil {
			if city != nil || catalog != nil || ValidateFreshTemplateContent(content) == nil {
				t.Fatal("invalid fuzz case returned usable data")
			}
			return
		}
		again, err := encodeFreshTemplate(city, catalog, content.Versions)
		if err != nil || !reflect.DeepEqual(again, content) || ValidateFreshTemplateContent(content) != nil {
			t.Fatal("successful decode lost canonical data")
		}
	})
}
