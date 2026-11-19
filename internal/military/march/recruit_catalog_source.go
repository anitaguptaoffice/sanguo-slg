package march

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// RecruitManifestDir is the reviewed release-source directory shipped in the repo.
const RecruitManifestDir = "spec/data/recruit_manifests"

// LoadRecruitCatalogDir loads the reviewed recruit manifests under dir and
// selects the current version. Selection is explicit: with exactly one reviewed
// manifest it becomes current; several manifests are an error rather than an
// implicit repricing, because version strings are content hashes, not an order.
func LoadRecruitCatalogDir(dir string) (*RecruitCatalog, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, ErrRecruitManifest
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		names = append(names, entry.Name())
	}
	sort.Strings(names)
	if len(names) != 1 {
		return nil, ErrRecruitManifest
	}
	raw, err := os.ReadFile(filepath.Join(dir, names[0]))
	if err != nil {
		return nil, ErrRecruitManifest
	}
	record, err := DecodeRecruitManifest(raw)
	if err != nil {
		return nil, err
	}
	return NewRecruitCatalog([]RecruitManifest{record}, record.Version)
}
