package march

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

var errFreshMilitaryBase = errors.New("march: fresh military base metadata unavailable")
var freshBaseNames = [...]string{"mil_city_origin", "mil_city_origin_pkey", "city_troop", "city_troop_pkey"}

// Partial, read-only metadata check. NOT a complete source binding, enrollment,
// readiness or successful initialization proof. Queue/origin/receipt validation,
// external provenance and APP admission remain mandatory separate prerequisites.
func validateFreshMilitaryBase(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile) error {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || a == nil || b == nil || strings.HasPrefix(p.SchemaName, "pg_") || p.SchemaName == "information_schema" {
		return errFreshMilitaryBase
	}
	// JSON must not replace invalid bytes and silently retarget an identifier.
	for _, name := range []string{p.DatabaseName, p.SchemaName, p.CurrentRoleName, p.SessionRoleName} {
		if !utf8.ValidString(name) {
			return errFreshMilitaryBase
		}
	}
	objects := make(map[string]freshsource.ObjectIdentity, len(freshBaseNames))
	for _, name := range freshBaseNames {
		object, ok := p.Objects[name]
		if !ok {
			return errFreshMilitaryBase
		}
		objects[name] = object
	}
	p.Objects = objects // this helper checks only its fixed four-object projection
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	copyAccess := *a
	var valid bool
	if err = copyAccess.Scan(ctx, b, freshBaseHeader, []any{data}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshMilitaryBase
	}
	if err = copyAccess.Scan(ctx, b, freshBaseCatalog, []any{data, freshBaseColumns, freshBaseChecks, freshBaseIndexes}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshMilitaryBase
	}
	return nil
}

const freshBaseHeader = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v)
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

// Fixed reviewed DDL, not a caller profile's desired shape or mutable DB template.
const freshBaseColumns = `{
 "mil_city_origin":[[1,"server_id",23,""],[2,"city_id",20,""],[3,"owner_player_id",20,""],[4,"cohort_id",17,""],[5,"format_version",21,""],[6,"created_at",1184,""]],
 "city_troop":[[1,"server_id",23,""],[2,"city_id",20,""],[3,"unit_cfg_id",23,""],[4,"count",23,"0"],[5,"wounded",23,"0"]]}`
const freshBaseChecks = `{
 "mil_city_origin":{
 "mil_city_origin_pkey":"PRIMARY KEY (server_id, city_id)",
 "mil_city_origin_server_id_check":"CHECK ((server_id > 0))",
 "mil_city_origin_city_id_check":"CHECK ((city_id > 0))",
 "mil_city_origin_owner_player_id_check":"CHECK ((owner_player_id > 0))",
 "mil_city_origin_cohort_id_check":"CHECK (((octet_length(cohort_id) = 16) AND (cohort_id <> decode(repeat('00'::text, 16), 'hex'::text))))",
 "mil_city_origin_format_version_check":"CHECK ((format_version = 1))",
 "mil_city_origin_created_at_check":"CHECK ((isfinite(created_at) AND (created_at >= '0001-01-01 00:00:00+00'::timestamp with time zone) AND (created_at < '10000-01-01 00:00:00+00'::timestamp with time zone) AND (date_trunc('milliseconds'::text, created_at) = created_at)))"},
 "city_troop":{"city_troop_pkey":"PRIMARY KEY (server_id, city_id, unit_cfg_id)","city_troop_count_check":"CHECK ((count >= 0))","city_troop_wounded_check":"CHECK ((wounded >= 0))"}}`
const freshBaseIndexes = `{
 "mil_city_origin_pkey":["mil_city_origin","1 2","0 0","0 0",["int4_ops","int8_ops"]],
 "city_troop_pkey":["city_troop","1 2 3","0 0 0","0 0 0",["int4_ops","int8_ops","int4_ops"]]}`

const freshBaseCatalog = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v), e AS (
 SELECT key AS name,(value OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS oid,
 (value OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS owner FROM p,pg_catalog.jsonb_each(v OPERATOR(pg_catalog.->) 'Objects')
) SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 4 AND pg_catalog.bool_and(COALESCE(
 c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) e.name COLLATE pg_catalog."C"
 AND c.relnamespace OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SchemaOID')::pg_catalog.oid
 AND c.relowner OPERATOR(pg_catalog.=) e.owner AND c.relpersistence OPERATOR(pg_catalog.=) 'p'
 AND NOT c.relispartition AND c.relpartbound IS NULL AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.reloptions IS NULL
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_inherits h WHERE h.inhrelid OPERATOR(pg_catalog.=) c.oid OR h.inhparent OPERATOR(pg_catalog.=) c.oid)
 AND CASE WHEN e.name OPERATOR(pg_catalog.=) ANY(ARRAY['mil_city_origin','city_troop']::pg_catalog.text[]) THEN
 c.relkind OPERATOR(pg_catalog.=) 'r' AND am.amname OPERATOR(pg_catalog.=) 'heap' AND c.reloftype OPERATOR(pg_catalog.=) 0
 AND c.relreplident OPERATOR(pg_catalog.=) 'd'
 AND pg_catalog.has_table_privilege(current_user,c.oid,'SELECT') AND pg_catalog.has_table_privilege(current_user,c.oid,'INSERT')
 AND pg_catalog.has_table_privilege(current_user,c.oid,'UPDATE')
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_trigger t WHERE t.tgrelid OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_rewrite r WHERE r.ev_class OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_policy q WHERE q.polrelid OPERATOR(pg_catalog.=) c.oid)
 AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attnum,a.attname::pg_catalog.text,a.atttypid::pg_catalog.int8,
 COALESCE(pg_catalog.pg_get_expr(d.adbin,d.adrelid),'')) ORDER BY a.attnum)
 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid OPERATOR(pg_catalog.=) a.attrelid AND d.adnum OPERATOR(pg_catalog.=) a.attnum
 WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0) OPERATOR(pg_catalog.=) ($2::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_attribute a WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0
 AND (a.attisdropped OR NOT a.attnotnull OR a.attidentity OPERATOR(pg_catalog.<>) '' OR a.attgenerated OPERATOR(pg_catalog.<>) ''
 OR a.atthasmissing OR a.atttypmod OPERATOR(pg_catalog.<>) -1 OR a.attndims OPERATOR(pg_catalog.<>) 0 OR a.attcollation OPERATOR(pg_catalog.<>) 0))
 AND (SELECT pg_catalog.jsonb_object_agg(k.conname::pg_catalog.text,pg_catalog.pg_get_constraintdef(k.oid))
 FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid) OPERATOR(pg_catalog.=) ($3::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid AND
 (NOT k.convalidated OR k.condeferrable OR k.condeferred OR NOT k.conislocal OR k.coninhcount OPERATOR(pg_catalog.<>) 0
 OR k.conparentid OPERATOR(pg_catalog.<>) 0 OR k.connamespace OPERATOR(pg_catalog.<>) c.relnamespace
 OR (k.contype OPERATOR(pg_catalog.=) 'c' AND k.connoinherit)))
 AND (SELECT pg_catalog.count(*) FROM pg_catalog.pg_index z WHERE z.indrelid OPERATOR(pg_catalog.=) c.oid) OPERATOR(pg_catalog.=) 1
 ELSE c.relkind OPERATOR(pg_catalog.=) 'i' AND am.amname OPERATOR(pg_catalog.=) 'btree'
 AND i.indisprimary AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive AND i.indimmediate AND NOT i.indisexclusion
 AND NOT i.indnullsnotdistinct AND NOT i.indisreplident AND i.indexprs IS NULL AND i.indpred IS NULL
 AND i.indnkeyatts OPERATOR(pg_catalog.=) i.indnatts
 AND (SELECT pg_catalog.jsonb_build_array(t.relname::pg_catalog.text,i.indkey::pg_catalog.text,i.indoption::pg_catalog.text,i.indcollation::pg_catalog.text,
 (SELECT pg_catalog.jsonb_agg(CASE WHEN op.opcnamespace OPERATOR(pg_catalog.=) 'pg_catalog'::pg_catalog.regnamespace AND op.opcmethod OPERATOR(pg_catalog.=) c.relam
 THEN op.opcname::pg_catalog.text ELSE NULL END ORDER BY z.n) FROM pg_catalog.unnest(i.indclass::pg_catalog.oid[]) WITH ORDINALITY z(oid,n)
 LEFT JOIN pg_catalog.pg_opclass op ON op.oid OPERATOR(pg_catalog.=) z.oid))
 FROM pg_catalog.pg_class t JOIN e et ON et.oid OPERATOR(pg_catalog.=) t.oid WHERE t.oid OPERATOR(pg_catalog.=) i.indrelid)
 OPERATOR(pg_catalog.=) ($4::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 END,false)) FROM p,e LEFT JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) e.oid
 LEFT JOIN pg_catalog.pg_am am ON am.oid OPERATOR(pg_catalog.=) c.relam LEFT JOIN pg_catalog.pg_index i ON i.indexrelid OPERATOR(pg_catalog.=) c.oid`
