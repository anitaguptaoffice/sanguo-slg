package account

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

var errFreshActorTables = errors.New("account: fresh actor table metadata unavailable")
var freshActorTableNames = [...]string{"account", "account_session", "player"}

// Partial read-only table check, NOT source enrollment or actor authorization.
// Complete constraints/indexes, identity sequence and exact baseline FK/RI hooks
// must be validated separately before any ActorGuard can be constructed or used.
func validateFreshActorTables(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile) error {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || a == nil || b == nil || strings.HasPrefix(p.SchemaName, "pg_") || p.SchemaName == "information_schema" {
		return errFreshActorTables
	}
	for _, name := range []string{p.DatabaseName, p.SchemaName, p.CurrentRoleName, p.SessionRoleName} {
		if !utf8.ValidString(name) {
			return errFreshActorTables
		}
	}
	objects := make(map[string]freshsource.ObjectIdentity, len(freshActorTableNames))
	for _, name := range freshActorTableNames {
		v, ok := p.Objects[name]
		if !ok {
			return errFreshActorTables
		}
		objects[name] = v
	}
	p.Objects = objects
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	copyAccess := *a
	var valid bool
	if err = copyAccess.Scan(ctx, b, freshActorHeader, []any{data}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshActorTables
	}
	if err = copyAccess.Scan(ctx, b, freshActorTableCatalog, []any{data, freshActorColumns}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshActorTables
	}
	return nil
}

const freshActorHeader = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v)
 SELECT COALESCE(pg_catalog.bool_and(
 d.oid OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'DatabaseOID')::pg_catalog.oid
 AND d.datname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'DatabaseName') COLLATE pg_catalog."C"
 AND n.oid OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SchemaOID')::pg_catalog.oid
 AND n.nspowner OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SchemaOwnerOID')::pg_catalog.oid
 AND r.oid OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'CurrentRoleOID')::pg_catalog.oid
 AND s.oid OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SessionRoleOID')::pg_catalog.oid
 AND current_user::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'CurrentRoleName') COLLATE pg_catalog."C"
 AND session_user::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SessionRoleName') COLLATE pg_catalog."C"
 AND pg_catalog.has_schema_privilege(current_user,n.oid,'USAGE')
 AND (pg_catalog.current_schemas(true))[1] OPERATOR(pg_catalog.=) 'pg_catalog'
 AND pg_catalog.current_setting('TimeZone') OPERATOR(pg_catalog.=) ANY(ARRAY['UTC','Etc/UTC']::pg_catalog.text[])
 AND pg_catalog.current_setting('DateStyle') OPERATOR(pg_catalog.~) '^ISO,'
 AND pg_catalog.current_setting('server_version_num')::pg_catalog.int4 OPERATOR(pg_catalog./) 10000 OPERATOR(pg_catalog.=) 17),false)
 FROM p JOIN pg_catalog.pg_database d ON d.datname OPERATOR(pg_catalog.=) pg_catalog.current_database()
 JOIN pg_catalog.pg_namespace n ON n.nspname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SchemaName') COLLATE pg_catalog."C"
 JOIN pg_catalog.pg_roles r ON r.rolname OPERATOR(pg_catalog.=) current_user
 JOIN pg_catalog.pg_roles s ON s.rolname OPERATOR(pg_catalog.=) session_user`

// attnum, literal name, type OID, typmod, NOT NULL, identity mode,
// collation OID, exact builtin-default deparse. Fixed from reviewed 001 DDL.
const freshActorColumns = `{
 "account":[[1,"account_id",20,-1,true,"a",0,""],[2,"login_name",1043,68,true,"",100,""],[3,"password_hash",1043,259,true,"",100,""],[4,"status",21,-1,true,"",0,"1"],[5,"created_at",1184,-1,true,"",0,"now()"],[6,"updated_at",1184,-1,true,"",0,"now()"]],
 "account_session":[[1,"session_id",2950,-1,true,"",0,"gen_random_uuid()"],[2,"account_id",20,-1,true,"",0,""],[3,"expires_at",1184,-1,true,"",0,""],[4,"created_at",1184,-1,true,"",0,"now()"]],
 "player":[[1,"server_id",23,-1,true,"",0,""],[2,"player_id",20,-1,true,"",0,""],[3,"account_id",20,-1,true,"",0,""],[4,"display_name",1043,36,true,"",100,""],[5,"level",23,-1,true,"",0,"1"],[6,"power",20,-1,true,"",0,"0"],[7,"last_login_at",1184,-1,false,"",0,""],[8,"created_at",1184,-1,true,"",0,"now()"]]}`

// Trigger, constraint, index and identity-sequence semantics are deliberately
// outside this table projection. In particular approved ACCOUNT RI hooks exist.
const freshActorTableCatalog = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v), e AS (
 SELECT key AS name,(value OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS oid,
 (value OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS owner FROM p,pg_catalog.jsonb_each(v OPERATOR(pg_catalog.->) 'Objects')
) SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 3 AND pg_catalog.bool_and(COALESCE(
 c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) e.name COLLATE pg_catalog."C"
 AND c.relnamespace OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SchemaOID')::pg_catalog.oid
 AND c.relowner OPERATOR(pg_catalog.=) e.owner AND c.relpersistence OPERATOR(pg_catalog.=) 'p'
 AND c.relkind OPERATOR(pg_catalog.=) 'r' AND am.amname OPERATOR(pg_catalog.=) 'heap' AND c.reloftype OPERATOR(pg_catalog.=) 0
 AND c.relreplident OPERATOR(pg_catalog.=) 'd'
 AND NOT c.relispartition AND c.relpartbound IS NULL AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.reloptions IS NULL
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_inherits h WHERE h.inhrelid OPERATOR(pg_catalog.=) c.oid OR h.inhparent OPERATOR(pg_catalog.=) c.oid)
 AND (e.name OPERATOR(pg_catalog.=) 'account_session' OR
 (pg_catalog.has_table_privilege(current_user,c.oid,'SELECT') AND pg_catalog.has_table_privilege(current_user,c.oid,'UPDATE')))
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_rewrite r WHERE r.ev_class OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_policy q WHERE q.polrelid OPERATOR(pg_catalog.=) c.oid)
 AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attnum,a.attname::pg_catalog.text,a.atttypid::pg_catalog.int8,
 a.atttypmod,a.attnotnull,a.attidentity::pg_catalog.text,a.attcollation::pg_catalog.int8,COALESCE(pg_catalog.pg_get_expr(d.adbin,d.adrelid),'')) ORDER BY a.attnum)
 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid OPERATOR(pg_catalog.=) a.attrelid AND d.adnum OPERATOR(pg_catalog.=) a.attnum
 WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0) OPERATOR(pg_catalog.=) ($2::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_attribute a WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0
 AND (a.attisdropped OR a.attgenerated OPERATOR(pg_catalog.<>) '' OR a.atthasmissing OR a.attndims OPERATOR(pg_catalog.<>) 0)),false))
 FROM p,e LEFT JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) e.oid LEFT JOIN pg_catalog.pg_am am ON am.oid OPERATOR(pg_catalog.=) c.relam`
