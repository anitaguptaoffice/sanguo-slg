package runtime

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

type localMarchStartup struct {
	profiles *preparedCityProfiles
	owner    *pgx.Conn
}

// acquireLocalMarchStartup captures one reviewed file and takes a scoped
// session lock before preparing the local database or starting any writer.
func (a *App) acquireLocalMarchStartup(ctx context.Context) (_ *localMarchStartup, err error) {
	raw, err := os.ReadFile(a.Config.MILFreshProfileFile)
	if err != nil {
		return nil, fmt.Errorf("read prepared march profile: %w", err)
	}
	profile, catalog, err := loadMilitaryStartupProfile(raw)
	if err != nil {
		return nil, err
	}
	profiles, err := splitPreparedCityProfile(profile)
	if err != nil || profiles.march == nil || profile.ServerID != defaultShardID {
		return nil, badMilitary("expected complete local march inventory")
	}
	profiles.catalog = catalog
	bounded, stop := context.WithTimeout(ctx, 5*time.Second)
	defer stop()
	conn, err := a.DB.Acquire(bounded)
	if err != nil {
		return nil, err
	}
	startup := &localMarchStartup{profiles: profiles, owner: conn.Hijack()}
	defer func() {
		if err != nil {
			_ = startup.close()
		}
	}()
	const lockNamespace = 0x4d50524c // Prepared march loopback writer.
	var locked bool
	err = startup.owner.QueryRow(bounded, `SELECT pg_catalog.pg_try_advisory_lock($1,$2)
		FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.rolname=current_user
		JOIN pg_catalog.pg_roles s ON s.rolname=session_user
		JOIN pg_catalog.pg_database d ON d.datname=current_database()
		WHERE n.nspname=current_schema() AND n.nspname=$3 AND n.oid=$4::oid AND n.nspowner=$5::oid
		  AND d.datname=$6 AND d.oid=$7::oid AND r.rolname=$8 AND r.oid=$9::oid AND s.rolname=$10 AND s.oid=$11::oid`,
		lockNamespace, int32(profile.SchemaOID), profile.SchemaName, profile.SchemaOID, profile.SchemaOwnerOID,
		profile.DatabaseName, profile.DatabaseOID, profile.CurrentRoleName, profile.CurrentRoleOID,
		profile.SessionRoleName, profile.SessionRoleOID).Scan(&locked)
	if err != nil {
		return nil, fmt.Errorf("verify local prepared march writer identity: %w", err)
	}
	if !locked {
		return nil, fmt.Errorf("local prepared march writer already active")
	}
	return startup, nil
}

func (s *localMarchStartup) close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return s.owner.Close(ctx)
}

func (s *localMarchStartup) watch(ctx context.Context) error {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			check, cancel := context.WithTimeout(ctx, time.Second)
			err := s.owner.Ping(check)
			cancel()
			if err != nil && ctx.Err() == nil {
				return fmt.Errorf("local prepared march writer lease lost: %w", err)
			}
		}
	}
}
