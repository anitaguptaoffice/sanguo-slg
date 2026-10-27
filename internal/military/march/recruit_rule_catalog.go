package march

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"math"
	"time"
)

var (
	ErrRecruitManifest = errors.New("march: invalid recruit manifest")
	ErrRecruitEvidence = errors.New("march: recruit rule evidence unavailable")
)

// RecruitRule contains recruit fields only, never march/combat configuration.
type RecruitRule struct {
	UnitCfgID      int32
	Cost           Resources
	SecondsPerUnit int64
}

type RecruitManifest struct {
	Version string
	Rules   [4]RecruitRule
}

// RecruitCatalog is a copied immutable snapshot, NOT proof of source authority.
// Only reviewed server release inputs may construct a production snapshot.
type RecruitCatalog struct {
	manifests map[string][4]RecruitRule
	current   string
}

type RecruitRuleEvidence struct {
	version string
	digest  [32]byte
	rule    RecruitRule
	valid   bool
}

func recruitRuleBytes(rule RecruitRule) ([67]byte, error) {
	var out [67]byte
	cost := rule.Cost
	if rule.UnitCfgID < 1 || rule.UnitCfgID > 4 || cost.Food < 0 || cost.Wood < 0 ||
		cost.Iron < 0 || cost.Stone < 0 || rule.SecondsPerUnit <= 0 ||
		rule.SecondsPerUnit > math.MaxInt64/int64(time.Second) {
		return out, ErrRecruitManifest
	}
	copy(out[:], "sanguo/recruit-rule/v1\x00")
	binary.BigEndian.PutUint32(out[23:27], uint32(rule.UnitCfgID))
	for i, value := range [...]int64{cost.Food, cost.Wood, cost.Iron, cost.Stone, rule.SecondsPerUnit} {
		binary.BigEndian.PutUint64(out[27+8*i:35+8*i], uint64(value))
	}
	return out, nil
}

// RecruitManifestVersion computes public integrity, not artifact approval.
func RecruitManifestVersion(rules [4]RecruitRule) (string, error) {
	var out [295]byte
	copy(out[:], "sanguo/recruit-manifest/v1\x00")
	for i, rule := range rules {
		if rule.UnitCfgID != int32(i+1) {
			return "", ErrRecruitManifest
		}
		encoded, err := recruitRuleBytes(rule)
		if err != nil {
			return "", err
		}
		copy(out[27+67*i:], encoded[:])
	}
	digest := sha256.Sum256(out[:])
	return "recruit-v1:" + hex.EncodeToString(digest[:]), nil
}

func NewRecruitCatalog(records []RecruitManifest, currentVersion string) (*RecruitCatalog, error) {
	if len(records) == 0 || currentVersion == "" {
		return nil, ErrRecruitManifest
	}
	catalog := &RecruitCatalog{manifests: make(map[string][4]RecruitRule, len(records)), current: currentVersion}
	for _, record := range records {
		version, err := RecruitManifestVersion(record.Rules)
		if err != nil || version != record.Version {
			return nil, ErrRecruitManifest
		}
		if _, duplicate := catalog.manifests[version]; duplicate {
			return nil, ErrRecruitManifest
		}
		catalog.manifests[version] = record.Rules
	}
	if _, found := catalog.manifests[currentVersion]; !found {
		return nil, ErrRecruitManifest
	}
	return catalog, nil
}

func (c *RecruitCatalog) evidence(version string, unitID int32) (RecruitRuleEvidence, error) {
	if c == nil || unitID < 1 || unitID > 4 {
		return RecruitRuleEvidence{}, ErrRecruitEvidence
	}
	rules, found := c.manifests[version]
	if !found {
		return RecruitRuleEvidence{}, ErrRecruitEvidence
	}
	rule := rules[unitID-1]
	encoded, err := recruitRuleBytes(rule)
	if err != nil {
		return RecruitRuleEvidence{}, ErrRecruitEvidence
	}
	return RecruitRuleEvidence{version: version, digest: sha256.Sum256(encoded[:]), rule: rule, valid: true}, nil
}

func (c *RecruitCatalog) Current(unitID int32) (RecruitRuleEvidence, error) {
	if c == nil {
		return RecruitRuleEvidence{}, ErrRecruitEvidence
	}
	return c.evidence(c.current, unitID)
}

func (c *RecruitCatalog) Resolve(version string, unitID int32, digest [32]byte) (RecruitRuleEvidence, error) {
	evidence, err := c.evidence(version, unitID)
	if err != nil || evidence.digest != digest {
		return RecruitRuleEvidence{}, ErrRecruitEvidence
	}
	return evidence, nil
}

func (e RecruitRuleEvidence) Version() string   { return e.version }
func (e RecruitRuleEvidence) Digest() [32]byte  { return e.digest }
func (e RecruitRuleEvidence) Rule() RecruitRule { return e.rule }

// Plan is checked arithmetic only. Participants resolve via their captured
// trusted catalog; caller-supplied evidence never grants mutation authority.
func (e RecruitRuleEvidence) Plan(req RecruitRequest) (RecruitPlan, error) {
	if !e.valid || req.UnitCfgID != e.rule.UnitCfgID {
		return RecruitPlan{}, ErrRecruitEvidence
	}
	spec := UnitSpec{UnitCfgID: e.rule.UnitCfgID, RecruitCost: e.rule.Cost, SecPerUnit: e.rule.SecondsPerUnit}
	return PlanRecruit(map[int32]UnitSpec{spec.UnitCfgID: spec}, req)
}
