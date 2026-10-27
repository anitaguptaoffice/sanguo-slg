package march

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"math"
	"time"
	"unicode/utf8"
)

var errRecruitPayload = errors.New("march: invalid recruit payload")

// Private wire value, not queue identity, authorization or trusted source proof.
// Never persist a caller-built value: use encodeRecruitPayload's checked producer.
type recruitPayload struct {
	Version int                `json:"v"`
	Unit    int32              `json:"unit_cfg_id"`
	Count   int32              `json:"count"`
	Cost    recruitPayloadCost `json:"cost_paid"`
	Seconds int64              `json:"duration_sec"`
	Catalog string             `json:"catalog_version"`
	Digest  string             `json:"rule_digest"`
}

type recruitPayloadCost struct {
	Food  int64 `json:"food"`
	Wood  int64 `json:"wood"`
	Iron  int64 `json:"iron"`
	Stone int64 `json:"stone"`
}

// Evidence must ultimately come from the participant's captured reviewed catalog.
// This pure producer does not grant authority to use an arbitrary caller catalog.
func encodeRecruitPayload(evidence RecruitRuleEvidence, req RecruitRequest) ([]byte, error) {
	plan, err := evidence.Plan(req)
	if err != nil {
		return nil, errRecruitPayload
	}
	cost := plan.Cost()
	digest := evidence.Digest()
	value := recruitPayload{Version: 1, Unit: req.UnitCfgID, Count: req.Count,
		Cost:    recruitPayloadCost{cost.Food, cost.Wood, cost.Iron, cost.Stone},
		Seconds: plan.DurationSeconds(), Catalog: evidence.Version(), Digest: hex.EncodeToString(digest[:])}
	return json.Marshal(value)
}

func (p recruitPayload) validate(catalog *RecruitCatalog) error {
	if p.Version != 1 || p.Count <= 0 || len(p.Digest) != 64 {
		return errRecruitPayload
	}
	decoded, err := hex.DecodeString(p.Digest)
	if err != nil || hex.EncodeToString(decoded) != p.Digest {
		return errRecruitPayload
	}
	var digest [32]byte
	copy(digest[:], decoded)
	evidence, err := catalog.Resolve(p.Catalog, p.Unit, digest)
	if err != nil {
		return errRecruitPayload
	}
	plan, err := evidence.Plan(RecruitRequest{UnitCfgID: p.Unit, Count: p.Count})
	if err != nil {
		return errRecruitPayload
	}
	cost := plan.Cost()
	if p.Seconds != plan.DurationSeconds() || p.Cost != (recruitPayloadCost{cost.Food, cost.Wood, cost.Iron, cost.Stone}) {
		return errRecruitPayload
	}
	return nil
}

// decodeRecruitPayload checks original JSON before normalization. JSONB cannot
// recover erased duplicate keys. Catalog resolution never falls back to current.
// Valid payload is NOT proof of its linked origin/receipt, owner or queue state.
func decodeRecruitPayload(raw []byte, catalog *RecruitCatalog) (recruitPayload, error) {
	var out recruitPayload
	if len(raw) > 65536 || !utf8.Valid(raw) {
		return out, errRecruitPayload
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	err := recruitManifestObject(d, map[string]func() error{
		"v":           func() error { n, e := recruitManifestInteger(d, 1, 1); out.Version = int(n); return e },
		"unit_cfg_id": func() error { n, e := recruitManifestInteger(d, 1, 4); out.Unit = int32(n); return e },
		"count":       func() error { n, e := recruitManifestInteger(d, 1, math.MaxInt32); out.Count = int32(n); return e },
		"duration_sec": func() error {
			n, e := recruitManifestInteger(d, 1, math.MaxInt64/int64(time.Second))
			out.Seconds = n
			return e
		},
		"catalog_version": func() error { return recruitPayloadString(d, &out.Catalog) },
		"rule_digest":     func() error { return recruitPayloadString(d, &out.Digest) },
		"cost_paid": func() error {
			fields := make(map[string]func() error, 4)
			for key, target := range map[string]*int64{"food": &out.Cost.Food, "wood": &out.Cost.Wood, "iron": &out.Cost.Iron, "stone": &out.Cost.Stone} {
				fields[key] = func() error { n, e := recruitManifestInteger(d, 0, math.MaxInt64); *target = n; return e }
			}
			return recruitManifestObject(d, fields)
		},
	})
	if err != nil {
		return recruitPayload{}, errRecruitPayload
	}
	if _, err = d.Token(); err != io.EOF {
		return recruitPayload{}, errRecruitPayload
	}
	if out.validate(catalog) != nil {
		return recruitPayload{}, errRecruitPayload
	}
	return out, nil
}

func recruitPayloadString(d *json.Decoder, target *string) error {
	token, err := d.Token()
	value, ok := token.(string)
	if err != nil || !ok {
		return errRecruitPayload
	}
	*target = value
	return nil
}
