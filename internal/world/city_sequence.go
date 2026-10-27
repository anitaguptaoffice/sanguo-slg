package world

import (
	"context"
	"errors"
	"strings"
	"sync/atomic"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var errCitySequence = errors.New("world: city sequence unavailable")

type citySequenceStamp struct {
	database, namespace, sequence, owner, schemaOwner uint32
	roleOID, sessionOID                               uint32
	databaseName, role, session                       string
}

// Observed consistency ONLY: not approved source/role, retained highwater,
// cohort/fence or actor/lock proof. No live caller may use this dormant mechanism
// before the separately reviewed source and fresh-city composition gates pass.
type citySequence struct {
	binding *recruittx.Binding
	schema  string
	stamp   citySequenceStamp
	retired atomic.Bool
}

func inspectCitySequence(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, schema string) (citySequenceStamp, error) {
	var stamp citySequenceStamp
	if ctx == nil || a == nil || b == nil || schema == "" || strings.HasPrefix(schema, "pg_") || schema == "information_schema" {
		return stamp, errCitySequence
	}
	var valid bool
	err := a.Scan(ctx, b, citySequenceMetadata, []any{schema}, &stamp.database, &stamp.namespace, &stamp.sequence,
		&stamp.owner, &stamp.schemaOwner, &stamp.roleOID, &stamp.sessionOID, &stamp.databaseName, &stamp.role, &stamp.session, &valid)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !valid) {
		return citySequenceStamp{}, errCitySequence
	}
	return stamp, err
}

// Only trusted startup composition may capture after independent source approval;
// do not call this as automatic recovery when an existing binding retires.
func captureCitySequence(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, schema string) (*citySequence, error) {
	stamp, err := inspectCitySequence(ctx, a, b, schema)
	if err != nil {
		return nil, err
	}
	return &citySequence{binding: b, schema: schema, stamp: stamp}, nil
}

// next uses the caller-owned active transaction, never Begin/Commit/pooled SQL.
// Errors may still abandon a sequence number; rollback never rewinds nextval.
// A number is NOT a created city or a fresh-city proof. The future WORLD owner
// must hold its approved source fence/locks and perform the actual INSERT.
// Retirement closes later admission, not an in-flight revocation/drain fence.
func (s *citySequence) next(ctx context.Context, a *recruittx.Access) (int64, error) {
	if s == nil || s.binding == nil || s.retired.Load() || ctx == nil || a == nil {
		return 0, errCitySequence
	}
	actual, err := inspectCitySequence(ctx, a, s.binding, s.schema)
	if err != nil {
		if errors.Is(err, errCitySequence) {
			s.retired.Store(true)
		}
		return 0, err
	}
	if actual != s.stamp {
		s.retired.Store(true)
		return 0, errCitySequence
	}
	if s.retired.Load() {
		return 0, errCitySequence
	}
	var id int64
	err = a.Scan(ctx, s.binding, `SELECT pg_catalog.nextval($1::pg_catalog.oid::pg_catalog.regclass)`, []any{s.stamp.sequence}, &id)
	if err != nil {
		var pgerr *pgconn.PgError
		if errors.As(err, &pgerr) && pgerr.Code == "2200H" {
			s.retired.Store(true)
		}
		return 0, err
	}
	if id <= 0 {
		s.retired.Store(true)
		return 0, errCitySequence
	}
	return id, nil
}

const citySequenceMetadata = `SELECT d.oid,n.oid,c.oid,c.relowner,n.nspowner,
 (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname OPERATOR(pg_catalog.=) current_user),
 (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname OPERATOR(pg_catalog.=) session_user),
 d.datname::pg_catalog.text,current_user::pg_catalog.text,session_user::pg_catalog.text,
 (pg_catalog.current_setting('server_version_num')::pg_catalog.int4 OPERATOR(pg_catalog./) 10000 OPERATOR(pg_catalog.=) 17
 AND c.relkind OPERATOR(pg_catalog.=) 'S' AND c.relpersistence OPERATOR(pg_catalog.=) 'p'
 AND NOT c.relispartition AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity
 AND s.seqtypid OPERATOR(pg_catalog.=) 'pg_catalog.int8'::pg_catalog.regtype
 AND s.seqstart OPERATOR(pg_catalog.=) 1 AND s.seqmin OPERATOR(pg_catalog.=) 1
 AND s.seqmax OPERATOR(pg_catalog.=) 9223372036854775807 AND s.seqincrement OPERATOR(pg_catalog.=) 1
 AND s.seqcache OPERATOR(pg_catalog.=) 1 AND NOT s.seqcycle
 AND pg_catalog.has_sequence_privilege(current_user,c.oid,'USAGE')
 AND pg_catalog.has_sequence_privilege(current_user,c.oid,'SELECT')
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_depend x
  WHERE x.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass
  AND x.objid OPERATOR(pg_catalog.=) c.oid
  AND (x.deptype OPERATOR(pg_catalog.=) 'a' OR x.deptype OPERATOR(pg_catalog.=) 'i' OR x.deptype OPERATOR(pg_catalog.=) 'e'))
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_depend x
  WHERE x.refclassid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass
  AND x.refobjid OPERATOR(pg_catalog.=) c.oid
  AND x.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_attrdef'::pg_catalog.regclass))
 FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_class c ON c.relnamespace OPERATOR(pg_catalog.=) n.oid
 JOIN pg_catalog.pg_sequence s ON s.seqrelid OPERATOR(pg_catalog.=) c.oid
 JOIN pg_catalog.pg_database d ON d.datname OPERATOR(pg_catalog.=) pg_catalog.current_database()
 WHERE n.nspname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) $1::pg_catalog.text COLLATE pg_catalog."C"
 AND c.relname OPERATOR(pg_catalog.=) 'player_city_id_seq'`
