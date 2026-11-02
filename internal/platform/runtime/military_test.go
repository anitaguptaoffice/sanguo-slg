package runtime

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"maps"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

var militaryObjects = []string{"mil_city_origin", "city_troop", "work_queue", "mil_recruit_origin", "mil_recruit_receipt", "mil_city_origin_pkey", "city_troop_pkey", "work_queue_pkey", "idx_work_queue_due", "idx_work_queue_player", "mil_recruit_origin_pkey", "mil_recruit_receipt_pkey", "mil_recruit_origin_server_id_player_id_operation_command_id_key", "work_queue_id_seq"}

const milManifest = `{"format":1,"version":"recruit-v1:04e051a2667d4cfe7a7f9e4af8bf24728c786a4fbd4c7e3f0d81f64b6e45c0e4","rules":[{"unit_cfg_id":1,"seconds_per_unit":1,"cost_per_unit":{"food":1,"wood":0,"iron":0,"stone":0}},{"unit_cfg_id":2,"seconds_per_unit":1,"cost_per_unit":{"food":1,"wood":0,"iron":0,"stone":0}},{"unit_cfg_id":3,"seconds_per_unit":1,"cost_per_unit":{"food":1,"wood":0,"iron":0,"stone":0}},{"unit_cfg_id":4,"seconds_per_unit":1,"cost_per_unit":{"food":1,"wood":0,"iron":0,"stone":0}}]}`

func milProfile() freshsource.Profile {
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "test-cluster", EvidenceRef: "test-evidence", DatabaseName: "test_db", SchemaName: "test_schema", CurrentRoleName: "test_role", SessionRoleName: "test_role", DatabaseOID: 10, SchemaOID: 11, SchemaOwnerOID: 12, CurrentRoleOID: 13, SessionRoleOID: 14, ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	for i, name := range militaryObjects {
		p.Objects[name] = freshsource.ObjectIdentity{OID: uint32(i + 1), OwnerOID: uint32(i + 100)}
	}
	return p
}

func milFile(p freshsource.Profile) militaryStartupProfile {
	p.Objects = maps.Clone(p.Objects)
	return militaryStartupProfile{Profile: p, Format: militaryStartupFormat, Manifests: []json.RawMessage{json.RawMessage(milManifest)}, CurrentManifest: "recruit-v1:04e051a2667d4cfe7a7f9e4af8bf24728c786a4fbd4c7e3f0d81f64b6e45c0e4"}
}

func milJSON(t *testing.T, f militaryStartupProfile) []byte {
	t.Helper()
	raw, err := json.Marshal(f)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// TestMilitaryStartupProfile covers the minimal enabled/disabled and document
// shape contract; exact array-length and coercion evidence lives in #1964.
func TestMilitaryStartupProfile(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	for _, path := range []string{"", filepath.Join(t.TempDir(), "absent.json")} {
		if ComposeMilitary(context.Background(), log, nil, path) != nil {
			t.Fatalf("%q: disabled path enabled", path)
		}
	}
	p := milProfile()
	if got, catalog, err := loadMilitaryStartupProfile(milJSON(t, milFile(p))); err != nil || catalog == nil || !reflect.DeepEqual(got, p) {
		t.Fatalf("valid profile rejected: %v", err)
	}
	f := milFile(p)
	f.Format = 2
	if _, _, err := loadMilitaryStartupProfile(milJSON(t, f)); err == nil {
		t.Fatal("accepted wrong format")
	}
	good := string(milJSON(t, milFile(p)))
	for _, raw := range []string{good[:len(good)-1] + `,"unexpected":1}`, good + `{}`} {
		if _, _, err := loadMilitaryStartupProfile([]byte(raw)); err == nil {
			t.Fatal("accepted malformed document")
		}
	}
}
