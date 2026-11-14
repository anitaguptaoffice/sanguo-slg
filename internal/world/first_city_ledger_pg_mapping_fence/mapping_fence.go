package firstcityledgerpgmappingfence

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var (
	ErrUnauthorized = errors.New("firstcityledgerpgmappingfence: route unauthorized (obligations)")
	ErrHeadConflict = errors.New("firstcityledgerpgmappingfence: head/predecessor conflict")
)

// MappingColumns holds optional physical mapping fields for disposable harness rows.
type MappingColumns struct {
	LedgerNamespace       *string
	ClusterID             *string
	DatabaseName          *string
	SchemaName            *string
	ShardActorDomain      *string
	CityQueueAllocator    *string
	AccountBindingAuthority *string
	WriterAuthority       *string
	MappingRowValid       bool
	ContinuousFenceOK     bool
}

// Controller gates mapping/fence-gated intake; default fail-closed without obligation evidence.
type Controller struct {
	Evidence firstcityledgerpgintake.ObligationEvidence
	RealmID  string
	ServerID int32
	PlayerID int64
}

func (c *Controller) authorized() bool {
	if c == nil || c.RealmID == "" || c.ServerID <= 0 || c.PlayerID <= 0 {
		return false
	}
	ev := c.Evidence
	if !ev.ProfileComplete || !ev.ThroughCommitDrainOK {
		return false
	}
	for _, ok := range ev.InventoryDrainEvidence {
		if !ok {
			return false
		}
	}
	return true
}

func BindingAuthority(serverID int32, playerID, accountID int64) string {
	return fmt.Sprintf("server:%d:player:%d:account:%d", serverID, playerID, accountID)
}

func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return ErrUnauthorized
	}
	_, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_mapping_fence_realm (realm_id uuid PRIMARY KEY,ledger_namespace text,
 cluster_id text,database_name text,schema_name text,shard_actor_domain text,city_queue_allocator text,account_binding_authority text,
 writer_authority text,mapping_row_valid bool NOT NULL DEFAULT true,continuous_fence_ok bool NOT NULL DEFAULT true)`)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS harness_mapping_proposal (
 command_id uuid PRIMARY KEY, city_name text NOT NULL, map_x int, map_y int)`)
	return err
}

func (c *Controller) WriteMapping(ctx context.Context, pool *pgxpool.Pool, m MappingColumns) error {
	if pool == nil || !c.authorized() {
		return ErrUnauthorized
	}
	_, err := pool.Exec(ctx, `INSERT INTO harness_mapping_fence_realm (realm_id,ledger_namespace,cluster_id,database_name,schema_name,
 shard_actor_domain,city_queue_allocator,account_binding_authority,writer_authority,mapping_row_valid,continuous_fence_ok)
 VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
 ON CONFLICT (realm_id) DO UPDATE SET
 ledger_namespace=EXCLUDED.ledger_namespace,cluster_id=EXCLUDED.cluster_id,database_name=EXCLUDED.database_name,
 schema_name=EXCLUDED.schema_name,shard_actor_domain=EXCLUDED.shard_actor_domain,
 city_queue_allocator=EXCLUDED.city_queue_allocator,account_binding_authority=EXCLUDED.account_binding_authority,
 writer_authority=EXCLUDED.writer_authority,mapping_row_valid=EXCLUDED.mapping_row_valid,
 continuous_fence_ok=EXCLUDED.continuous_fence_ok`,
		c.RealmID, m.LedgerNamespace, m.ClusterID, m.DatabaseName, m.SchemaName, m.ShardActorDomain,
		m.CityQueueAllocator, m.AccountBindingAuthority, m.WriterAuthority, m.MappingRowValid, m.ContinuousFenceOK)
	return err
}

// WriteFullMapping seeds a complete disposable mapping row for the current database/schema (test sessions only).
func (c *Controller) WriteFullMapping(ctx context.Context, pool *pgxpool.Pool, acct int64, schemaName string) error {
	var dbName string
	if err := pool.QueryRow(ctx, `SELECT current_database()`).Scan(&dbName); err != nil {
		return err
	}
	ns, cluster, sh, alloc, w := "harness-ledger-ns", "harness-cluster-1", "shard:1:actor:42", "harness-city-queue-alloc", "harness-writer-v1"
	bind := BindingAuthority(c.ServerID, c.PlayerID, acct)
	return c.WriteMapping(ctx, pool, MappingColumns{
		LedgerNamespace: &ns, ClusterID: &cluster, DatabaseName: &dbName, SchemaName: &schemaName,
		ShardActorDomain: &sh, CityQueueAllocator: &alloc, AccountBindingAuthority: &bind, WriterAuthority: &w,
		MappingRowValid: true, ContinuousFenceOK: true,
	})
}

func canonicalPayload(name string, x, y int) (c1, fct1, sha string) {
	body := append([]byte{0x01}, []byte(name)...)
	body = append(body, byte(x&0xff), byte((x>>8)&0xff), byte(y&0xff), byte((y>>8)&0xff))
	h := sha256.Sum256(body)
	return `\x` + hex.EncodeToString(body), `\x` + strings.Repeat("00", 52), `\x` + hex.EncodeToString(h[:])
}

func (c *Controller) lineageN(ctx context.Context, tx pgx.Tx) (int, error) {
	var n int
	err := tx.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&n)
	return n, err
}

func (c *Controller) mappingFenceOK(ctx context.Context, tx pgx.Tx, acct int64) (bool, error) {
	var ns, cluster, dbName, schema, shard, alloc, bind, writer *string
	var mapValid, fenceOK bool
	err := tx.QueryRow(ctx, `SELECT ledger_namespace,cluster_id,database_name,schema_name,shard_actor_domain,
 city_queue_allocator,account_binding_authority,writer_authority,mapping_row_valid,continuous_fence_ok
 FROM harness_mapping_fence_realm WHERE realm_id=$1::uuid`, c.RealmID).Scan(
		&ns, &cluster, &dbName, &schema, &shard, &alloc, &bind, &writer, &mapValid, &fenceOK)
	if err != nil {
		return false, nil
	}
	if !mapValid || !fenceOK {
		return false, nil
	}
	for _, p := range []*string{cluster, dbName, schema, shard, alloc, bind, writer} {
		if p == nil || *p == "" {
			return false, nil
		}
	}
	var curDB, curSchema string
	if err = tx.QueryRow(ctx, `SELECT current_database(), current_schema()`).Scan(&curDB, &curSchema); err != nil {
		return false, err
	}
	if *dbName != curDB || *schema != curSchema {
		return false, nil
	}
	if *bind != BindingAuthority(c.ServerID, c.PlayerID, acct) {
		return false, nil
	}
	_ = ns
	return true, nil
}

func (c *Controller) lockSlot(ctx context.Context, tx pgx.Tx, acct int64) (*string, error) {
	if !c.authorized() {
		return nil, ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, c.RealmID, c.ServerID, c.PlayerID); err != nil {
		return nil, err
	}
	_, err := tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		c.RealmID, c.ServerID, c.PlayerID, acct)
	if err != nil {
		return nil, err
	}
	var head *string
	err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		c.RealmID, c.ServerID, c.PlayerID).Scan(&head)
	return head, err
}

// TryCommitIntake commits PENDING + head CAS when mapping and fence allow; pred nil is EMPTY-initial only.
func (c *Controller) TryCommitIntake(ctx context.Context, tx pgx.Tx, acct int64, cmdID string, pred *string, name string, x, y int) (bool, error) {
	head, err := c.lockSlot(ctx, tx, acct)
	if err != nil {
		return false, err
	}
	if pred == nil {
		if head != nil {
			return false, nil
		}
		n, err := c.lineageN(ctx, tx)
		if err != nil || n > 0 {
			return false, err
		}
		ok, err := c.mappingFenceOK(ctx, tx, acct)
		if err != nil || !ok {
			return false, err
		}
	} else if head == nil || *head != *pred {
		return false, nil
	}
	c1b, fct1, sha := canonicalPayload(name, x, y)
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,
 durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1b, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO harness_mapping_proposal VALUES ($1::uuid,$2,$3,$4)`, cmdID, name, x, y); err != nil {
		return false, err
	}
	var upd pgconn.CommandTag
	if pred == nil {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
			c.RealmID, c.ServerID, c.PlayerID, cmdID)
	} else {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id=$5::uuid`,
			c.RealmID, c.ServerID, c.PlayerID, cmdID, *pred)
	}
	if err != nil || upd.RowsAffected() != 1 {
		return false, fmt.Errorf("%w: cas head", ErrHeadConflict)
	}
	return true, nil
}

// ObserverView is an independent observer read of slot head, lineage, and proposal rows.
type ObserverView struct {
	Head           string
	DurableState   int16
	CityName       string
	CommandCount   int
	ProposalCount  int
}

func (c *Controller) Observe(ctx context.Context, pool *pgxpool.Pool, cmdID string) (ObserverView, error) {
	var v ObserverView
	if pool == nil {
		return v, ErrUnauthorized
	}
	_ = pool.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&v.Head)
	if cmdID != "" {
		if err := pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).Scan(&v.DurableState); err == nil {
			_ = pool.QueryRow(ctx, `SELECT city_name FROM harness_mapping_proposal WHERE command_id=$1::uuid`, cmdID).Scan(&v.CityName)
		}
	}
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, c.RealmID, c.ServerID, c.PlayerID).Scan(&v.CommandCount)
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM harness_mapping_proposal`).Scan(&v.ProposalCount)
	return v, nil
}

// MarkTerminal sets success terminal state (durable_state=2) on a PENDING command.
func (c *Controller) MarkTerminal(ctx context.Context, pool *pgxpool.Pool, cmdID string) error {
	if pool == nil || !c.authorized() {
		return ErrUnauthorized
	}
	tag, err := pool.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=88001,success_server_id=$2,success_player_id=$3,success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE command_id=$1::uuid AND durable_state=1`, cmdID, c.ServerID, c.PlayerID)
	if err != nil || tag.RowsAffected() != 1 {
		return fmt.Errorf("terminal update failed")
	}
	return nil
}
