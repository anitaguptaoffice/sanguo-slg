-- Included only by the manual wrappers inside their transaction/catalog path.
-- Exact PG17 constants, not a mutable reference table. No business-row audit.
WITH target AS (
    SELECT c.* FROM pg_class c WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname=:'city_origin_schema')
        AND c.relname = 'mil_city_origin'
), expected(name, definition) AS (VALUES
    ('mil_city_origin_pkey', 'PRIMARY KEY (server_id, city_id)'),
    ('mil_city_origin_server_id_check', 'CHECK ((server_id > 0))'),
    ('mil_city_origin_city_id_check', 'CHECK ((city_id > 0))'),
    ('mil_city_origin_owner_player_id_check', 'CHECK ((owner_player_id > 0))'),
    ('mil_city_origin_cohort_id_check', $$CHECK (((octet_length(cohort_id) = 16) AND (cohort_id <> decode(repeat('00'::text, 16), 'hex'::text))))$$),
    ('mil_city_origin_format_version_check', 'CHECK ((format_version = 1))'),
    ('mil_city_origin_created_at_check', $$CHECK ((isfinite(created_at) AND (created_at >= '0001-01-01 00:00:00+00'::timestamp with time zone) AND (created_at < '10000-01-01 00:00:00+00'::timestamp with time zone) AND (date_trunc('milliseconds'::text, created_at) = created_at)))$$)
)
SELECT NOT COALESCE((SELECT
    c.relkind = 'r' AND c.relpersistence = 'p' AND NOT c.relispartition
    AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND NOT c.relhassubclass
    AND NOT c.relhasrules AND c.reloptions IS NULL
    AND c.relam = (SELECT oid FROM pg_am WHERE amname = 'heap')
    AND NOT EXISTS (SELECT FROM pg_inherits WHERE inhrelid = c.oid OR inhparent = c.oid)
    AND NOT EXISTS (SELECT FROM pg_trigger WHERE tgrelid = c.oid)
    AND NOT EXISTS (SELECT FROM pg_rewrite WHERE ev_class = c.oid)
    AND NOT EXISTS (SELECT FROM pg_attrdef WHERE adrelid = c.oid)
    AND (SELECT count(*) = 6 AND bool_and(NOT attisdropped AND attnotnull AND attidentity = ''
        AND attgenerated = '' AND NOT atthasdef AND NOT atthasmissing AND atttypmod = -1 AND attndims = 0 AND attcollation = 0)
        AND array_agg(attname::text || ':' || format_type(atttypid,atttypmod) ORDER BY attnum)
            = ARRAY['server_id:integer','city_id:bigint','owner_player_id:bigint','cohort_id:bytea',
                'format_version:smallint','created_at:timestamp with time zone']
        FROM pg_attribute WHERE attrelid = c.oid AND attnum > 0)
    AND (SELECT count(*) = 7 AND count(*) FILTER (WHERE contype = 'c') = 6
        AND count(*) FILTER (WHERE contype = 'p') = 1
        AND bool_and(convalidated AND NOT condeferrable AND NOT condeferred AND conislocal
            AND coninhcount = 0 AND conparentid = 0 AND (contype <> 'c' OR NOT connoinherit))
        FROM pg_constraint WHERE conrelid = c.oid)
    AND NOT EXISTS (SELECT FROM expected e LEFT JOIN pg_constraint k
        ON k.conrelid = c.oid AND k.conname = e.name
        WHERE k.oid IS NULL OR regexp_replace(pg_get_constraintdef(k.oid), '[[:space:]]+', '', 'g')
            <> regexp_replace(e.definition, '[[:space:]]+', '', 'g'))
    AND (SELECT count(*) = 1 AND bool_and(i.indisprimary AND i.indisunique AND i.indisvalid
        AND i.indisready AND i.indislive AND i.indimmediate AND NOT i.indisexclusion
        AND i.indnkeyatts = 2 AND i.indnatts = 2 AND i.indkey::text = '1 2'
        AND i.indoption::text = '0 0' AND i.indcollation::text = '0 0'
        AND i.indexprs IS NULL AND i.indpred IS NULL AND x.reloptions IS NULL
        AND x.relam = (SELECT oid FROM pg_am WHERE amname = 'btree')
        AND i.indclass[0] = (SELECT o.oid FROM pg_opclass o JOIN pg_namespace n ON n.oid=o.opcnamespace
            WHERE n.nspname='pg_catalog' AND o.opcname='int4_ops' AND o.opcmethod=x.relam)
        AND i.indclass[1] = (SELECT o.oid FROM pg_opclass o JOIN pg_namespace n ON n.oid=o.opcnamespace
            WHERE n.nspname='pg_catalog' AND o.opcname='int8_ops' AND o.opcmethod=x.relam))
        FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=c.oid)
    FROM target c),false) AS city_origin_bad \gset
\if :city_origin_bad
    DO $$ BEGIN RAISE EXCEPTION 'city origin metadata mismatch; no repair'; END $$;
\endif
-- Observations only: maintenance role is not proof of application-role approval.
SELECT current_database() AS database_name, current_user AS maintenance_role,
    n.nspname AS schema_name, pg_get_userbyid(n.nspowner) AS schema_owner,
    c.oid AS relation_oid, pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname=:'city_origin_schema' AND c.relname='mil_city_origin';
