package domestic

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxQueueID int64 = 9007199254740991

var ErrQueueIdentity = errors.New("domestic: build queue allocator unavailable; maintenance required")

type queueIdentity struct {
	pool            *pgxpool.Pool
	shard           int32
	schema, role    string
	queue, sequence uint32
}

// Startup-only binding errors fence new builds, not reads or retained-job saves.
// A failed binding requires new startup wiring after authorized maintenance.
func (p *PGStore) bindQueueIdentity(ctx context.Context, sid int32) (*queueIdentity, error) {
	if p == nil {
		return nil, ErrQueueIdentity
	}
	p.queueMu.Lock()
	defer p.queueMu.Unlock()
	if p.queueBound {
		if p.queueErr != nil {
			return nil, p.queueErr
		}
		if p.queueIdentity.pool != p.Pool || p.queueIdentity.shard != sid {
			return nil, ErrQueueIdentity
		}
		return p.queueIdentity, nil
	}
	p.queueBound = true
	if p.Pool == nil || sid <= 0 {
		p.queueErr = ErrQueueIdentity
		return nil, p.queueErr
	}
	tx, err := p.Pool.Begin(ctx)
	if err == nil {
		defer func(rollback func(context.Context) error, ctx context.Context) {
			_ = rollback(ctx)
		}(tx.Rollback, context.Background())
		p.queueIdentity, err = inspectQueueIdentity(ctx, tx)
	}
	if err != nil {
		p.queueErr = fmt.Errorf("%w: %w", ErrQueueIdentity, err)
		return nil, p.queueErr
	}
	p.queueIdentity.pool, p.queueIdentity.shard = p.Pool, sid
	return p.queueIdentity, nil
}

// Catalog-first path is explicit (pg_temp would otherwise precede pg_catalog).
// Runtime resolution is captured before switching, rejecting shadows/later schemas.
func inspectQueueIdentity(ctx context.Context, tx pgx.Tx) (*queueIdentity, error) {
	b := &queueIdentity{}
	var path string
	err := tx.QueryRow(ctx, `SELECT pg_catalog.current_schema(), current_user,
 pg_catalog.current_setting('search_path'), pg_catalog.to_regclass('work_queue')::pg_catalog.oid,
 pg_catalog.to_regclass('work_queue_id_seq')::pg_catalog.oid`).Scan(&b.schema, &b.role, &path, &b.queue, &b.sequence)
	if err != nil {
		return nil, err
	}
	if b.schema == "information_schema" || strings.HasPrefix(b.schema, "pg_") {
		return nil, ErrQueueIdentity
	}
	if _, err = tx.Exec(ctx, `SELECT pg_catalog.set_config('search_path','pg_catalog, pg_temp',true)`); err != nil {
		return nil, err
	}
	var valid bool
	if err = tx.QueryRow(ctx, queueIdentityMetadata, b.schema, b.queue, b.sequence, maxQueueID).Scan(&valid); err != nil {
		return nil, err
	}
	if !valid {
		return nil, ErrQueueIdentity
	}
	if _, err = tx.Exec(ctx, `SELECT pg_catalog.set_config('search_path',$1,true)`, path); err != nil {
		return nil, err
	}
	return b, nil
}

func (p *PGStore) allocateQueueID(ctx context.Context, tx pgx.Tx, binding *queueIdentity) (int64, error) {
	if p.Pool != binding.pool {
		return 0, ErrQueueIdentity
	}
	actual, err := inspectQueueIdentity(ctx, tx)
	if err != nil {
		return 0, fmt.Errorf("%w: %w", ErrQueueIdentity, err)
	}
	if actual.schema != binding.schema || actual.role != binding.role || actual.queue != binding.queue || actual.sequence != binding.sequence {
		return 0, ErrQueueIdentity
	}
	var id int64
	// Identifier quoting is supplied by pgx, never string-interpolated caller data.
	name := pgx.Identifier{binding.schema, "work_queue_id_seq"}.Sanitize()
	err = tx.QueryRow(ctx, `SELECT pg_catalog.nextval($1::pg_catalog.regclass)`, name).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("%w: %w", ErrQueueIdentity, err)
	}
	if id <= 0 || id > maxQueueID {
		return 0, ErrQueueIdentity
	}
	return id, nil
}

// Read-only counterpart of the approved migration's source/allocator checks.
// No ownership/ACL/config repair, retained-highwater inference, or runtime DDL.
const queueIdentityMetadata = `SELECT EXISTS (
 SELECT FROM pg_class q JOIN pg_namespace n ON n.oid=q.relnamespace
 JOIN pg_am am ON am.oid=q.relam
 JOIN pg_class s ON s.relnamespace=n.oid AND s.relname='work_queue_id_seq'
 JOIN pg_sequence seq ON seq.seqrelid=s.oid
 WHERE n.nspname=$1 AND q.oid=$2 AND s.oid=$3 AND q.relname='work_queue'
 AND q.relowner<>'pg_database_owner'::regrole
 AND (n.nspowner=q.relowner OR (n.nspname='public' AND n.nspowner='pg_database_owner'::regrole
  AND EXISTS(SELECT FROM pg_database WHERE datname=current_database() AND datdba=q.relowner)))
 AND q.relkind='r' AND q.relpersistence='p' AND am.amname='heap' AND q.reloftype=0
 AND NOT q.relispartition AND NOT q.relrowsecurity AND NOT q.relforcerowsecurity
 AND NOT EXISTS(SELECT FROM pg_inherits WHERE inhrelid=q.oid OR inhparent=q.oid)
 AND NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid=q.oid)
 AND NOT EXISTS(SELECT FROM pg_policy WHERE polrelid=q.oid)
 AND NOT EXISTS(SELECT FROM pg_rewrite WHERE ev_class=q.oid)
 AND has_schema_privilege(n.oid,'USAGE') AND has_table_privilege(q.oid,'SELECT')
 AND has_table_privilege(q.oid,'INSERT') AND has_table_privilege(q.oid,'DELETE')
 AND s.relkind='S' AND s.relpersistence='p' AND s.relowner=q.relowner
 AND NOT EXISTS(SELECT FROM pg_depend WHERE classid='pg_class'::regclass AND objid=s.oid AND deptype IN ('a','i','e'))
 AND has_sequence_privilege(s.oid,'SELECT') AND has_sequence_privilege(s.oid,'USAGE')
 AND seq.seqtypid='int8'::regtype AND seq.seqstart=1 AND seq.seqincrement=1 AND seq.seqmin=1
 AND seq.seqmax=$4 AND seq.seqcache=1 AND NOT seq.seqcycle
 AND (SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=q.oid AND a.attnum>0)
  = ARRAY['server_id','queue_id','player_id','city_id','queue_type','payload','start_at','finish_at','status']
 AND (SELECT array_agg(a.atttypid ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=q.oid AND a.attnum>0)
  = ARRAY['int4'::regtype::oid,'int8'::regtype::oid,'int8'::regtype::oid,'int8'::regtype::oid,
   'int2'::regtype::oid,'jsonb'::regtype::oid,'timestamptz'::regtype::oid,'timestamptz'::regtype::oid,'int2'::regtype::oid]
 AND (SELECT array_agg(a.attnotnull ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=q.oid AND a.attnum>0)
  = ARRAY[true,true,true,false,true,true,true,true,true]
 AND (SELECT array_agg(pg_get_expr(d.adbin,d.adrelid) ORDER BY a.attnum)
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=q.oid AND a.attnum>0)
  IS NOT DISTINCT FROM ARRAY[NULL,NULL,NULL,NULL,NULL,'''{}''::jsonb',NULL,NULL,'0']::text[]
 AND NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=q.oid AND attnum>0 AND
  (attisdropped OR attidentity<>'' OR attgenerated<>'' OR atttypmod<>-1 OR attndims<>0 OR attcollation<>0 OR NOT attislocal OR attinhcount<>0))
 AND (SELECT count(*) FROM pg_constraint WHERE conrelid=q.oid)=1
 AND EXISTS(SELECT FROM pg_constraint pk JOIN pg_index x ON x.indexrelid=pk.conindid
  JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_am ia ON ia.oid=i.relam
  WHERE pk.conrelid=q.oid AND pk.contype='p' AND pk.conkey=ARRAY[1,2]::smallint[]
  AND NOT pk.condeferrable AND NOT pk.condeferred AND pk.convalidated AND pk.conislocal
  AND pk.coninhcount=0 AND pk.connamespace=n.oid AND x.indrelid=q.oid AND i.relnamespace=n.oid
  AND i.relkind='i' AND i.relpersistence='p' AND ia.amname='btree'
  AND x.indisprimary AND x.indisunique AND x.indimmediate AND x.indisvalid AND x.indisready AND x.indislive
  AND NOT x.indisexclusion AND NOT x.indnullsnotdistinct AND x.indpred IS NULL AND x.indexprs IS NULL
  AND x.indnkeyatts=2 AND x.indnatts=2 AND x.indkey::text='1 2'
  AND NOT EXISTS(SELECT FROM unnest(x.indclass::oid[]) WITH ORDINALITY op(id,n)
   JOIN pg_opclass oc ON oc.oid=op.id WHERE NOT oc.opcdefault
   OR oc.opcintype<>(ARRAY['int4'::regtype::oid,'int8'::regtype::oid])[op.n::integer]
   OR oc.opcnamespace<>'pg_catalog'::regnamespace)
  AND NOT EXISTS(SELECT FROM unnest(x.indoption::smallint[]) opt WHERE opt<>0)
  AND NOT EXISTS(SELECT FROM unnest(x.indcollation::oid[]) coll WHERE coll<>0))
)`
