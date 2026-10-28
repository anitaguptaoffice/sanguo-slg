package domestic

// Fixed reviewed 003 wallet shape; profile supplies identity only.
const recruitWalletCatalog = `WITH expected AS (
 SELECT key AS name,(value OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS oid,
 (value OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS owner FROM pg_catalog.jsonb_each($10::pg_catalog.jsonb)
) SELECT COALESCE((SELECT pg_catalog.current_setting('server_version_num')::pg_catalog.int4 OPERATOR(pg_catalog./) 10000 OPERATOR(pg_catalog.=) 17 AND pg_catalog.current_setting('server_encoding') OPERATOR(pg_catalog.=) 'UTF8' AND (pg_catalog.current_schemas(true))[1] OPERATOR(pg_catalog.=) 'pg_catalog' AND d.datname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) $1::pg_catalog.text COLLATE pg_catalog."C" AND d.oid OPERATOR(pg_catalog.=) $2::pg_catalog.oid AND n.nspname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) $3::pg_catalog.text COLLATE pg_catalog."C" AND n.oid OPERATOR(pg_catalog.=) $4::pg_catalog.oid AND n.nspowner OPERATOR(pg_catalog.=) $5::pg_catalog.oid AND current_user::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) $6::pg_catalog.text COLLATE pg_catalog."C" AND r.oid OPERATOR(pg_catalog.=) $7::pg_catalog.oid AND session_user::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) $8::pg_catalog.text COLLATE pg_catalog."C" AND s.oid OPERATOR(pg_catalog.=) $9::pg_catalog.oid FROM pg_catalog.pg_database d, pg_catalog.pg_namespace n, pg_catalog.pg_roles r, pg_catalog.pg_roles s WHERE d.datname OPERATOR(pg_catalog.=) pg_catalog.current_database() AND n.oid OPERATOR(pg_catalog.=) $4::pg_catalog.oid AND r.rolname OPERATOR(pg_catalog.=) current_user AND s.rolname OPERATOR(pg_catalog.=) session_user),false) AND CASE WHEN EXISTS(SELECT FROM pg_catalog.pg_namespace ns WHERE ns.oid OPERATOR(pg_catalog.=) $4::pg_catalog.oid) THEN pg_catalog.has_schema_privilege(current_user,$4::pg_catalog.oid,'USAGE') ELSE false END AND pg_catalog.count(*) OPERATOR(pg_catalog.=) 2 AND pg_catalog.bool_and(COALESCE(
 c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) e.name COLLATE pg_catalog."C"
 AND c.relnamespace OPERATOR(pg_catalog.=) $4::pg_catalog.oid AND c.relowner OPERATOR(pg_catalog.=) e.owner
 AND c.relpersistence OPERATOR(pg_catalog.=) 'p' AND NOT c.relispartition AND c.relpartbound IS NULL
 AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.reloptions IS NULL
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_depend x WHERE x.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass AND x.objid OPERATOR(pg_catalog.=) c.oid AND x.deptype OPERATOR(pg_catalog.=) 'e')
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_inherits h WHERE h.inhrelid OPERATOR(pg_catalog.=) c.oid OR h.inhparent OPERATOR(pg_catalog.=) c.oid)
 AND CASE WHEN e.name OPERATOR(pg_catalog.=) 'player_wallet' THEN
 c.relkind OPERATOR(pg_catalog.=) 'r' AND am.amname OPERATOR(pg_catalog.=) 'heap' AND c.reloftype OPERATOR(pg_catalog.=) 0
 AND c.relreplident OPERATOR(pg_catalog.=) 'd'
 AND pg_catalog.has_table_privilege(current_user,c.oid,'SELECT')
 AND pg_catalog.has_table_privilege(current_user,c.oid,'UPDATE')
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_depend x WHERE x.refclassid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass AND x.refobjid OPERATOR(pg_catalog.=) c.oid AND NOT (
 (x.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_type'::pg_catalog.regclass AND x.objid OPERATOR(pg_catalog.=) c.reltype AND x.deptype OPERATOR(pg_catalog.=) 'i') OR
 (x.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_attrdef'::pg_catalog.regclass AND EXISTS(SELECT FROM pg_catalog.pg_attrdef d WHERE d.oid OPERATOR(pg_catalog.=) x.objid AND d.adrelid OPERATOR(pg_catalog.=) c.oid)) OR
 (x.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_constraint'::pg_catalog.regclass AND EXISTS(SELECT FROM pg_catalog.pg_constraint k WHERE k.oid OPERATOR(pg_catalog.=) x.objid AND k.conrelid OPERATOR(pg_catalog.=) c.oid AND k.contype OPERATOR(pg_catalog.=) 'p')) OR
 (x.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass AND EXISTS(SELECT FROM expected z WHERE z.name OPERATOR(pg_catalog.=) 'player_wallet_pkey' AND z.oid OPERATOR(pg_catalog.=) x.objid))))
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_trigger t WHERE t.tgrelid OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_rewrite r WHERE r.ev_class OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_policy p WHERE p.polrelid OPERATOR(pg_catalog.=) c.oid)
 AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attnum,a.attname::pg_catalog.text,a.atttypid::pg_catalog.int8,a.atttypmod,
 a.attnotnull,a.attisdropped,a.attidentity::pg_catalog.text,a.attgenerated::pg_catalog.text,
 CASE WHEN pg_catalog.pg_get_expr(d.adbin,d.adrelid) OPERATOR(pg_catalog.=) 'pg_catalog.now()' THEN 'now()'
 ELSE COALESCE(pg_catalog.pg_get_expr(d.adbin,d.adrelid),'') END) ORDER BY a.attnum)
 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid OPERATOR(pg_catalog.=) a.attrelid AND d.adnum OPERATOR(pg_catalog.=) a.attnum
 WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0)
 OPERATOR(pg_catalog.=) ('{"player_wallet":[[1,"server_id",23,-1,true,false,"","",""],[2,"player_id",20,-1,true,false,"","",""],[3,"food",20,-1,true,false,"","","0"],[4,"wood",20,-1,true,false,"","","0"],[5,"iron",20,-1,true,false,"","","0"],[6,"stone",20,-1,true,false,"","","0"],[7,"gold",20,-1,true,false,"","","0"],[8,"updated_at",1184,-1,true,false,"","","now()"]]}'::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_attribute a WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0
 AND (a.atthasmissing OR a.attcompression OPERATOR(pg_catalog.<>) '' OR a.attcollation OPERATOR(pg_catalog.<>)
 0))
 AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(k.conname::pg_catalog.text,k.contype::pg_catalog.text,k.conkey::pg_catalog.text,ix.relname::pg_catalog.text,
 k.convalidated AND NOT k.condeferrable AND NOT k.condeferred AND k.conislocal AND k.coninhcount OPERATOR(pg_catalog.=) 0
 AND k.conparentid OPERATOR(pg_catalog.=) 0 AND k.connamespace OPERATOR(pg_catalog.=) $4::pg_catalog.oid) ORDER BY k.conname)
 FROM pg_catalog.pg_constraint k LEFT JOIN pg_catalog.pg_class ix ON ix.oid OPERATOR(pg_catalog.=) k.conindid WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid)
 OPERATOR(pg_catalog.=) ('{"player_wallet":[["player_wallet_pkey","p","{1,2}","player_wallet_pkey",true]]}'::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND (SELECT pg_catalog.count(*) FROM pg_catalog.pg_index z WHERE z.indrelid OPERATOR(pg_catalog.=) c.oid)
 OPERATOR(pg_catalog.=) 1
 ELSE NOT EXISTS(SELECT FROM pg_catalog.pg_depend x WHERE x.refclassid OPERATOR(pg_catalog.=) 'pg_catalog.pg_class'::pg_catalog.regclass AND x.refobjid OPERATOR(pg_catalog.=) c.oid AND NOT (x.classid OPERATOR(pg_catalog.=) 'pg_catalog.pg_constraint'::pg_catalog.regclass AND EXISTS(SELECT FROM pg_catalog.pg_constraint k JOIN expected t ON t.name OPERATOR(pg_catalog.=) 'player_wallet' AND k.conrelid OPERATOR(pg_catalog.=) t.oid WHERE k.oid OPERATOR(pg_catalog.=) x.objid AND k.conindid OPERATOR(pg_catalog.=) c.oid AND k.contype OPERATOR(pg_catalog.=) 'p')))
 AND c.relkind OPERATOR(pg_catalog.=) 'i' AND am.amname OPERATOR(pg_catalog.=) 'btree'
 AND i.indisvalid AND i.indisready AND i.indislive AND i.indimmediate AND NOT i.indnullsnotdistinct AND NOT i.indisreplident
 AND i.indexprs IS NULL AND i.indpred IS NULL AND i.indnkeyatts OPERATOR(pg_catalog.=) i.indnatts
 AND (SELECT pg_catalog.jsonb_build_array(t.relname::pg_catalog.text,i.indkey::pg_catalog.text,i.indoption::pg_catalog.text,i.indcollation::pg_catalog.text,
 (SELECT pg_catalog.jsonb_agg(CASE WHEN op.opcnamespace OPERATOR(pg_catalog.=) 'pg_catalog'::pg_catalog.regnamespace AND op.opcmethod OPERATOR(pg_catalog.=) c.relam
 THEN op.opcname::pg_catalog.text ELSE NULL END ORDER BY v.n)
 FROM pg_catalog.unnest(i.indclass::pg_catalog.oid[]) WITH ORDINALITY v(oid,n) LEFT JOIN pg_catalog.pg_opclass op ON op.oid OPERATOR(pg_catalog.=) v.oid),i.indisunique,i.indisprimary)
 FROM pg_catalog.pg_class t JOIN expected et ON et.oid OPERATOR(pg_catalog.=) t.oid WHERE t.oid OPERATOR(pg_catalog.=) i.indrelid)
 OPERATOR(pg_catalog.=) ('{"player_wallet_pkey":["player_wallet","1 2","0 0","0 0",["int4_ops","int8_ops"],true,true]}'::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 END,false)) FROM expected e LEFT JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) e.oid
 LEFT JOIN pg_catalog.pg_am am ON am.oid OPERATOR(pg_catalog.=) c.relam LEFT JOIN pg_catalog.pg_index i ON i.indexrelid OPERATOR(pg_catalog.=) c.oid`
