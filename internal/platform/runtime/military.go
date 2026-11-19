package runtime

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errMilitaryProfile = errors.New("runtime: invalid military source")

func badMilitary(field string) error { return fmt.Errorf("%w: %s", errMilitaryProfile, field) }

// composeRuntimeMilitary builds the one durable military path from the live
// database plus the reviewed recruit manifests shipped in the repository.
// There is no external profile file and no in-memory fallback.
func composeRuntimeMilitary(ctx context.Context, pool *pgxpool.Pool) (*api.MilitaryDurable, *preparedCityProfiles, error) {
	if ctx == nil || pool == nil {
		return nil, nil, badMilitary("missing database")
	}
	catalog, err := march.LoadRecruitCatalogDir(filepath.Join(RepoRoot(), march.RecruitManifestDir))
	if err != nil {
		return nil, nil, fmt.Errorf("load recruit manifests: %w", err)
	}
	profiles, err := loadRuntimeProfiles(ctx, pool, defaultShardID)
	if err != nil {
		return nil, nil, err
	}
	military, err := composeMilitary(ctx, pool, profiles.military, catalog)
	if err != nil {
		return nil, nil, err
	}
	profiles.catalog = catalog
	return military, profiles, nil
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
