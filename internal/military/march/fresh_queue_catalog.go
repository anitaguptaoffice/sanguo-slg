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

var errFreshMilitaryQueue = errors.New("march: fresh military queue metadata unavailable")
var freshQueueNames = [...]string{"work_queue", "work_queue_pkey", "idx_work_queue_due", "idx_work_queue_player"}

// Partial read-only queue metadata check, not source enrollment or initialization.
// Sequence, retained pair, external provenance and APP admission remain separate.
func validateFreshMilitaryQueue(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile) error {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || a == nil || b == nil || strings.HasPrefix(p.SchemaName, "pg_") || p.SchemaName == "information_schema" {
		return errFreshMilitaryQueue
	}
	// JSON must not replace invalid bytes and silently retarget an identifier.
	for _, name := range []string{p.DatabaseName, p.SchemaName, p.CurrentRoleName, p.SessionRoleName} {
		if !utf8.ValidString(name) {
			return errFreshMilitaryQueue
		}
	}
	objects := make(map[string]freshsource.ObjectIdentity, len(freshQueueNames))
	for _, name := range freshQueueNames {
		object, ok := p.Objects[name]
		if !ok {
			return errFreshMilitaryQueue
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
		return errFreshMilitaryQueue
	}
	if err = copyAccess.Scan(ctx, b, freshQueueCatalog, []any{data, freshQueueColumns, freshQueueChecks, freshQueueIndexes}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshMilitaryQueue
	}
	return nil
}

// Fixed reviewed 003_domestic.sql shape. Nullable city_id is intentional.
const freshQueueColumns = `{"work_queue":[[1,"server_id",23,"",true],[2,"queue_id",20,"",true],[3,"player_id",20,"",true],[4,"city_id",20,"",false],[5,"queue_type",21,"",true],[6,"payload",3802,"'{}'::jsonb",true],[7,"start_at",1184,"",true],[8,"finish_at",1184,"",true],[9,"status",21,"0",true]]}`
const freshQueueChecks = `{"work_queue":{"work_queue_pkey":"PRIMARY KEY (server_id, queue_id)"}}`
const freshQueueIndexes = `{
 "work_queue_pkey":["work_queue","1 2","0 0","0 0",["int4_ops","int8_ops"],true,""],
 "idx_work_queue_due":["work_queue","1 9 8","0 0 0","0 0 0",["int4_ops","int2_ops","timestamptz_ops"],false,"(status = ANY (ARRAY[0, 1]))"],
 "idx_work_queue_player":["work_queue","1 3","0 0","0 0",["int4_ops","int8_ops"],false,""]}`

const freshQueueCatalog = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v), e AS (
 SELECT key AS name,(value OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS oid,
 (value OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS owner FROM p,pg_catalog.jsonb_each(v OPERATOR(pg_catalog.->) 'Objects')
) SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 4 AND pg_catalog.bool_and(COALESCE(
 c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) e.name COLLATE pg_catalog."C"
 AND c.relnamespace OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SchemaOID')::pg_catalog.oid
 AND c.relowner OPERATOR(pg_catalog.=) e.owner AND c.relpersistence OPERATOR(pg_catalog.=) 'p'
 AND NOT c.relispartition AND c.relpartbound IS NULL AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.reloptions IS NULL
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_inherits h WHERE h.inhrelid OPERATOR(pg_catalog.=) c.oid OR h.inhparent OPERATOR(pg_catalog.=) c.oid)
 AND CASE WHEN e.name OPERATOR(pg_catalog.=) 'work_queue' THEN
 c.relkind OPERATOR(pg_catalog.=) 'r' AND am.amname OPERATOR(pg_catalog.=) 'heap' AND c.reloftype OPERATOR(pg_catalog.=) 0
 AND c.relreplident OPERATOR(pg_catalog.=) 'd'
 AND pg_catalog.has_table_privilege(current_user,c.oid,'SELECT') AND pg_catalog.has_table_privilege(current_user,c.oid,'INSERT')
 AND pg_catalog.has_table_privilege(current_user,c.oid,'UPDATE')
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_trigger t WHERE t.tgrelid OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_rewrite r WHERE r.ev_class OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_policy q WHERE q.polrelid OPERATOR(pg_catalog.=) c.oid)
 AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attnum,a.attname::pg_catalog.text,a.atttypid::pg_catalog.int8,
 COALESCE(pg_catalog.pg_get_expr(d.adbin,d.adrelid),''),a.attnotnull) ORDER BY a.attnum)
 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid OPERATOR(pg_catalog.=) a.attrelid AND d.adnum OPERATOR(pg_catalog.=) a.attnum
 WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0) OPERATOR(pg_catalog.=) ($2::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_attribute a WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0
 AND (a.attisdropped OR NOT a.attislocal OR a.attinhcount OPERATOR(pg_catalog.<>) 0 OR a.attidentity OPERATOR(pg_catalog.<>) '' OR a.attgenerated OPERATOR(pg_catalog.<>) ''
 OR a.atthasmissing OR a.atttypmod OPERATOR(pg_catalog.<>) -1 OR a.attndims OPERATOR(pg_catalog.<>) 0 OR a.attcollation OPERATOR(pg_catalog.<>) 0))
 AND (SELECT pg_catalog.jsonb_object_agg(k.conname::pg_catalog.text,pg_catalog.pg_get_constraintdef(k.oid))
 FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid) OPERATOR(pg_catalog.=) ($3::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid AND
 (NOT k.convalidated OR k.condeferrable OR k.condeferred OR NOT k.conislocal OR k.coninhcount OPERATOR(pg_catalog.<>) 0
 OR k.conparentid OPERATOR(pg_catalog.<>) 0 OR k.connamespace OPERATOR(pg_catalog.<>) c.relnamespace
 OR (k.contype OPERATOR(pg_catalog.=) 'c' AND k.connoinherit)))
 AND (SELECT pg_catalog.count(*) FROM pg_catalog.pg_index z WHERE z.indrelid OPERATOR(pg_catalog.=) c.oid) OPERATOR(pg_catalog.=) 3
 ELSE c.relkind OPERATOR(pg_catalog.=) 'i' AND am.amname OPERATOR(pg_catalog.=) 'btree'
 AND i.indisprimary OPERATOR(pg_catalog.=) i.indisunique AND i.indisvalid AND i.indisready AND i.indislive AND i.indimmediate AND NOT i.indisexclusion
 AND NOT i.indnullsnotdistinct AND NOT i.indisreplident AND i.indexprs IS NULL
 AND i.indnkeyatts OPERATOR(pg_catalog.=) i.indnatts
 AND (SELECT pg_catalog.count(*) FROM pg_catalog.pg_constraint k WHERE k.conindid OPERATOR(pg_catalog.=) c.oid)
 OPERATOR(pg_catalog.=) CASE WHEN i.indisprimary THEN 1 ELSE 0 END
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
