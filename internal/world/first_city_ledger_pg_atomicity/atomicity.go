// Package firstcityledgerpgatomicity is isolated PG17 per-barrier effect-transaction atomicity (not production).
package firstcityledgerpgatomicity

import (
	"context"
	"errors"
	"fmt"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

const (
	DefaultCityID        int64 = 88001
	DefaultMapX          int32 = 10
	DefaultMapY          int32 = 20
	cityMapAdvisoryKey         = int64(1128879193)
)

var ErrUnauthorized = errors.New("firstcityledgerpgatomicity: route unauthorized (obligations)")

type Placement struct {
	CityID int64
	MapX   int32
	MapY   int32
}

// Controller gates per-barrier atomicity writers; default path is fail-closed without evidence.
type Controller struct {
	Evidence  firstcityledgerpgintake.ObligationEvidence
	RealmID   string
	ServerID  int32
	PlayerID  int64
	Placement Placement
	CmdID     string
}

func (c *Controller) authorized() bool {
	if c == nil || c.RealmID == "" || c.ServerID <= 0 || c.PlayerID <= 0 || c.CmdID == "" {
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

func (c *Controller) place() Placement {
	if c.Placement.CityID == 0 {
		return Placement{CityID: DefaultCityID, MapX: DefaultMapX, MapY: DefaultMapY}
	}
	return c.Placement
}

// InstallDisposableFixture creates mil_city_origin in the test schema only.
func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return ErrUnauthorized
	}
	_, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS mil_city_origin (
 server_id int NOT NULL CHECK (server_id>0), city_id bigint NOT NULL CHECK (city_id>0),
 owner_player_id bigint NOT NULL CHECK (owner_player_id>0),
 cohort_id bytea NOT NULL CHECK (octet_length(cohort_id)=16 AND cohort_id<>decode(repeat('00',16),'hex')),
 format_version smallint NOT NULL CHECK (format_version=1), created_at timestamptz NOT NULL,
 PRIMARY KEY (server_id,city_id))`)
	return err
}

// LockEffectRow locks slot advisory + head CAS + PENDING command (caller owns tx).
func (c *Controller) LockEffectRow(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, c.RealmID, c.ServerID, c.PlayerID); err != nil {
		return err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`, c.RealmID, c.ServerID, c.PlayerID).Scan(&head); err != nil {
		return err
	}
	if head == nil || *head != c.CmdID {
		return fmt.Errorf("firstcityledgerpgatomicity: head mismatch")
	}
	var st int16
	return tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR UPDATE`,
		c.RealmID, c.ServerID, c.PlayerID, c.CmdID).Scan(&st)
}

func (c *Controller) WalletStep(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold)
 VALUES ($1,$2,1000,1000,1000,1000,100) ON CONFLICT DO NOTHING`, c.ServerID, c.PlayerID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `SELECT 1 FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, c.ServerID, c.PlayerID)
	return err
}

func (c *Controller) WorldStep(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	pl := c.place()
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1,1)`, cityMapAdvisoryKey); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM map_cell WHERE server_id=$1 AND x=$2 AND y=$3 AND terrain=4 FOR UPDATE`,
		c.ServerID, pl.MapX, pl.MapY); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `INSERT INTO player_city
 (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale)
 VALUES ($1,$2,$3,'at-city',$4,$5,true,1,100)`, c.ServerID, pl.CityID, c.PlayerID, pl.MapX, pl.MapY)
	return err
}

func (c *Controller) MilOriginOnlyStep(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	pl := c.place()
	_, err := tx.Exec(ctx, `INSERT INTO mil_city_origin (server_id,city_id,owner_player_id,cohort_id,format_version,created_at)
 VALUES ($1,$2,$3,decode(repeat('01',16),'hex'),1,date_trunc('milliseconds',now() AT TIME ZONE 'UTC'))`,
		c.ServerID, pl.CityID, c.PlayerID)
	return err
}

func (c *Controller) MilStep(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	pl := c.place()
	if err := c.MilOriginOnlyStep(ctx, tx); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `INSERT INTO city_troop (server_id,city_id,unit_cfg_id,count) VALUES ($1,$2,1,0)`, c.ServerID, pl.CityID)
	return err
}

func (c *Controller) DomCheckpointOnlyStep(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	pl := c.place()
	_, err := tx.Exec(ctx, `INSERT INTO city_production_checkpoint (server_id,city_id,player_id,settled_at)
 VALUES ($1,$2,$3,date_trunc('microseconds',now()))`, c.ServerID, pl.CityID, c.PlayerID)
	return err
}

func (c *Controller) DomStep(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	pl := c.place()
	if err := c.DomCheckpointOnlyStep(ctx, tx); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `INSERT INTO city_building (server_id,city_id,slot_key,building_cfg_id,level)
 VALUES ($1,$2,'town_hall',1,1)`, c.ServerID, pl.CityID)
	return err
}

func (c *Controller) ReceiptStep(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	pl := c.place()
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command
 SET durable_state=2,terminal_at=now(),success_city_id=$5,success_server_id=$2,success_player_id=$3,
 success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		c.RealmID, c.ServerID, c.PlayerID, c.CmdID, pl.CityID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("firstcityledgerpgatomicity: receipt not applied")
	}
	return nil
}

// ForbiddenRejectInTxn stages rejection after business rows; harness expects ROLLBACK not COMMIT.
func (c *Controller) ForbiddenRejectInTxn(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	_, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		c.RealmID, c.ServerID, c.PlayerID, c.CmdID)
	return err
}

// RollbackBarrierTxn runs fn inside one effect tx then rolls back; caller observes pool separately.
func (c *Controller) RollbackBarrierTxn(ctx context.Context, pool *pgxpool.Pool, fn func(pgx.Tx) error) error {
	if pool == nil {
		return ErrUnauthorized
	}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	if err := c.LockEffectRow(ctx, tx); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	return tx.Rollback(ctx)
}

func (c *Controller) DurableState(ctx context.Context, pool *pgxpool.Pool) (int16, error) {
	if pool == nil {
		return 0, ErrUnauthorized
	}
	var s int16
	err := pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid`,
		c.RealmID, c.ServerID, c.PlayerID, c.CmdID).Scan(&s)
	return s, err
}

// BusinessRowSum counts wallet/city/MIL/DOM fixture rows (harness observer alignment).
func (c *Controller) BusinessRowSum(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	if pool == nil {
		return 0, ErrUnauthorized
	}
	pl := c.place()
	var n int
	err := pool.QueryRow(ctx, `SELECT
 (SELECT count(*) FROM player_wallet WHERE server_id=$1 AND player_id=$2)+
 (SELECT count(*) FROM player_city WHERE server_id=$1 AND city_id=$3)+
 (SELECT count(*) FROM city_troop WHERE server_id=$1 AND city_id=$3)+
 (SELECT count(*) FROM mil_city_origin WHERE server_id=$1 AND city_id=$3)+
 (SELECT count(*) FROM city_production_checkpoint WHERE server_id=$1 AND city_id=$3)+
 (SELECT count(*) FROM city_building WHERE server_id=$1 AND city_id=$3)`,
		c.ServerID, c.PlayerID, pl.CityID).Scan(&n)
	return n, err
}

// AssertRollbackObserver checks PENDING durable_state and zero committed business rows.
func (c *Controller) AssertRollbackObserver(ctx context.Context, pool *pgxpool.Pool) error {
	st, err := c.DurableState(ctx, pool)
	if err != nil {
		return err
	}
	if st != 1 {
		return fmt.Errorf("observer: expected durable_state=1, got %d", st)
	}
	sum, err := c.BusinessRowSum(ctx, pool)
	if err != nil {
		return err
	}
	if sum != 0 {
		return fmt.Errorf("observer: expected zero business rows, got %d", sum)
	}
	return nil
}
