package account

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

var errFreshActorFK = errors.New("account: fresh actor foreign-key metadata unavailable")

// This private read-only projection adds exact reviewed FK/RI checks to table
// checks. It is NOT complete index/identity-sequence validation or enrollment.
func validateFreshActorFK(ctx context.Context, a *recruittx.Access, b *recruittx.Binding, p freshsource.Profile) error {
	p, err := freshsource.Snapshot(p)
	if err != nil || a == nil || b == nil || ctx == nil {
		return errFreshActorFK
	}
	if _, ok := p.Objects["account_pkey"]; !ok {
		return errFreshActorFK
	}
	copyAccess := *a
	if err = validateFreshActorTables(ctx, &copyAccess, b, p); err != nil {
		return err
	}
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	var valid bool
	if err = copyAccess.Scan(ctx, b, freshActorFKCatalog, []any{data}, &valid); err != nil {
		return err
	}
	if !valid {
		return errFreshActorFK
	}
	return nil
}

const freshActorFKCatalog = `WITH p AS (SELECT $1::pg_catalog.jsonb AS v), ids AS (
 SELECT (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'account' OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS a,
 (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'player' OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS u,
 (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'account_session' OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS s,
 (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'account_pkey' OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS pk,
 (v OPERATOR(pg_catalog.->) 'Objects' OPERATOR(pg_catalog.->) 'account_pkey' OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS pkowner,
 (v OPERATOR(pg_catalog.->>) 'SchemaOID')::pg_catalog.oid AS ns FROM p
), f AS (
 SELECT k.* FROM ids JOIN pg_catalog.pg_constraint k ON k.contype OPERATOR(pg_catalog.=) 'f'
 AND (k.conrelid IN (ids.a,ids.u,ids.s) OR k.confrelid IN (ids.a,ids.u,ids.s))
) SELECT COALESCE(
 (SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 1 AND pg_catalog.bool_and(
 c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) 'account_pkey'
 AND c.relnamespace OPERATOR(pg_catalog.=) ids.ns AND c.relowner OPERATOR(pg_catalog.=) ids.pkowner
 AND c.relkind OPERATOR(pg_catalog.=) 'i' AND i.indrelid OPERATOR(pg_catalog.=) ids.a AND i.indisprimary)
 FROM ids JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) ids.pk JOIN pg_catalog.pg_index i ON i.indexrelid OPERATOR(pg_catalog.=) c.oid)
 AND (SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 2 AND pg_catalog.count(DISTINCT f.conrelid) OPERATOR(pg_catalog.=) 2 AND pg_catalog.bool_and(
 f.confrelid OPERATOR(pg_catalog.=) ids.a AND f.conindid OPERATOR(pg_catalog.=) ids.pk
 AND ((f.conrelid OPERATOR(pg_catalog.=) ids.u AND f.conkey OPERATOR(pg_catalog.=) ARRAY[3]::pg_catalog.int2[])
 OR (f.conrelid OPERATOR(pg_catalog.=) ids.s AND f.conkey OPERATOR(pg_catalog.=) ARRAY[2]::pg_catalog.int2[]))
 AND f.confkey OPERATOR(pg_catalog.=) ARRAY[1]::pg_catalog.int2[]
 AND f.confupdtype OPERATOR(pg_catalog.=) 'a' AND f.confdeltype OPERATOR(pg_catalog.=) 'a' AND f.confmatchtype OPERATOR(pg_catalog.=) 's'
 AND f.convalidated AND NOT f.condeferrable AND NOT f.condeferred AND f.conislocal
 AND f.coninhcount OPERATOR(pg_catalog.=) 0 AND f.conparentid OPERATOR(pg_catalog.=) 0 AND f.connamespace OPERATOR(pg_catalog.=) ids.ns
 AND f.conpfeqop OPERATOR(pg_catalog.=) ARRAY['pg_catalog.=(pg_catalog.int8,pg_catalog.int8)'::pg_catalog.regoperator]::pg_catalog.oid[]
 AND f.conppeqop OPERATOR(pg_catalog.=) f.conpfeqop AND f.conffeqop OPERATOR(pg_catalog.=) f.conpfeqop
 AND (SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 4
 AND pg_catalog.count(DISTINCT ROW(t.tgrelid,t.tgtype,t.tgfoid)) OPERATOR(pg_catalog.=) 4
 AND pg_catalog.bool_and(t.tgisinternal AND t.tgenabled OPERATOR(pg_catalog.=) 'O'
 AND NOT t.tgdeferrable AND NOT t.tginitdeferred AND t.tgnargs OPERATOR(pg_catalog.=) 0
 AND t.tgconstrindid OPERATOR(pg_catalog.=) ids.pk AND pg_catalog.octet_length(t.tgargs) OPERATOR(pg_catalog.=) 0
 AND t.tgqual IS NULL AND t.tgattr::pg_catalog.text OPERATOR(pg_catalog.=) ''
 AND t.tgparentid OPERATOR(pg_catalog.=) 0 AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
 AND ((t.tgrelid OPERATOR(pg_catalog.=) ids.a AND t.tgconstrrelid OPERATOR(pg_catalog.=) f.conrelid AND
 ((t.tgfoid OPERATOR(pg_catalog.=) 'pg_catalog."RI_FKey_noaction_del"'::pg_catalog.regproc AND t.tgtype OPERATOR(pg_catalog.=) 9)
 OR (t.tgfoid OPERATOR(pg_catalog.=) 'pg_catalog."RI_FKey_noaction_upd"'::pg_catalog.regproc AND t.tgtype OPERATOR(pg_catalog.=) 17)))
 OR (t.tgrelid OPERATOR(pg_catalog.=) f.conrelid AND t.tgconstrrelid OPERATOR(pg_catalog.=) ids.a AND
 ((t.tgfoid OPERATOR(pg_catalog.=) 'pg_catalog."RI_FKey_check_ins"'::pg_catalog.regproc AND t.tgtype OPERATOR(pg_catalog.=) 5)
 OR (t.tgfoid OPERATOR(pg_catalog.=) 'pg_catalog."RI_FKey_check_upd"'::pg_catalog.regproc AND t.tgtype OPERATOR(pg_catalog.=) 17)))))
 FROM pg_catalog.pg_trigger t WHERE t.tgconstraint OPERATOR(pg_catalog.=) f.oid)) FROM ids,f)
 AND (SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 8 FROM ids,pg_catalog.pg_trigger t WHERE t.tgrelid IN (ids.a,ids.u,ids.s)),false)`
