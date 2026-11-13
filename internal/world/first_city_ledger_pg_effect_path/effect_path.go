// Companion §4.1–§4.3 full effect business path + §5.3 terminal races (disposable PG17 only).
package firstcityledgerpgeffectpath

import (
	"context"
	"errors"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	NotProductionRoute = true
	SuccessCityID      = int64(88001)
	cityMapAdvisoryKey = int64(1128879193)
)

var ErrUnauthorized = errors.New("firstcityledgerpgeffectpath: route unauthorized (obligations)")

// Matrix gates effect business + narrow finalizer participants; default fail-closed.
type Matrix struct {
	Evidence        firstcityledgerpgintake.ObligationEvidence
	RealmID         string
	ServerID        int32
	PlayerID        int64
	CommandID       string
	MapX, MapY      int32
	RejectionReason int16
}

func (m *Matrix) authorized() bool {
	if m == nil || m.RealmID == "" || m.ServerID <= 0 || m.PlayerID <= 0 || m.CommandID == "" {
		return false
	}
	ev := m.Evidence
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

func (m *Matrix) reason() int16 {
	if m.RejectionReason == 1 || m.RejectionReason == 2 {
		return m.RejectionReason
	}
	return 1
}

// DurableState reads committed durable_state for the command PK (independent observer).
func (m *Matrix) DurableState(ctx context.Context, pool *pgxpool.Pool) (int16, error) {
	var st int16
	err := pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID).Scan(&st)
	return st, err
}

// BizSum counts companion business rows for fixture SuccessCityID (wallet + five city-scoped).
func (m *Matrix) BizSum(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT
(SELECT count(*) FROM player_wallet WHERE server_id=$1 AND player_id=$2)+
(SELECT count(*) FROM player_city WHERE server_id=$1 AND city_id=$3)+
(SELECT count(*) FROM city_troop WHERE server_id=$1 AND city_id=$3)+
(SELECT count(*) FROM mil_city_origin WHERE server_id=$1 AND city_id=$3)+
(SELECT count(*) FROM city_production_checkpoint WHERE server_id=$1 AND city_id=$3)+
(SELECT count(*) FROM city_building WHERE server_id=$1 AND city_id=$3)`,
		m.ServerID, m.PlayerID, SuccessCityID).Scan(&n)
	return n, err
}

// LockPending acquires slot advisory, head FOR UPDATE, and command FOR UPDATE; returns durable_state.
func (m *Matrix) LockPending(ctx context.Context, tx pgx.Tx) (int16, error) {
	if !m.authorized() {
		return 0, ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`,
		m.RealmID, m.ServerID, m.PlayerID); err != nil {
		return 0, err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		m.RealmID, m.ServerID, m.PlayerID).Scan(&head); err != nil {
		return 0, err
	}
	if head == nil || *head != m.CommandID {
		return 0, ErrUnauthorized
	}
	var st int16
	err := tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR UPDATE`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID).Scan(&st)
	return st, err
}

// EffectBusiness writes companion §4.2 rows in the current transaction (no receipt).
func (m *Matrix) EffectBusiness(ctx context.Context, tx pgx.Tx) error {
	if !m.authorized() {
		return ErrUnauthorized
	}
	sid, pid, cid := m.ServerID, m.PlayerID, SuccessCityID
	if _, err := tx.Exec(ctx, `INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold)
 VALUES ($1,$2,1000,1000,1000,1000,100) ON CONFLICT DO NOTHING`, sid, pid); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, sid, pid); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1,$2)`, cityMapAdvisoryKey, 1); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM map_cell WHERE server_id=$1 AND x=$2 AND y=$3 AND terrain=4 FOR UPDATE`,
		sid, m.MapX, m.MapY); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO player_city
 (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale)
 VALUES ($1,$2,$3,'fx-city',$4,$5,true,1,100)`, sid, cid, pid, m.MapX, m.MapY); err != nil {
		return err
	}
	type stmt struct {
		sql  string
		args []any
	}
	for _, op := range []stmt{
		{`INSERT INTO mil_city_origin (server_id,city_id,owner_player_id,cohort_id,format_version,created_at)
 VALUES ($1,$2,$3,decode(repeat('01',16),'hex'),1,date_trunc('milliseconds',now() AT TIME ZONE 'UTC'))`, []any{sid, cid, pid}},
		{`INSERT INTO city_troop (server_id,city_id,unit_cfg_id,count) VALUES ($1,$2,1,0)`, []any{sid, cid}},
		{`INSERT INTO city_production_checkpoint (server_id,city_id,player_id,settled_at)
 VALUES ($1,$2,$3,date_trunc('microseconds',now()))`, []any{sid, cid, pid}},
		{`INSERT INTO city_building (server_id,city_id,slot_key,building_cfg_id,level) VALUES ($1,$2,'town_hall',1,1)`, []any{sid, cid}},
	} {
		if _, err := tx.Exec(ctx, op.sql, op.args...); err != nil {
			return err
		}
	}
	return nil
}

// EffectTerminal applies success receipt CAS (fixture city id only).
func (m *Matrix) EffectTerminal(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !m.authorized() {
		return false, ErrUnauthorized
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command
 SET durable_state=2,terminal_at=now(),success_city_id=$5,success_server_id=$2,success_player_id=$3,
 success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID, SuccessCityID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// EffectParticipant: lock, §4.2 business, success receipt, COMMIT; loser rolls back whole txn.
func (m *Matrix) EffectParticipant(ctx context.Context, tx pgx.Tx) (bool, error) {
	st, err := m.LockPending(ctx, tx)
	if err != nil || st != 1 {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	if err := m.EffectBusiness(ctx, tx); err != nil {
		return false, err
	}
	ok, err := m.EffectTerminal(ctx, tx)
	if err != nil || !ok {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

// FinalizerParticipant: lock, narrow rejection terminal, COMMIT or ROLLBACK.
func (m *Matrix) FinalizerParticipant(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !m.authorized() {
		return false, ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`,
		m.RealmID, m.ServerID, m.PlayerID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		m.RealmID, m.ServerID, m.PlayerID); err != nil {
		return false, err
	}
	var st int16
	if err := tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR UPDATE`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID).Scan(&st); err != nil || st != 1 {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	var terrain int16
	if err := tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=$1 AND x=$2 AND y=$3 FOR SHARE`,
		m.ServerID, m.MapX, m.MapY).Scan(&terrain); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=$5
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID, m.reason())
	if err != nil || tag.RowsAffected() != 1 {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	return true, tx.Commit(ctx)
}

// BeginEffectParticipant opens a tx through LockPending (opponent-open proofs).
func (m *Matrix) BeginEffectParticipant(ctx context.Context, pool *pgxpool.Pool) (pgx.Tx, error) {
	if !m.authorized() {
		return nil, ErrUnauthorized
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	st, err := m.LockPending(ctx, tx)
	if err != nil || st != 1 {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}
