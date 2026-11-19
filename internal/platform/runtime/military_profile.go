package runtime

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errRuntimeProfile = errors.New("runtime: database source profile unavailable")

// runtimeSourceNames is the exact relation/index/sequence inventory the durable
// domains pin. The profile below is derived from the live catalog for this list,
// so a deployment needs no external reviewed profile file.
func runtimeSourceNames() []string {
	names := make([]string, 0, 49)
	names = append(names, march.MilitarySourceObjectNames()...)
	names = append(names, preparedWorldObjects...)
	names = append(names, preparedDomesticObjects...)
	names = append(names, preparedRecruitAccountObjects...)
	names = append(names, preparedReturnObjects...)
	return names
}

// loadRuntimeProfiles builds the domain profiles from the live database. It
// replaces the former external reviewed-profile file: the source of truth is
// the schema the process actually writes to.
func loadRuntimeProfiles(ctx context.Context, pool *pgxpool.Pool, serverID int32) (*preparedCityProfiles, error) {
	profile, err := runtimeProfile(ctx, pool, serverID)
	if err != nil {
		return nil, err
	}
	return splitPreparedCityProfile(profile)
}

func runtimeProfile(ctx context.Context, pool *pgxpool.Pool, serverID int32) (freshsource.Profile, error) {
	var p freshsource.Profile
	if ctx == nil || pool == nil || serverID <= 0 {
		return p, errRuntimeProfile
	}
	if err := pool.QueryRow(ctx, `
		SELECT d.datname, d.oid, n.nspname, n.oid, n.nspowner,
		       r.rolname, r.oid, s.rolname, s.oid
		FROM pg_catalog.pg_database d, pg_catalog.pg_namespace n,
		     pg_catalog.pg_roles r, pg_catalog.pg_roles s
		WHERE d.datname = current_database()
		  AND n.nspname = current_schema()
		  AND r.rolname = current_user
		  AND s.rolname = session_user`).Scan(
		&p.DatabaseName, &p.DatabaseOID, &p.SchemaName, &p.SchemaOID, &p.SchemaOwnerOID,
		&p.CurrentRoleName, &p.CurrentRoleOID, &p.SessionRoleName, &p.SessionRoleOID,
	); err != nil {
		return p, fmt.Errorf("%w: identity: %v", errRuntimeProfile, err)
	}
	p.ServerID = serverID
	names := runtimeSourceNames()
	rows, err := pool.Query(ctx, `
		SELECT c.relname, c.oid, c.relowner
		FROM pg_catalog.pg_class c
		JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = current_schema() AND c.relname = ANY($1)`, names)
	if err != nil {
		return p, fmt.Errorf("%w: catalog: %v", errRuntimeProfile, err)
	}
	p.Objects = make(map[string]freshsource.ObjectIdentity, len(names))
	for rows.Next() {
		var name string
		var object freshsource.ObjectIdentity
		if err := rows.Scan(&name, &object.OID, &object.OwnerOID); err != nil {
			rows.Close()
			return p, fmt.Errorf("%w: catalog scan: %v", errRuntimeProfile, err)
		}
		p.Objects[name] = object
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return p, fmt.Errorf("%w: catalog rows: %v", errRuntimeProfile, err)
	}
	rows.Close()
	if len(p.Objects) != len(names) {
		missing := make([]string, 0, len(names)-len(p.Objects))
		for _, name := range names {
			if _, ok := p.Objects[name]; !ok {
				missing = append(missing, name)
			}
		}
		return p, fmt.Errorf("%w: catalog inventory %d/%d missing %v", errRuntimeProfile, len(p.Objects), len(names), missing)
	}
	if err := runtimeCohort(ctx, pool, &p); err != nil {
		return p, err
	}
	p.ReleaseDigest = sha256.Sum256([]byte("sanguo/runtime/release/" + p.SchemaName))
	p.EvidenceDigest = sha256.Sum256([]byte("sanguo/runtime/evidence/" + p.SchemaName))
	p.ClusterRef = "runtime:" + p.SchemaName
	p.EvidenceRef = "runtime:" + p.DatabaseName
	return p, nil
}

// ensureCityOrigins backfills durable city origins for cities that predate the
// single-track runtime. Without it, an upgraded database keeps its cities but
// cannot resolve their garrisons or recruit history.
func ensureCityOrigins(ctx context.Context, pool *pgxpool.Pool) error {
	var schema string
	if err := pool.QueryRow(ctx, `SELECT current_schema()`).Scan(&schema); err != nil {
		return fmt.Errorf("%w: schema: %v", errRuntimeProfile, err)
	}
	cohort := make([]byte, 16)
	sum := sha256.Sum256([]byte("sanguo/runtime/cohort/" + schema))
	copy(cohort, sum[:len(cohort)])
	var existing []byte
	err := pool.QueryRow(ctx, `SELECT cohort_id FROM mil_city_origin ORDER BY city_id LIMIT 1`).Scan(&existing)
	switch {
	case err == nil:
		cohort = existing
	case !errors.Is(err, pgx.ErrNoRows):
		return fmt.Errorf("%w: cohort: %v", errRuntimeProfile, err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO mil_city_origin (server_id, city_id, owner_player_id, cohort_id, format_version, created_at)
		SELECT c.server_id, c.city_id, c.player_id, $1, 1, date_trunc('milliseconds', c.created_at)
		FROM player_city c
		WHERE NOT EXISTS (
			SELECT 1 FROM mil_city_origin o
			WHERE o.server_id = c.server_id AND o.city_id = c.city_id
		)`, cohort); err != nil {
		return fmt.Errorf("%w: city origins: %v", errRuntimeProfile, err)
	}
	return nil
}

// runtimeCohort keeps one cohort id per database. Existing durable rows win so a
// deployment keeps reading jobs written before this profile existed.
func runtimeCohort(ctx context.Context, pool *pgxpool.Pool, p *freshsource.Profile) error {
	var cohort []byte
	err := pool.QueryRow(ctx, `SELECT cohort_id FROM mil_city_origin ORDER BY city_id LIMIT 1`).Scan(&cohort)
	switch {
	case err == nil:
		if len(cohort) != len(p.Cohort) {
			return fmt.Errorf("%w: cohort width %d", errRuntimeProfile, len(cohort))
		}
		copy(p.Cohort[:], cohort)
		return nil
	case errors.Is(err, pgx.ErrNoRows):
		sum := sha256.Sum256([]byte("sanguo/runtime/cohort/" + p.SchemaName))
		copy(p.Cohort[:], sum[:len(p.Cohort)])
		return nil
	default:
		return fmt.Errorf("%w: cohort: %v", errRuntimeProfile, err)
	}
}
