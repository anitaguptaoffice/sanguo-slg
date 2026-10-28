package world

// Fixed spec/db/002_world.sql shapes, never supplied by an external profile.
// Columns: position/name/type OID/typmod/notnull/dropped/identity/generated/default.
const worldColumnShape = `{
 "map_cell":[[1,"server_id",23,-1,true,false,"","",""],[2,"x",23,-1,true,false,"","",""],[3,"y",23,-1,true,false,"","",""],[4,"terrain",21,-1,true,false,"","",""],[5,"resource_type",21,-1,false,false,"","",""],[6,"resource_level",21,-1,true,false,"","","0"]],
 "player_city":[[1,"server_id",23,-1,true,false,"","",""],[2,"city_id",20,-1,true,false,"","",""],[3,"player_id",20,-1,true,false,"","",""],[4,"name",1043,36,true,false,"","",""],[5,"x",23,-1,true,false,"","",""],[6,"y",23,-1,true,false,"","",""],[7,"is_capital",16,-1,true,false,"","","false"],[8,"wall_level",23,-1,true,false,"","","1"],[9,"morale",23,-1,true,false,"","","100"],[10,"created_at",1184,-1,true,false,"","","now()"]]}`
const worldConstraintShape = `{
 "map_cell":[["map_cell_pkey","p","{1,2,3}","map_cell_pkey",true]],
 "player_city":[["player_city_pkey","p","{1,2}","player_city_pkey",true],["player_city_server_id_x_y_key","u","{1,5,6}","player_city_server_id_x_y_key",true]]}`

// Indexes: table/key vector/options/collations/opclasses/unique/primary.
const worldIndexShape = `{
 "map_cell_pkey":["map_cell","1 2 3","0 0 0","0 0 0",["int4_ops","int4_ops","int4_ops"],true,true],
 "player_city_pkey":["player_city","1 2","0 0","0 0",["int4_ops","int8_ops"],true,true],
 "player_city_server_id_x_y_key":["player_city","1 5 6","0 0 0","0 0 0",["int4_ops","int4_ops","int4_ops"],true,false],
 "idx_player_city_owner":["player_city","1 3","0 0","0 0",["int4_ops","int8_ops"],false,false]}`

const freshSourceCatalog = `WITH expected AS (
 SELECT key AS name,(value OPERATOR(pg_catalog.->>) 'OID')::pg_catalog.oid AS oid,
 (value OPERATOR(pg_catalog.->>) 'OwnerOID')::pg_catalog.oid AS owner FROM pg_catalog.jsonb_each($1::pg_catalog.jsonb)
) SELECT pg_catalog.has_schema_privilege(current_user,$2::pg_catalog.oid,'USAGE') AND pg_catalog.count(*) OPERATOR(pg_catalog.=) 7 AND pg_catalog.bool_and(COALESCE(
 c.relname::pg_catalog.text COLLATE pg_catalog."C" OPERATOR(pg_catalog.=) e.name COLLATE pg_catalog."C"
 AND c.relnamespace OPERATOR(pg_catalog.=) $2::pg_catalog.oid AND c.relowner OPERATOR(pg_catalog.=) e.owner
 AND c.relpersistence OPERATOR(pg_catalog.=) 'p' AND NOT c.relispartition AND c.relpartbound IS NULL
 AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.reloptions IS NULL
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_inherits h WHERE h.inhrelid OPERATOR(pg_catalog.=) c.oid OR h.inhparent OPERATOR(pg_catalog.=) c.oid)
 AND CASE WHEN e.name OPERATOR(pg_catalog.=) 'player_city_id_seq' THEN c.relkind OPERATOR(pg_catalog.=) 'S'
 WHEN e.name OPERATOR(pg_catalog.=) ANY(ARRAY['map_cell','player_city']::pg_catalog.text[]) THEN
 c.relkind OPERATOR(pg_catalog.=) 'r' AND am.amname OPERATOR(pg_catalog.=) 'heap' AND c.reloftype OPERATOR(pg_catalog.=) 0
 AND c.relreplident OPERATOR(pg_catalog.=) 'd'
 AND pg_catalog.has_table_privilege(current_user,c.oid,'SELECT')
 AND pg_catalog.has_table_privilege(current_user,c.oid,'UPDATE')
 AND (e.name OPERATOR(pg_catalog.<>) 'player_city' OR pg_catalog.has_table_privilege(current_user,c.oid,'INSERT'))
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_trigger t WHERE t.tgrelid OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_rewrite r WHERE r.ev_class OPERATOR(pg_catalog.=) c.oid)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_policy p WHERE p.polrelid OPERATOR(pg_catalog.=) c.oid)
 AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attnum,a.attname::pg_catalog.text,a.atttypid::pg_catalog.int8,a.atttypmod,
 a.attnotnull,a.attisdropped,a.attidentity::pg_catalog.text,a.attgenerated::pg_catalog.text,
 CASE WHEN pg_catalog.pg_get_expr(d.adbin,d.adrelid) OPERATOR(pg_catalog.=) 'pg_catalog.now()' THEN 'now()'
 ELSE COALESCE(pg_catalog.pg_get_expr(d.adbin,d.adrelid),'') END) ORDER BY a.attnum)
 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid OPERATOR(pg_catalog.=) a.attrelid AND d.adnum OPERATOR(pg_catalog.=) a.attnum
 WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0)
 OPERATOR(pg_catalog.=) ($3::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND NOT EXISTS(SELECT FROM pg_catalog.pg_attribute a WHERE a.attrelid OPERATOR(pg_catalog.=) c.oid AND a.attnum OPERATOR(pg_catalog.>) 0
 AND (a.atthasmissing OR a.attcompression OPERATOR(pg_catalog.<>) '' OR a.attcollation OPERATOR(pg_catalog.<>)
 CASE WHEN a.atttypid OPERATOR(pg_catalog.=) 'pg_catalog.varchar'::pg_catalog.regtype THEN 'pg_catalog.default'::pg_catalog.regcollation::pg_catalog.oid ELSE 0 END))
 AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(k.conname::pg_catalog.text,k.contype::pg_catalog.text,k.conkey::pg_catalog.text,ix.relname::pg_catalog.text,
 k.convalidated AND NOT k.condeferrable AND NOT k.condeferred AND k.conislocal AND k.coninhcount OPERATOR(pg_catalog.=) 0
 AND k.conparentid OPERATOR(pg_catalog.=) 0 AND k.connamespace OPERATOR(pg_catalog.=) $2::pg_catalog.oid) ORDER BY k.conname)
 FROM pg_catalog.pg_constraint k LEFT JOIN pg_catalog.pg_class ix ON ix.oid OPERATOR(pg_catalog.=) k.conindid WHERE k.conrelid OPERATOR(pg_catalog.=) c.oid)
 OPERATOR(pg_catalog.=) ($4::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 AND (SELECT pg_catalog.count(*) FROM pg_catalog.pg_index z WHERE z.indrelid OPERATOR(pg_catalog.=) c.oid)
 OPERATOR(pg_catalog.=) CASE WHEN e.name OPERATOR(pg_catalog.=) 'map_cell' THEN 1 ELSE 3 END
 ELSE c.relkind OPERATOR(pg_catalog.=) 'i' AND am.amname OPERATOR(pg_catalog.=) 'btree'
 AND i.indisvalid AND i.indisready AND i.indislive AND i.indimmediate AND NOT i.indnullsnotdistinct AND NOT i.indisreplident
 AND i.indexprs IS NULL AND i.indpred IS NULL AND i.indnkeyatts OPERATOR(pg_catalog.=) i.indnatts
 AND (SELECT pg_catalog.jsonb_build_array(t.relname::pg_catalog.text,i.indkey::pg_catalog.text,i.indoption::pg_catalog.text,i.indcollation::pg_catalog.text,
 (SELECT pg_catalog.jsonb_agg(CASE WHEN op.opcnamespace OPERATOR(pg_catalog.=) 'pg_catalog'::pg_catalog.regnamespace AND op.opcmethod OPERATOR(pg_catalog.=) c.relam
 THEN op.opcname::pg_catalog.text ELSE NULL END ORDER BY v.n)
 FROM pg_catalog.unnest(i.indclass::pg_catalog.oid[]) WITH ORDINALITY v(oid,n) LEFT JOIN pg_catalog.pg_opclass op ON op.oid OPERATOR(pg_catalog.=) v.oid),i.indisunique,i.indisprimary)
 FROM pg_catalog.pg_class t JOIN expected et ON et.oid OPERATOR(pg_catalog.=) t.oid WHERE t.oid OPERATOR(pg_catalog.=) i.indrelid)
 OPERATOR(pg_catalog.=) ($5::pg_catalog.jsonb OPERATOR(pg_catalog.->) e.name)
 END,false)) FROM expected e LEFT JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) e.oid
 LEFT JOIN pg_catalog.pg_am am ON am.oid OPERATOR(pg_catalog.=) c.relam LEFT JOIN pg_catalog.pg_index i ON i.indexrelid OPERATOR(pg_catalog.=) c.oid`
