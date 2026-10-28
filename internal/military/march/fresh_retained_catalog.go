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

var errFreshMilitaryRetained = errors.New("march: fresh military retained metadata unavailable")
var freshRetainedNames = [...]string{"mil_recruit_origin", "mil_recruit_receipt", "mil_recruit_origin_pkey", "mil_recruit_origin_server_id_player_id_operation_command_id_key", "mil_recruit_receipt_pkey"}

// Partial read-only retained metadata check, not source enrollment or initialization.
// Sequence, complete source, external provenance and APP admission remain separate.
func validateFreshMilitaryRetained(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile) error {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || a == nil || b == nil || strings.HasPrefix(p.SchemaName, "pg_") || p.SchemaName == "information_schema" {
		return errFreshMilitaryRetained
	}
	// JSON must not replace invalid bytes and silently retarget an identifier.
	for _, name := range []string{p.DatabaseName, p.SchemaName, p.CurrentRoleName, p.SessionRoleName} {
		if !utf8.ValidString(name) {
			return errFreshMilitaryRetained
		}
	}
	objects := make(map[string]freshsource.ObjectIdentity, len(freshRetainedNames))
	for _, name := range freshRetainedNames {
		object, ok := p.Objects[name]
		if !ok {
			return errFreshMilitaryRetained
		}
		objects[name] = object
	}
	p.Objects = objects // this helper checks only its fixed five-object projection
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
		return errFreshMilitaryRetained
	}
	if err = copyAccess.Scan(ctx, b, freshRetainedCatalog, []any{data, freshRetainedColumns, freshRetainedChecks, freshRetainedIndexes}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshMilitaryRetained
	}
	if err = copyAccess.Scan(ctx, b, freshRetainedFK, []any{data}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshMilitaryRetained
	}
	return nil
}

// Fixed reviewed 008 entry / m4_008 CHECK semantics; literal whitespace retained.
const freshRetainedColumns = `{"mil_recruit_origin":[[1,"server_id",23,"",true],[2,"queue_id",20,"",true],[3,"player_id",20,"",true],[4,"operation",21,"",true],[5,"command_id",17,"",true]],
 "mil_recruit_receipt":[[1,"server_id",23,"",true],[2,"queue_id",20,"",true],[3,"intent_version",21,"",true],[4,"city_id",20,"",true],[5,"unit_cfg_id",23,"",true],[6,"count",23,"",true],[7,"food_paid",20,"",true],[8,"wood_paid",20,"",true],[9,"iron_paid",20,"",true],[10,"stone_paid",20,"",true],[11,"duration_sec",20,"",true],[12,"catalog_version",17,"",true],[13,"rule_digest",17,"",true],[14,"accepted_at",1184,"",true],[15,"initial_start_at",1184,"",true],[16,"initial_finish_at",1184,"",true],[17,"initial_status",21,"",true]]}`
const freshRetainedChecks = `{"mil_recruit_origin":["CHECK (((octet_length(command_id) = 16) AND (command_id <> decode(repeat('00'::text, 16), 'hex'::text))))",
 "CHECK (((queue_id >= 1) AND (queue_id <= '9007199254740991'::bigint)))",
 "CHECK ((operation = 1))",
 "PRIMARY KEY (server_id, queue_id)",
 "UNIQUE (server_id, player_id, operation, command_id)"],
 "mil_recruit_receipt":["CHECK (((queue_id >= 1) AND (queue_id <= '9007199254740991'::bigint)))",
 "CHECK (((unit_cfg_id >= 1) AND (unit_cfg_id <= 4)))",
 "CHECK ((count > 0))",
 "CHECK ((duration_sec > 0))",
 "CHECK ((food_paid >= 0))",
 "CHECK ((initial_status = ANY (ARRAY[0, 1])))",
 "CHECK ((intent_version = 1))",
 "CHECK ((iron_paid >= 0))",
 "CHECK ((isfinite(accepted_at) AND (accepted_at >= '0001-01-01 00:00:00+00'::timestamp with time zone) AND (accepted_at < '10000-01-01 00:00:00+00'::timestamp with time zone) AND (date_trunc('milliseconds'::text, accepted_at) = accepted_at)))",
 "CHECK ((isfinite(initial_finish_at) AND (initial_finish_at >= '0001-01-01 00:00:00+00'::timestamp with time zone) AND (initial_finish_at < '10000-01-01 00:00:00+00'::timestamp with time zone) AND (date_trunc('milliseconds'::text, initial_finish_at) = initial_finish_at)))",
 "CHECK ((isfinite(initial_start_at) AND (initial_start_at >= '0001-01-01 00:00:00+00'::timestamp with time zone) AND (initial_start_at < '10000-01-01 00:00:00+00'::timestamp with time zone) AND (date_trunc('milliseconds'::text, initial_start_at) = initial_start_at)))",
 "CHECK ((octet_length(catalog_version) > 0))",
 "CHECK ((octet_length(rule_digest) = 32))",
 "CHECK ((stone_paid >= 0))",
 "CHECK ((wood_paid >= 0))",
 "PRIMARY KEY (server_id, queue_id)",
 "RETAINED_FK"]}`
const freshRetainedIndexes = `{"mil_recruit_origin_pkey":["mil_recruit_origin","1 2","0 0","0 0",["int4_ops","int8_ops"],true,""],
 "mil_recruit_origin_server_id_player_id_operation_command_id_key":["mil_recruit_origin","1 3 4 5","0 0 0 0","0 0 0 0",["int4_ops","int8_ops","int2_ops","bytea_ops"],false,""],
 "mil_recruit_receipt_pkey":["mil_recruit_receipt","1 2","0 0","0 0",["int4_ops","int8_ops"],true,""]}`

const freshRetainedCatalog = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v), e AS (
 SELECT key AS name,(value OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS oid,
 (value OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS owner FROM p,pg_catalog.jsonb_each(v OPERATOR(pg_catalog.->) 'Objects')
) SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 5 AND pg_catalog.bool_and(COALESCE(
 c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) e.name COLLATE pg_catalog."C"
 AND c.relnamespace OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SchemaOID')::pg_catalog.oid
 AND c.relowner OPERATOR(pg_catalog.=) e.owner AND c.relpersistence OPERATOR(pg_catalog.=) 'p'
 AND NOT c.relispartition AND c.relpartbound IS NULL AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.reloptions IS NULL
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_inherits h WHERE h.inhrelid OPERATOR(pg_catalog.=) c.oid OR h.inhparent OPERATOR(pg_catalog.=) c.oid)
 AND CASE WHEN e.name OPERATOR(pg_catalog.=) ANY(ARRAY['mil_recruit_origin','mil_recruit_receipt']::pg_catalog.text[]) THEN
 c.relkind OPERATOR(pg_catalog.=) 'r' AND am.amname OPERATOR(pg_catalog.=) 'heap' AND c.reloftype OPERATOR(pg_catalog.=) 0
 AND c.relreplident OPERATOR(pg_catalog.=) 'd'
 AND pg_catalog.has_table_privilege(current_user,c.oid,'SELECT')
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_rewrite r WHERE r.ev_class OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_policy q WHERE q.polrelid OPERATOR(pg_catalog.=) c.oid)
 AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attnum,a.attname::pg_catalog.text,a.atttypid::pg_catalog.int8,
 COALESCE(pg_catalog.pg_get_expr(d.adbin,d.adrelid),''),a.attnotnull) ORDER BY a.attnum)
 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid OPERATOR(pg_catalog.=) a.attrelid AND d.adnum OPERATOR(pg_catalog.=) a.attnum
 WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0) OPERATOR(pg_catalog.=) ($2::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_attribute a WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0
 AND (a.attisdropped OR NOT a.attislocal OR a.attinhcount OPERATOR(pg_catalog.<>) 0 OR a.attidentity OPERATOR(pg_catalog.<>) '' OR a.attgenerated OPERATOR(pg_catalog.<>) ''
 OR a.atthasmissing OR a.atttypmod OPERATOR(pg_catalog.<>) -1 OR a.attndims OPERATOR(pg_catalog.<>) 0 OR a.attcollation OPERATOR(pg_catalog.<>) 0))
 AND (SELECT pg_catalog.jsonb_agg(CASE WHEN k.contype OPERATOR(pg_catalog.=) 'f' THEN 'RETAINED_FK' ELSE pg_catalog.pg_get_constraintdef(k.oid) END ORDER BY (CASE WHEN k.contype OPERATOR(pg_catalog.=) 'f' THEN 'RETAINED_FK' ELSE pg_catalog.pg_get_constraintdef(k.oid) END) COLLATE pg_catalog."C")
 FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid) OPERATOR(pg_catalog.=) ($3::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid AND
 (NOT k.convalidated OR k.condeferrable OR k.condeferred OR NOT k.conislocal OR k.coninhcount OPERATOR(pg_catalog.<>) 0
 OR k.conparentid OPERATOR(pg_catalog.<>) 0 OR k.connamespace OPERATOR(pg_catalog.<>) c.relnamespace
 OR (k.contype OPERATOR(pg_catalog.=) 'c' AND k.connoinherit)))
 AND (SELECT pg_catalog.count(*) FROM pg_catalog.pg_index z WHERE z.indrelid OPERATOR(pg_catalog.=) c.oid) OPERATOR(pg_catalog.=) CASE WHEN e.name OPERATOR(pg_catalog.=) 'mil_recruit_origin' THEN 2 ELSE 1 END
 ELSE c.relkind OPERATOR(pg_catalog.=) 'i' AND am.amname OPERATOR(pg_catalog.=) 'btree'
 AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive AND i.indimmediate AND NOT i.indisexclusion
 AND NOT i.indnullsnotdistinct AND NOT i.indisreplident AND i.indexprs IS NULL
 AND i.indnkeyatts OPERATOR(pg_catalog.=) i.indnatts
 AND (SELECT pg_catalog.count(*) FROM pg_catalog.pg_constraint k WHERE k.conindid OPERATOR(pg_catalog.=) c.oid AND k.contype OPERATOR(pg_catalog.=) ANY(ARRAY['p','u']::pg_catalog."char"[]))
 OPERATOR(pg_catalog.=) 1
 AND (NOT i.indisprimary OR EXISTS(SELECT FROM pg_catalog.pg_constraint k WHERE k.conindid OPERATOR(pg_catalog.=) c.oid
 AND k.conrelid OPERATOR(pg_catalog.=) i.indrelid AND k.contype OPERATOR(pg_catalog.=) 'p'))
 AND (SELECT pg_catalog.jsonb_build_array(t.relname::pg_catalog.text,i.indkey::pg_catalog.text,i.indoption::pg_catalog.text,i.indcollation::pg_catalog.text,
 (SELECT pg_catalog.jsonb_agg(CASE WHEN op.opcnamespace OPERATOR(pg_catalog.=) 'pg_catalog'::pg_catalog.regnamespace AND op.opcmethod OPERATOR(pg_catalog.=) c.relam
 THEN op.opcname::pg_catalog.text ELSE NULL END ORDER BY z.n) FROM pg_catalog.unnest(i.indclass::pg_catalog.oid[]) WITH ORDINALITY z(oid,n)
 LEFT JOIN pg_catalog.pg_opclass op ON op.oid OPERATOR(pg_catalog.=) z.oid),i.indisprimary,COALESCE(pg_catalog.pg_get_expr(i.indpred,i.indrelid),''))
 FROM pg_catalog.pg_class t JOIN e et ON et.oid OPERATOR(pg_catalog.=) t.oid WHERE t.oid OPERATOR(pg_catalog.=) i.indrelid)
 OPERATOR(pg_catalog.=) ($4::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 END,false)) FROM p,e LEFT JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) e.oid
 LEFT JOIN pg_catalog.pg_am am ON am.oid OPERATOR(pg_catalog.=) c.relam LEFT JOIN pg_catalog.pg_index i ON i.indexrelid OPERATOR(pg_catalog.=) c.oid`

// The only allowed triggers are this reviewed RESTRICT FK's four internal RI hooks.
const freshRetainedFK = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v), ids AS (
 SELECT (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'mil_recruit_origin' OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS o,
 (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'mil_recruit_receipt' OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS r,
 (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'mil_recruit_origin_pkey' OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS pk FROM p
), f AS (SELECT k.* FROM ids JOIN pg_catalog.pg_constraint k ON k.conrelid OPERATOR(pg_catalog.=) ids.r AND k.contype OPERATOR(pg_catalog.=) 'f')
 SELECT COALESCE((SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 1 AND pg_catalog.bool_and(
 f.confrelid OPERATOR(pg_catalog.=) ids.o AND f.conkey OPERATOR(pg_catalog.=) ARRAY[1,2]::pg_catalog.int2[] AND f.confkey OPERATOR(pg_catalog.=) ARRAY[1,2]::pg_catalog.int2[]
 AND f.confupdtype OPERATOR(pg_catalog.=) 'r' AND f.confdeltype OPERATOR(pg_catalog.=) 'r' AND f.confmatchtype OPERATOR(pg_catalog.=) 's' AND f.conindid OPERATOR(pg_catalog.=) ids.pk
 AND (SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 4 AND pg_catalog.bool_and(t.tgisinternal AND t.tgconstraint OPERATOR(pg_catalog.=) f.oid
 AND t.tgenabled OPERATOR(pg_catalog.=) 'O' AND NOT t.tgdeferrable AND NOT t.tginitdeferred AND t.tgnargs OPERATOR(pg_catalog.=) 0
 AND pg_catalog.octet_length(t.tgargs) OPERATOR(pg_catalog.=) 0 AND t.tgqual IS NULL AND t.tgattr::pg_catalog.text OPERATOR(pg_catalog.=) ''
 AND t.tgparentid OPERATOR(pg_catalog.=) 0 AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
 AND ((t.tgrelid OPERATOR(pg_catalog.=) ids.o AND t.tgconstrrelid OPERATOR(pg_catalog.=) ids.r AND
 ((t.tgfoid OPERATOR(pg_catalog.=) 'pg_catalog."RI_FKey_restrict_del"'::pg_catalog.regproc AND t.tgtype OPERATOR(pg_catalog.=) 9)
 OR (t.tgfoid OPERATOR(pg_catalog.=) 'pg_catalog."RI_FKey_restrict_upd"'::pg_catalog.regproc AND t.tgtype OPERATOR(pg_catalog.=) 17)))
 OR (t.tgrelid OPERATOR(pg_catalog.=) ids.r AND t.tgconstrrelid OPERATOR(pg_catalog.=) ids.o AND
 ((t.tgfoid OPERATOR(pg_catalog.=) 'pg_catalog."RI_FKey_check_ins"'::pg_catalog.regproc AND t.tgtype OPERATOR(pg_catalog.=) 5)
 OR (t.tgfoid OPERATOR(pg_catalog.=) 'pg_catalog."RI_FKey_check_upd"'::pg_catalog.regproc AND t.tgtype OPERATOR(pg_catalog.=) 17)))))
 FROM pg_catalog.pg_trigger t WHERE t.tgrelid IN (ids.o,ids.r))) FROM ids,f),false)`
