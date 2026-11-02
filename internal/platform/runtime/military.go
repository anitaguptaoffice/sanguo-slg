package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"os"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MIL_FRESH_PROFILE_FILE names a reviewed deployment file: format 1, the
// serialized freshsource.Profile expectations and the reviewed recruit manifests.
const militaryStartupFormat = 1

var errMilitaryProfile = errors.New("runtime: invalid military startup profile")

// militaryStartupProfile publishes the reviewed Profile values verbatim.
type militaryStartupProfile struct {
	freshsource.Profile
	Format          int               `json:"format"`
	Manifests       []json.RawMessage `json:"recruit_manifests"`
	CurrentManifest string            `json:"recruit_current"`
}

// militaryFixedArrays reads the three fixed-size fields without coercing them.
type militaryFixedArrays struct {
	ReleaseDigest  json.RawMessage `json:"ReleaseDigest"`
	EvidenceDigest json.RawMessage `json:"EvidenceDigest"`
	Cohort         json.RawMessage `json:"Cohort"`
}

// strictMilitaryArrays validates the reviewed encoding before any fixed-array
// copy: encoding/json silently zero-fills a short array and truncates a long
// one, so each digest must be exactly 32 JSON numbers and the cohort exactly 16,
// each an integer in 0..255. Strings, base64, nulls, nested values and extra
// elements are rejected instead of being coerced or discarded.
func strictMilitaryArrays(raw []byte) (release, evidence, cohort []byte, err error) {
	var wire militaryFixedArrays
	if err = json.Unmarshal(raw, &wire); err != nil {
		return nil, nil, nil, badMilitary("json")
	}
	if release, err = strictJSONBytes(wire.ReleaseDigest, 32); err != nil {
		return nil, nil, nil, badMilitary("ReleaseDigest")
	}
	if evidence, err = strictJSONBytes(wire.EvidenceDigest, 32); err != nil {
		return nil, nil, nil, badMilitary("EvidenceDigest")
	}
	if cohort, err = strictJSONBytes(wire.Cohort, 16); err != nil {
		return nil, nil, nil, badMilitary("Cohort")
	}
	return release, evidence, cohort, nil
}

func strictJSONBytes(raw json.RawMessage, size int) ([]byte, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	token, err := decoder.Token()
	if err != nil || token != json.Delim('[') {
		return nil, errMilitaryProfile
	}
	out := make([]byte, 0, size)
	for decoder.More() {
		token, err = decoder.Token()
		if err != nil {
			return nil, errMilitaryProfile
		}
		number, ok := token.(float64)
		if !ok || number < 0 || number > 255 || number != math.Trunc(number) {
			return nil, errMilitaryProfile
		}
		out = append(out, byte(number))
	}
	if token, err = decoder.Token(); err != nil || token != json.Delim(']') || len(out) != size {
		return nil, errMilitaryProfile
	}
	if _, err = decoder.Token(); err != io.EOF {
		return nil, errMilitaryProfile
	}
	return out, nil
}

func badMilitary(field string) error { return fmt.Errorf("%w: %s", errMilitaryProfile, field) }

// catalog accepts only reviewed manifests; live rows never supply rules.
func (f militaryStartupProfile) catalog() (*march.RecruitCatalog, error) {
	records := make([]march.RecruitManifest, 0, len(f.Manifests))
	for _, raw := range f.Manifests {
		record, err := march.DecodeRecruitManifest(raw)
		if err != nil {
			return nil, badMilitary("recruit_manifests")
		}
		records = append(records, record)
	}
	catalog, err := march.NewRecruitCatalog(records, f.CurrentManifest)
	if err != nil {
		return nil, badMilitary("recruit_current")
	}
	return catalog, nil
}

func loadMilitaryStartupProfile(raw []byte) (freshsource.Profile, *march.RecruitCatalog, error) {
	release, evidence, cohort, err := strictMilitaryArrays(raw)
	if err != nil {
		return freshsource.Profile{}, nil, err
	}
	var f militaryStartupProfile
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&f); err != nil {
		return freshsource.Profile{}, nil, badMilitary("json")
	}
	if _, err := decoder.Token(); err != io.EOF {
		return freshsource.Profile{}, nil, badMilitary("trailing data")
	}
	copy(f.ReleaseDigest[:], release)
	copy(f.EvidenceDigest[:], evidence)
	copy(f.Cohort[:], cohort)
	if f.Format != militaryStartupFormat {
		return freshsource.Profile{}, nil, badMilitary("format")
	}
	p, err := freshsource.Snapshot(f.Profile)
	if err != nil {
		return freshsource.Profile{}, nil, badMilitary("profile")
	}
	catalog, err := f.catalog()
	return p, catalog, err
}

// ComposeMilitary assembles the durable MIL participants or returns nil (today's
// gateway) when the profile is absent, invalid, mismatched with the live source
// or the validation transaction cannot end cleanly. Observations never replace
// the expected profile.
func ComposeMilitary(ctx context.Context, log *slog.Logger, pool *pgxpool.Pool, path string) *api.MilitaryDurable {
	if path == "" {
		return nil
	}
	if log == nil {
		log = slog.Default()
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		log.Warn("military durable disabled", "reason", "startup profile unreadable")
		return nil
	}
	p, catalog, err := loadMilitaryStartupProfile(raw)
	if err == nil {
		var handle *api.MilitaryDurable
		if handle, err = composeMilitary(ctx, pool, p, catalog); err == nil {
			return handle
		}
	}
	log.Warn("military durable disabled", "reason", err.Error()[:min(len(err.Error()), 160)])
	return nil
}

// One bounded validation transaction; any error drops the handle.
func composeMilitary(ctx context.Context, pool *pgxpool.Pool, p freshsource.Profile, catalog *march.RecruitCatalog) (handle *api.MilitaryDurable, err error) {
	if ctx == nil || pool == nil || catalog == nil || p.ServerID != defaultShardID {
		return nil, badMilitary("source binding")
	}
	binding, err := recruittx.NewBinding(pool)
	if err != nil {
		return nil, err
	}
	txCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	owner, err := binding.Begin(txCtx)
	if err != nil {
		return nil, err
	}
	defer func() {
		clean, stop := context.WithTimeout(context.WithoutCancel(txCtx), 5*time.Second)
		defer stop()
		if endErr := owner.Rollback(clean); endErr != nil && err == nil {
			handle, err = nil, endErr
		}
	}()
	access := owner.Access()
	fresh, err := march.NewFreshCityParticipant(txCtx, binding, access, p)
	if err != nil {
		return nil, err
	}
	recruit, err := march.NewRecruitParticipant(txCtx, binding, access, p, catalog)
	if err == nil {
		err = fresh.Pin(txCtx, access)
	}
	if err == nil {
		err = recruit.Pin(txCtx, access)
	}
	if err != nil {
		return nil, err
	}
	return api.NewMilitaryDurable(binding, p, recruit, fresh)
}
