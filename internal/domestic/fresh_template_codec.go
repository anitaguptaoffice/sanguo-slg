package domestic

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"sort"
)

const (
	freshTemplateMagic      = "SGFCTPL\x00"
	freshTemplateMinBytes   = 52
	freshTemplateMaxBytes   = 262144
	freshTemplateMaxRecords = 1024
)

var errFreshTemplateContent = errors.New("domestic: invalid fresh template content")

// FreshTemplateVersions identifies data, not supported semantics or provenance.
type FreshTemplateVersions struct {
	TemplateVersion string
	RulesVersion    string
	CatalogVersion  string
}

// FreshTemplateContent is a defensive data snapshot, never an execution proof.
type FreshTemplateContent struct {
	Versions        FreshTemplateVersions
	EncodingVersion uint32
	SHA256          [32]byte
	Bytes           []byte
}

// ValidateFreshTemplateContent checks FCT1 only. APP must separately match its
// retained semantic manifest and full bytes, including on terminal-history reads.
// No Hub, current catalog, actor authentication, locks or SQL participate here.
func ValidateFreshTemplateContent(content FreshTemplateContent) error {
	_, _, err := decodeFreshTemplate(content, 1)
	return err
}

func freshTemplateLabels(v FreshTemplateVersions) [3]string {
	return [3]string{v.TemplateVersion, v.RulesVersion, v.CatalogVersion}
}

func freshTemplateVersionsValid(v FreshTemplateVersions) bool {
	for _, s := range freshTemplateLabels(v) {
		if len(s) < 1 || len(s) > 64 {
			return false
		}
		for _, c := range []byte(s) {
			if !(c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '.' || c == '_' || c == '-') {
				return false
			}
		}
	}
	return true
}

func appendFreshResources(out []byte, r Resources) []byte {
	for _, n := range [4]int64{r.Food, r.Wood, r.Stone, r.Iron} {
		out = binary.BigEndian.AppendUint64(out, uint64(n))
	}
	return out
}

// encodeFreshTemplate is private: future CaptureTemplate supplies only the
// constructor-captured catalog. Input mutation during this call is unsupported.
func encodeFreshTemplate(initial *CityState, catalog map[int32]BuildingSpec, versions FreshTemplateVersions) (FreshTemplateContent, error) {
	if initial == nil || len(initial.Buildings) > freshTemplateMaxRecords || len(catalog) > freshTemplateMaxRecords || !freshTemplateVersionsValid(versions) {
		return FreshTemplateContent{}, errFreshTemplateContent
	}
	city, catalog, err := snapshotFreshTemplate(initial, catalog)
	if err != nil {
		return FreshTemplateContent{}, err
	}
	out := binary.BigEndian.AppendUint16([]byte(freshTemplateMagic), 1)
	for _, label := range freshTemplateLabels(versions) {
		out = append(out, byte(len(label)))
		out = append(out, label...)
	}
	out = appendFreshResources(out, city.Wallet)
	slots := make([]string, 0, len(city.Buildings))
	for slot := range city.Buildings {
		slots = append(slots, slot)
	}
	sort.Strings(slots)
	out = binary.BigEndian.AppendUint16(out, uint16(len(slots)))
	for _, slot := range slots {
		building := city.Buildings[slot]
		out = append(out, byte(len(slot)))
		out = append(out, slot...)
		out = binary.BigEndian.AppendUint32(out, uint32(building.CfgID))
		out = binary.BigEndian.AppendUint32(out, uint32(building.Level))
	}
	ids := make([]int32, 0, len(catalog))
	for id := range catalog {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	out = binary.BigEndian.AppendUint16(out, uint16(len(ids)))
	for _, id := range ids {
		spec := catalog[id]
		out = binary.BigEndian.AppendUint32(out, uint32(id))
		out = binary.BigEndian.AppendUint64(out, uint64(spec.BaseTimeSec))
		out = appendFreshResources(out, spec.BaseCost)
		out = binary.BigEndian.AppendUint64(out, uint64(spec.ProdPerHour))
		out = append(out, byte(spec.ProdRes))
	}
	return FreshTemplateContent{versions, 1, sha256.Sum256(out), out}, nil
}

// This reader bounds variable spans/counts before allocation; signed values are
// read at their actual width and validated before encoding any unsigned value.
type freshTemplateReader struct {
	*bytes.Reader
	err error
}

func (r *freshTemplateReader) read(value any) {
	if r.err == nil {
		r.err = binary.Read(r.Reader, binary.BigEndian, value)
	}
}

func (r *freshTemplateReader) text(maxBytes uint8) string {
	var n uint8
	r.read(&n)
	if r.err != nil || n == 0 || n > maxBytes || int(n) > r.Len() {
		r.err = errFreshTemplateContent
		return ""
	}
	value := make([]byte, int(n))
	r.read(value)
	return string(value)
}

func (r *freshTemplateReader) count(recordBytes int) int {
	var n uint16
	r.read(&n)
	if r.err != nil || n > freshTemplateMaxRecords || int(n)*recordBytes > r.Len() {
		r.err = errFreshTemplateContent
		return 0
	}
	return int(n)
}

func (r *freshTemplateReader) resources() Resources {
	var values [4]int64
	r.read(&values)
	return Resources{values[0], values[1], values[2], values[3]}
}

// decodeFreshTemplate creates isolated data only. Future RestoreTemplate must
// additionally require equality to its immutable constructor-captured catalog.
func decodeFreshTemplate(content FreshTemplateContent, playerID int64) (*CityState, map[int32]BuildingSpec, error) {
	if playerID <= 0 || len(content.Bytes) < freshTemplateMinBytes || len(content.Bytes) > freshTemplateMaxBytes ||
		content.EncodingVersion != 1 || !freshTemplateVersionsValid(content.Versions) {
		return nil, nil, errFreshTemplateContent
	}
	owned := bytes.Clone(content.Bytes)
	if !bytes.Equal(owned[:8], []byte(freshTemplateMagic)) || binary.BigEndian.Uint16(owned[8:10]) != 1 || sha256.Sum256(owned) != content.SHA256 {
		return nil, nil, errFreshTemplateContent
	}
	r := &freshTemplateReader{Reader: bytes.NewReader(owned[10:])}
	versions := FreshTemplateVersions{r.text(64), r.text(64), r.text(64)}
	if r.err != nil || versions != content.Versions {
		return nil, nil, errFreshTemplateContent
	}
	city := &CityState{PlayerID: playerID, Wallet: r.resources()}
	n := r.count(10)
	city.Buildings = make(map[string]*BuildingInstance, n)
	previousSlot := ""
	for i := 0; i < n; i++ {
		slot := r.text(128)
		var values [2]int32
		r.read(&values)
		if r.err != nil || slot <= previousSlot {
			return nil, nil, errFreshTemplateContent
		}
		city.Buildings[slot] = &BuildingInstance{values[0], values[1]}
		previousSlot = slot
	}
	n = r.count(53)
	catalog := make(map[int32]BuildingSpec, n)
	var previousID int32
	for i := 0; i < n; i++ {
		var id int32
		var duration, rate int64
		var resource uint8
		r.read(&id)
		r.read(&duration)
		cost := r.resources()
		r.read(&rate)
		r.read(&resource)
		if r.err != nil || id <= previousID || resource > 3 {
			return nil, nil, errFreshTemplateContent
		}
		catalog[id] = BuildingSpec{id, duration, cost, rate, int8(resource)}
		previousID = id
	}
	if r.err != nil || r.Len() != 0 {
		return nil, nil, errFreshTemplateContent
	}
	canonical, err := encodeFreshTemplate(city, catalog, versions)
	if err != nil || !bytes.Equal(canonical.Bytes, owned) {
		return nil, nil, errFreshTemplateContent
	}
	return city, catalog, nil
}
