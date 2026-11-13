// Companion §5.3 narrow effect vs narrow rejection finalizer concurrency (disposable PG17 only).
package firstcityledgerpgrace

import (
	"context"
	"errors"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

// SuccessCityID is the only allowed fixture city id for this card (player_city_id_seq not activated).
const SuccessCityID = int64(88001)

var ErrUnauthorized = errors.New("firstcityledgerpgrace: route unauthorized (obligations)")

// Matrix gates narrow effect/finalizer participants; default path is fail-closed without obligation evidence.
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

// DurableState reads committed durable_state for the matrix command PK (observer / spy).
func (m *Matrix) DurableState(ctx context.Context, pool *pgxpool.Pool) (int16, error) {
	var st int16
	err := pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID).Scan(&st)
	return st, err
}

// EffectParticipant runs one authorized effect transaction: slot + command locks then success terminal UPDATE.
func (m *Matrix) EffectParticipant(ctx context.Context, tx pgx.Tx) (committed bool, err error) {
	if !m.authorized() {
		return false, ErrUnauthorized
	}
	if err := m.lockEffect(ctx, tx); err != nil {
		return false, err
	}
	ok, err := m.EffectTerminal(ctx, tx)
	if err != nil || !ok {
		return false, err
	}
	return true, tx.Commit(ctx)
}

// FinalizerParticipant runs one authorized narrow finalizer transaction through rejection terminal UPDATE.
func (m *Matrix) FinalizerParticipant(ctx context.Context, tx pgx.Tx) (committed bool, err error) {
	if !m.authorized() {
		return false, ErrUnauthorized
	}
	if err := m.lockFinalizer(ctx, tx); err != nil {
		return false, err
	}
	ok, err := m.FinalizerTerminal(ctx, tx)
	if err != nil || !ok {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func (m *Matrix) lockEffect(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`,
		m.RealmID, m.ServerID, m.PlayerID); err != nil {
		return err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		m.RealmID, m.ServerID, m.PlayerID).Scan(&head); err != nil {
		return err
	}
	if head == nil || *head != m.CommandID {
		return ErrUnauthorized
	}
	var st int16
	if err := tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR UPDATE`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID).Scan(&st); err != nil {
		return err
	}
	if st != 1 {
		return ErrUnauthorized
	}
	return nil
}

func (m *Matrix) lockFinalizer(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`,
		m.RealmID, m.ServerID, m.PlayerID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT 1 FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		m.RealmID, m.ServerID, m.PlayerID); err != nil {
		return err
	}
	var st int16
	if err := tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR UPDATE`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID).Scan(&st); err != nil {
		return err
	}
	if st != 1 {
		return ErrUnauthorized
	}
	if m.MapX < 0 || m.MapY < 0 {
		return ErrUnauthorized
	}
	var terrain int16
	if err := tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=$1 AND x=$2 AND y=$3 FOR SHARE`,
		m.ServerID, m.MapX, m.MapY).Scan(&terrain); err != nil {
		return err
	}
	return nil
}

// EffectTerminal applies companion §5.3 success receipt (fixture city id only; no business rows).
func (m *Matrix) EffectTerminal(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !m.authorized() {
		return false, ErrUnauthorized
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command
 SET durable_state=2, terminal_at=now(), success_city_id=$5, success_server_id=$2,
     success_player_id=$3, success_is_capital=true, success_wall_level=1, success_morale=100
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID, SuccessCityID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// FinalizerTerminal applies companion §5.3 narrow rejection terminal UPDATE.
func (m *Matrix) FinalizerTerminal(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !m.authorized() {
		return false, ErrUnauthorized
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3, terminal_at=now(), rejection_reason=$5
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		m.RealmID, m.ServerID, m.PlayerID, m.CommandID, m.reason())
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// LockThroughCommand holds slot advisory, slot head, and command FOR UPDATE until caller COMMIT/ROLLBACK.
func (m *Matrix) LockThroughCommand(ctx context.Context, tx pgx.Tx) error {
	if !m.authorized() {
		return ErrUnauthorized
	}
	return m.lockEffect(ctx, tx)
}

// BeginEffectParticipant starts a tx through command lock (for opponent-open race proofs).
func (m *Matrix) BeginEffectParticipant(ctx context.Context, pool *pgxpool.Pool) (pgx.Tx, error) {
	if !m.authorized() {
		return nil, ErrUnauthorized
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if err := m.LockThroughCommand(ctx, tx); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}
