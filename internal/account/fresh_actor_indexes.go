package account

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

var errFreshActorIndexes = errors.New("account: actor index or identity metadata unavailable")
var freshActorIndexNames = [...]string{"account_pkey", "uq_account_login_name", "account_session_pkey", "idx_account_session_account", "player_pkey", "uq_player_account_per_server", "idx_player_account"}

// Completes fixed ACCOUNT catalog checks, but grants no actor/source authority.
// Source construction, command pins, actor locks and external provenance remain
// separate requirements. This neither reads nor allocates identity sequence IDs.
func validateFreshActorIndexes(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile) error {
	p, err := freshsource.Snapshot(p)
	if err != nil || ctx == nil || a == nil || b == nil {
		return errFreshActorIndexes
	}
	for _, name := range append(freshActorIndexNames[:], "account_account_id_seq") {
		if _, ok := p.Objects[name]; !ok {
			return errFreshActorIndexes
		}
	}
	access := *a
	if err = validateFreshActorFK(ctx, &access, b, p); err != nil {
		return err
	}
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	var valid bool
	if err = access.Scan(ctx, b, freshActorIndexCatalog, []any{data, freshActorIndexShape, freshActorConstraintShape}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshActorIndexes
	}
	if err = access.Scan(ctx, b, freshActorIdentityCatalog, []any{data}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshActorIndexes
	}
	return nil
}

// Table, primary, unique, ordered keys, collations and built-in opclasses.
const freshActorIndexShape = `{
 "account_pkey":["account",true,true,"1","0",["int8_ops"]],
 "uq_account_login_name":["account",false,true,"2","100",["text_ops"]],
 "account_session_pkey":["account_session",true,true,"1","0",["uuid_ops"]],
 "idx_account_session_account":["account_session",false,false,"2","0",["int8_ops"]],
 "player_pkey":["player",true,true,"1 2","0 0",["int4_ops","int8_ops"]],
 "uq_player_account_per_server":["player",false,true,"1 3","0 0",["int4_ops","int8_ops"]],
 "idx_player_account":["player",false,false,"3","0",["int8_ops"]]}`
const freshActorConstraintShape = `{"account":["PRIMARY KEY (account_id)"],"account_session":["FK","PRIMARY KEY (session_id)"],"player":["FK","PRIMARY KEY (server_id, player_id)"]}`

const freshActorIndexCatalog = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v), e AS (
 SELECT x.key AS name,x.value AS want,(v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) x.key OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS oid,
 (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) x.key OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS owner
 FROM p,pg_catalog.jsonb_each($2::pg_catalog.jsonb) x
) SELECT COALESCE((SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 7 AND pg_catalog.bool_and(COALESCE(
 c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) e.name COLLATE pg_catalog."C"
 AND c.relnamespace OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->>) 'SchemaOID')::pg_catalog.oid AND c.relowner OPERATOR(pg_catalog.=) e.owner
 AND c.relkind OPERATOR(pg_catalog.=) 'i' AND c.relpersistence OPERATOR(pg_catalog.=) 'p' AND c.reloptions IS NULL
 AND NOT c.relispartition AND c.relpartbound IS NULL AND am.amname OPERATOR(pg_catalog.=) 'btree'
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_inherits h WHERE h.inhrelid OPERATOR(pg_catalog.=) c.oid OR h.inhparent OPERATOR(pg_catalog.=) c.oid)
 AND i.indrelid OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) (e.want OPERATOR(pg_catalog.->>) 0) OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid
 AND i.indisprimary OPERATOR(pg_catalog.=) (e.want OPERATOR(pg_catalog.->>) 1)::pg_catalog.bool
 AND i.indisunique OPERATOR(pg_catalog.=) (e.want OPERATOR(pg_catalog.->>) 2)::pg_catalog.bool
 AND i.indisvalid AND i.indisready AND i.indislive AND i.indimmediate AND NOT i.indisexclusion
 AND NOT i.indnullsnotdistinct AND NOT i.indisreplident AND i.indexprs IS NULL AND i.indpred IS NULL
 AND i.indnkeyatts OPERATOR(pg_catalog.=) i.indnatts
 AND i.indkey::pg_catalog.text OPERATOR(pg_catalog.=) (e.want OPERATOR(pg_catalog.->>) 3)
 AND i.indcollation::pg_catalog.text OPERATOR(pg_catalog.=) (e.want OPERATOR(pg_catalog.->>) 4)
 AND 0 OPERATOR(pg_catalog.=) ALL(i.indoption::pg_catalog.int2[])
 AND (SELECT pg_catalog.jsonb_agg(CASE WHEN op.opcnamespace OPERATOR(pg_catalog.=) 'pg_catalog'::pg_catalog.regnamespace
 AND op.opcmethod OPERATOR(pg_catalog.=) c.relam THEN op.opcname::pg_catalog.text ELSE NULL END ORDER BY z.n)
 FROM pg_catalog.unnest(i.indclass::pg_catalog.oid[]) WITH ORDINALITY z(oid,n) LEFT JOIN pg_catalog.pg_opclass op ON op.oid OPERATOR(pg_catalog.=) z.oid)
 OPERATOR(pg_catalog.=) (e.want OPERATOR(pg_catalog.->) 5),false))
 FROM p,e LEFT JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) e.oid LEFT JOIN pg_catalog.pg_am am ON am.oid OPERATOR(pg_catalog.=) c.relam
 LEFT JOIN pg_catalog.pg_index i ON i.indexrelid OPERATOR(pg_catalog.=) c.oid)
 AND (SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 3 AND pg_catalog.bool_and(
 (SELECT pg_catalog.count(*) FROM pg_catalog.pg_index i WHERE i.indrelid OPERATOR(pg_catalog.=) c.oid)
 OPERATOR(pg_catalog.=) CASE WHEN x.key OPERATOR(pg_catalog.=) 'player' THEN 3 ELSE 2 END
 AND (SELECT pg_catalog.jsonb_agg(CASE WHEN k.contype OPERATOR(pg_catalog.=) 'f' THEN 'FK' ELSE pg_catalog.pg_get_constraintdef(k.oid) END
 ORDER BY (CASE WHEN k.contype OPERATOR(pg_catalog.=) 'f' THEN 'FK' ELSE pg_catalog.pg_get_constraintdef(k.oid) END) COLLATE pg_catalog."C")
 FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid) OPERATOR(pg_catalog.=) x.value
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_constraint k WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid AND
 (NOT k.convalidated OR k.condeferrable OR k.condeferred OR NOT k.conislocal OR k.coninhcount OPERATOR(pg_catalog.<>) 0
 OR k.conparentid OPERATOR(pg_catalog.<>) 0 OR k.connamespace OPERATOR(pg_catalog.<>) c.relnamespace)))
 FROM p,pg_catalog.jsonb_each($3::pg_catalog.jsonb) x,pg_catalog.pg_class c
 WHERE c.oid OPERATOR(pg_catalog.=) (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) x.key OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid),false)`

const freshActorIdentityCatalog = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v), ids AS (
 SELECT (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'account_account_id_seq' OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS seq,
 (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'account_account_id_seq' OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS owner,
 (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'account' OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS a,
 (v OPERATOR(pg_catalog.->>) 'SchemaOID')::pg_catalog.oid AS ns FROM p
) SELECT COALESCE((SELECT c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) 'account_account_id_seq'
 AND c.relnamespace OPERATOR(pg_catalog.=) ids.ns AND c.relowner OPERATOR(pg_catalog.=) ids.owner
 AND c.relkind OPERATOR(pg_catalog.=) 'S' AND c.relpersistence OPERATOR(pg_catalog.=) 'p' AND c.reloptions IS NULL AND NOT c.relispartition
 AND q.seqtypid OPERATOR(pg_catalog.=) 'pg_catalog.int8'::pg_catalog.regtype
 AND q.seqstart OPERATOR(pg_catalog.=) 1 AND q.seqincrement OPERATOR(pg_catalog.=) 1 AND q.seqmin OPERATOR(pg_catalog.=) 1
 AND q.seqmax OPERATOR(pg_catalog.=) 9223372036854775807 AND q.seqcache OPERATOR(pg_catalog.=) 1 AND NOT q.seqcycle
 AND (SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 1 AND pg_catalog.bool_and(d.deptype OPERATOR(pg_catalog.=) 'i'
 AND d.refclassid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid OPERATOR(pg_catalog.=) ids.a AND d.refobjsubid OPERATOR(pg_catalog.=) 1)
 FROM pg_catalog.pg_depend d WHERE d.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass
 AND d.objid OPERATOR(pg_catalog.=) c.oid AND d.deptype OPERATOR(pg_catalog.=) ANY(ARRAY['a','i','e']::pg_catalog."char"[]))
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_depend d WHERE d.refclassid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass
 AND d.refobjid OPERATOR(pg_catalog.=) c.oid AND d.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_attrdef'::pg_catalog.regclass)
 FROM ids JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) ids.seq JOIN pg_catalog.pg_sequence q ON q.seqrelid OPERATOR(pg_catalog.=) c.oid),false)`
