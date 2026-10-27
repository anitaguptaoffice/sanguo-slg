package march

import (
	"bytes"
	"encoding/json"
	"io"
	"math"
	"strconv"
	"time"
	"unicode/utf8"
)

// DecodeRecruitManifest checks original JSON integrity, never source authority.
// No path/URL loading or current-version selection is performed here.
func DecodeRecruitManifest(raw []byte) (RecruitManifest, error) {
	var out RecruitManifest
	if len(raw) > 65536 || !utf8.Valid(raw) {
		return out, ErrRecruitManifest
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	err := recruitManifestObject(d, map[string]func() error{
		"format": func() error { _, err := recruitManifestInteger(d, 1, 1); return err },
		"version": func() error {
			token, err := d.Token()
			value, ok := token.(string)
			if err != nil || !ok {
				return ErrRecruitManifest
			}
			out.Version = value
			return nil
		},
		"rules": func() error {
			if err := recruitManifestDelimiter(d, '['); err != nil {
				return err
			}
			for i := range out.Rules {
				if !d.More() {
					return ErrRecruitManifest
				}
				if err := recruitManifestRule(d, &out.Rules[i]); err != nil {
					return err
				}
			}
			if d.More() {
				return ErrRecruitManifest
			}
			return recruitManifestDelimiter(d, ']')
		},
	})
	if err != nil {
		return RecruitManifest{}, ErrRecruitManifest
	}
	if _, err = d.Token(); err != io.EOF {
		return RecruitManifest{}, ErrRecruitManifest
	}
	version, err := RecruitManifestVersion(out.Rules)
	if err != nil || out.Version != version {
		return RecruitManifest{}, ErrRecruitManifest
	}
	return out, nil
}

func recruitManifestDelimiter(d *json.Decoder, want json.Delim) error {
	token, err := d.Token()
	if err != nil || token != want {
		return ErrRecruitManifest
	}
	return nil
}

func recruitManifestObject(d *json.Decoder, fields map[string]func() error) error {
	if err := recruitManifestDelimiter(d, '{'); err != nil {
		return err
	}
	seen := make(map[string]bool, len(fields))
	for d.More() {
		token, err := d.Token()
		key, ok := token.(string)
		if err != nil || !ok || seen[key] || fields[key] == nil {
			return ErrRecruitManifest
		}
		seen[key] = true // decoded key: escaped duplicate spellings also reject
		if err := fields[key](); err != nil {
			return err
		}
	}
	if len(seen) != len(fields) {
		return ErrRecruitManifest
	}
	return recruitManifestDelimiter(d, '}')
}

func recruitManifestInteger(d *json.Decoder, low, high int64) (int64, error) {
	token, err := d.Token()
	number, ok := token.(json.Number)
	if err != nil || !ok {
		return 0, ErrRecruitManifest
	}
	value, err := strconv.ParseInt(number.String(), 10, 64)
	if err != nil || value < low || value > high {
		return 0, ErrRecruitManifest
	}
	return value, nil
}

func recruitManifestRule(d *json.Decoder, rule *RecruitRule) error {
	return recruitManifestObject(d, map[string]func() error{
		"unit_cfg_id": func() error {
			value, err := recruitManifestInteger(d, 1, 4)
			rule.UnitCfgID = int32(value)
			return err
		},
		"seconds_per_unit": func() error {
			value, err := recruitManifestInteger(d, 1, math.MaxInt64/int64(time.Second))
			rule.SecondsPerUnit = value
			return err
		},
		"cost_per_unit": func() error {
			fields := make(map[string]func() error, 4)
			for key, target := range map[string]*int64{
				"food": &rule.Cost.Food, "wood": &rule.Cost.Wood,
				"iron": &rule.Cost.Iron, "stone": &rule.Cost.Stone,
			} {
				fields[key] = func() error {
					value, err := recruitManifestInteger(d, 0, math.MaxInt64)
					*target = value
					return err
				}
			}
			return recruitManifestObject(d, fields)
		},
	})
}
