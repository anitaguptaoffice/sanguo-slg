package runtime

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

func writeMilRaw(t *testing.T, raw []byte) string {
	path := filepath.Join(t.TempDir(), "profile.json")
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func milDoc(t *testing.T, p freshsource.Profile) map[string]json.RawMessage {
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(milJSON(t, milFile(p)), &doc); err != nil {
		t.Fatal(err)
	}
	return doc
}

func milArray(size int, value string) json.RawMessage { return milArrayLast(size, value, value) }

func milArrayLast(size int, value, last string) json.RawMessage {
	parts := make([]string, size)
	for i := range parts {
		parts[i] = value
	}
	parts[size-1] = last
	return json.RawMessage("[" + strings.Join(parts, ",") + "]")
}

// TestMilitaryProfileExactEncoding proves the reviewed JSON representation is
// enforced before copying into fixed arrays: short (zero-filled), extra
// (truncated), string, base64, coerced, unknown and trailing forms all leave
// the durable handle disabled.
func TestMilitaryProfileExactEncoding(t *testing.T) {
	p := milProfile()
	pool, _ := milFixture(t)
	valid := milJSON(t, milFile(p))
	if _, _, err := loadMilitaryStartupProfile(valid); err != nil {
		t.Fatalf("baseline rejected: %v", err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	compose := func(t *testing.T, label string, raw []byte) {
		t.Helper()
		if _, _, err := loadMilitaryStartupProfile(raw); err == nil {
			t.Fatalf("%s: strict loader accepted malformed encoding", label)
		}
		if ComposeMilitary(context.Background(), log, pool, writeMilRaw(t, raw)) != nil {
			t.Fatalf("%s: malformed profile enabled the handle", label)
		}
	}
	for field, size := range map[string]int{"Cohort": 16, "ReleaseDigest": 32, "EvidenceDigest": 32} {
		encoded := base64.StdEncoding.EncodeToString(make([]byte, size))
		cases := map[string]json.RawMessage{
			"short":       milArray(size-1, "3"),
			"zero-filled": milArray(size/2, "3"),
			"extra":       milArray(size+1, "3"),
			"string":      json.RawMessage(`"3"`),
			"base64":      json.RawMessage(`"` + encoded + `"`),
			"coerced":     milArrayLast(size, "1", `"0"`),
			"null":        json.RawMessage(`null`),
		}
		for name, raw := range cases {
			doc := milDoc(t, p)
			doc[field] = raw
			rawDoc, err := json.Marshal(doc)
			if err != nil {
				t.Fatal(err)
			}
			compose(t, field+"/"+name, rawDoc)
		}
	}
	unknown := milDoc(t, p)
	unknown["unexpected"] = json.RawMessage(`1`)
	unknownDoc, err := json.Marshal(unknown)
	if err != nil {
		t.Fatal(err)
	}
	for name, raw := range map[string][]byte{
		"unknown-field": unknownDoc,
		"trailing-data": append(append([]byte{}, valid...), `{}`...),
	} {
		compose(t, name, raw)
	}
}
