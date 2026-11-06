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

var errReturnCatalog = errors.New("march: return catalog unavailable")
var returnNames = [...]string{"march_order", "march_order_pkey", "idx_march_arrive", "idx_march_return", "field_army", "field_army_pkey", "idx_field_army_owner", "army_troop", "army_troop_pkey"}

// Only the fixed nine-object projection: no pins, business SQL, enrollment,
// retirement, lifecycle or complete 23-object source validation. Caller owns end.
func validateReturnCatalog(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile) error {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || a == nil || b == nil || strings.HasPrefix(p.SchemaName, "pg_") || p.SchemaName == "information_schema" {
		return errReturnCatalog
	}
	for _, name := range []string{p.DatabaseName, p.SchemaName, p.CurrentRoleName, p.SessionRoleName, p.ClusterRef, p.EvidenceRef} {
		if !utf8.ValidString(name) || strings.ContainsRune(name, 0) {
			return errReturnCatalog
		}
	}
	objects := make(map[string]freshsource.ObjectIdentity, len(returnNames))
	seen := make(map[uint32]bool, len(returnNames))
	for _, name := range returnNames {
		v, ok := p.Objects[name]
		if !ok || seen[v.OID] {
			return errReturnCatalog
		}
		objects[name], seen[v.OID] = v, true
	}
	p.Objects = objects
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
		return errReturnCatalog
	}
	if err = copyAccess.Scan(ctx, b, returnCatalogSQL, []any{data, returnColumns, returnChecks, returnIndexes}, &valid); err != nil {
		return err
	}
	if !valid {
		return errReturnCatalog
	}
	return nil
}

// Reviewed 004_military + m4_009: attnum/name/type/default/not-null/dimensions.
const returnColumns = `{
 "march_order":[[1,"server_id",23,"",true,0],[2,"march_id",20,"",true,0],[3,"army_id",20,"",true,0],[4,"from_x",23,"",true,0],[5,"from_y",23,"",true,0],[6,"to_x",23,"",true,0],[7,"to_y",23,"",true,0],[8,"purpose",21,"",true,0],[9,"depart_at",1184,"",true,0],[10,"arrive_at",1184,"",true,0],[11,"status",21,"1",true,0],[12,"path",3802,"'[]'::jsonb",true,0],[13,"origin_city_id",20,"",false,0],[14,"return_finish_at",1184,"",false,0]],
 "field_army":[[1,"server_id",23,"",true,0],[2,"army_id",20,"",true,0],[3,"owner_player_id",20,"",true,0],[4,"status",21,"1",true,0],[5,"x",23,"",true,0],[6,"y",23,"",true,0],[7,"hero_ids",1016,"'{}'::bigint[]",true,1],[8,"updated_at",1184,"now()",true,0]],
 "army_troop":[[1,"server_id",23,"",true,0],[2,"army_id",20,"",true,0],[3,"unit_cfg_id",23,"",true,0],[4,"count",23,"0",true,0]]}`
const returnChecks = `{
 "march_order":{"march_order_pkey":"PRIMARY KEY (server_id, march_id)"},
 "field_army":{"field_army_pkey":"PRIMARY KEY (server_id, army_id)"},
 "army_troop":{"army_troop_pkey":"PRIMARY KEY (server_id, army_id, unit_cfg_id)","army_troop_count_check":"CHECK ((count >= 0))"}}`
const returnIndexes = `{
 "march_order_pkey":["march_order","1 2","0 0","0 0",["int4_ops","int8_ops"],true,""],
 "idx_march_arrive":["march_order","1 11 10","0 0 0","0 0 0",["int4_ops","int2_ops","timestamptz_ops"],false,"(status = 1)"],
 "idx_march_return":["march_order","1 11 14","0 0 0","0 0 0",["int4_ops","int2_ops","timestamptz_ops"],false,"(status = 3)"],
 "field_army_pkey":["field_army","1 2","0 0","0 0",["int4_ops","int8_ops"],true,""],
 "idx_field_army_owner":["field_army","1 3","0 0","0 0",["int4_ops","int8_ops"],false,""],
 "army_troop_pkey":["army_troop","1 2 3","0 0 0","0 0 0",["int4_ops","int8_ops","int4_ops"],true,""]}`

const returnCatalogSQL = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v), e AS (
 SELECT key AS name,(value OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS oid,
 (value OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS owner FROM p,pg_catalog.jsonb_each(v OPERATOR(pg_catalog.->) 'Objects')
) SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 9 AND pg_catalog.bool_and(COALESCE(
 c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) e.name COLLATE pg_catalog."C"
 AND c.relnamespace OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SchemaOID')::pg_catalog.oid
 AND c.relowner OPERATOR(pg_catalog.=) e.owner AND c.relpersistence OPERATOR(pg_catalog.=) 'p'
 AND NOT c.relispartition AND c.relpartbound IS NULL AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.reloptions IS NULL
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_inherits h WHERE h.inhrelid OPERATOR(pg_catalog.=) c.oid OR h.inhparent OPERATOR(pg_catalog.=) c.oid)
 AND CASE WHEN e.name OPERATOR(pg_catalog.=) ANY(ARRAY['march_order','field_army','army_troop']::pg_catalog.text[]) THEN
 c.relkind OPERATOR(pg_catalog.=) 'r' AND am.amname OPERATOR(pg_catalog.=) 'heap' AND c.reloftype OPERATOR(pg_catalog.=) 0
 AND c.relreplident OPERATOR(pg_catalog.=) 'd'
 AND pg_catalog.has_table_privilege(current_user,c.oid,'SELECT') AND pg_catalog.has_table_privilege(current_user,c.oid,'UPDATE')
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_trigger t WHERE t.tgrelid OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_rewrite r WHERE r.ev_class OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_policy q WHERE q.polrelid OPERATOR(pg_catalog.=) c.oid)
 AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attnum,a.attname::pg_catalog.text,a.atttypid::pg_catalog.int8,
 COALESCE(pg_catalog.pg_get_expr(d.adbin,d.adrelid),''),a.attnotnull,a.attndims) ORDER BY a.attnum)
 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid OPERATOR(pg_catalog.=) a.attrelid AND d.adnum OPERATOR(pg_catalog.=) a.attnum
 WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0) OPERATOR(pg_catalog.=) ($2::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_attribute a WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0
 AND (a.attisdropped OR NOT a.attislocal OR a.attinhcount OPERATOR(pg_catalog.<>) 0 OR a.attidentity OPERATOR(pg_catalog.<>) '' OR a.attgenerated OPERATOR(pg_catalog.<>) ''
 OR a.atthasmissing OR a.atttypmod OPERATOR(pg_catalog.<>) -1 OR a.attcollation OPERATOR(pg_catalog.<>) 0))
 AND (SELECT pg_catalog.jsonb_object_agg(k.conname::pg_catalog.text,pg_catalog.pg_get_constraintdef(k.oid))
 FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid) OPERATOR(pg_catalog.=) ($3::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid AND
 (NOT k.convalidated OR k.condeferrable OR k.condeferred OR NOT k.conislocal OR k.coninhcount OPERATOR(pg_catalog.<>) 0
 OR k.conparentid OPERATOR(pg_catalog.<>) 0 OR k.connamespace OPERATOR(pg_catalog.<>) c.relnamespace
 OR (k.contype OPERATOR(pg_catalog.=) 'c' AND k.connoinherit)))
 AND (SELECT pg_catalog.count(*) FROM pg_catalog.pg_index z WHERE z.indrelid OPERATOR(pg_catalog.=) c.oid)
 OPERATOR(pg_catalog.=) CASE WHEN e.name OPERATOR(pg_catalog.=) 'march_order' THEN 3 WHEN e.name OPERATOR(pg_catalog.=) 'field_army' THEN 2 ELSE 1 END
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
