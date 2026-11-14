// Package firstcityledgerpgfinalizer is an isolated PG17 narrow rejection finalizer (not production).
package firstcityledgerpgfinalizer

import (
	"context"
	"errors"
	"fmt"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var (
	ErrUnauthorized = errors.New("firstcityledgerpgfinalizer: OID §6.12 route unauthorized (obligations)")
	errNotPending   = errors.New("firstcityledgerpgfinalizer: not PENDING or slot mismatch")
	errWhitelist    = errors.New("firstcityledgerpgfinalizer: rejection whitelist failed")
	errZeroRow      = errors.New("firstcityledgerpgfinalizer: terminal UPDATE affected 0 rows")
	errTestHold     = errors.New("firstcityledgerpgfinalizer: test hold before terminal (rollback)")
)

// FinalizerTestHook is for isolated PG17 tests only; production callers must use zero value.
type FinalizerTestHook struct {
	StopBeforeTerminalUpdate bool
	WrongCommandID           string
}

type Finalizer struct {
	Evidence firstcityledgerpgintake.ObligationEvidence
	MapX     int32
	MapY     int32
	Reason   int16 // wire rejection_reason 1 or 2 only
}

func buildableTerrain(terrain int16) bool { return terrain == 4 }

func (f *Finalizer) authorized() bool {
	if f == nil || !f.Evidence.ProfileComplete || !f.Evidence.ThroughCommitDrainOK {
		return false
	}
	for _, ok := range f.Evidence.InventoryDrainEvidence {
		if !ok {
			return false
		}
	}
	return f.Reason == 1 || f.Reason == 2
}

func (f *Finalizer) CommitRejection(ctx context.Context, pool *pgxpool.Pool, a firstcityledgerpgintake.Actor, cmd string) error {
	return f.CommitRejectionWithHook(ctx, pool, a, cmd, FinalizerTestHook{})
}

func (f *Finalizer) CommitRejectionWithHook(ctx context.Context, pool *pgxpool.Pool, a firstcityledgerpgintake.Actor, cmd string, hook FinalizerTestHook) error {
	if !f.authorized() {
		return ErrUnauthorized
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := f.applyInTx(ctx, tx, a, cmd, hook); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (f *Finalizer) applyInTx(ctx context.Context, tx pgx.Tx, a firstcityledgerpgintake.Actor, cmd string, hook FinalizerTestHook) error {
	if tx == nil || cmd == "" || a.RealmID == "" || a.ServerID <= 0 || f.MapX < 0 || f.MapY < 0 {
		return ErrUnauthorized
	}
	for _, sql := range []string{
		`LOCK TABLE account, player IN ROW SHARE MODE`,
		`LOCK TABLE world_first_city_actor_slot, world_first_city_command IN ROW EXCLUSIVE MODE`,
	} {
		if _, err := tx.Exec(ctx, sql); err != nil {
			return err
		}
	}
	var st int16
	if err := tx.QueryRow(ctx, `SELECT status FROM account WHERE account_id=$1 FOR SHARE`, a.AccountID).Scan(&st); err != nil || st != 1 {
		return ErrUnauthorized
	}
	var acct int64
	if err := tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=$1 AND player_id=$2 FOR SHARE`, a.ServerID, a.PlayerID).Scan(&acct); err != nil || acct != a.AccountID {
		return ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, a.RealmID, a.ServerID, a.PlayerID); err != nil {
		return err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`, a.RealmID, a.ServerID, a.PlayerID).Scan(&head); err != nil || head == nil || *head != cmd {
		return errNotPending
	}
	var d int16
	if err := tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR UPDATE`,
		a.RealmID, a.ServerID, a.PlayerID, cmd).Scan(&d); err != nil || d != 1 {
		return errNotPending
	}
	var terrain int16
	if err := tx.QueryRow(ctx, `SELECT terrain FROM map_cell WHERE server_id=$1 AND x=$2 AND y=$3 FOR SHARE`,
		a.ServerID, f.MapX, f.MapY).Scan(&terrain); err != nil {
		return errWhitelist
	}
	var occCity int64
	occErr := tx.QueryRow(ctx, `SELECT city_id FROM player_city WHERE server_id=$1 AND x=$2 AND y=$3 FOR SHARE`,
		a.ServerID, f.MapX, f.MapY).Scan(&occCity)
	hasOcc := occErr == nil
	if occErr != nil && !errors.Is(occErr, pgx.ErrNoRows) {
		return occErr
	}
	if !whitelistOK(f.Reason, terrain, hasOcc) {
		return errWhitelist
	}
	if hook.StopBeforeTerminalUpdate {
		return errTestHold
	}
	target := cmd
	if hook.WrongCommandID != "" {
		target = hook.WrongCommandID
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=$5
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		a.RealmID, a.ServerID, a.PlayerID, target, f.Reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return errZeroRow
	}
	return nil
}

func whitelistOK(reason int16, terrain int16, hasOcc bool) bool {
	switch reason {
	case 1:
		return !buildableTerrain(terrain)
	case 2:
		return hasOcc
	default:
		return false
	}
}

// BeginRejectionTx starts a companion §5.2 transaction for in-flight observer tests (same package tests).
func (f *Finalizer) BeginRejectionTx(ctx context.Context, pool *pgxpool.Pool, a firstcityledgerpgintake.Actor, cmd string) (pgx.Tx, error) {
	if !f.authorized() {
		return nil, ErrUnauthorized
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if err := f.applyInTx(ctx, tx, a, cmd, FinalizerTestHook{StopBeforeTerminalUpdate: true}); err != nil && !errors.Is(err, errTestHold) {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}

// FinishRejectionTx completes terminal UPDATE after a held BeginRejectionTx.
func (f *Finalizer) FinishRejectionTx(ctx context.Context, tx pgx.Tx, a firstcityledgerpgintake.Actor, cmd string) error {
	if tx == nil {
		return ErrUnauthorized
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=$5
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		a.RealmID, a.ServerID, a.PlayerID, cmd, f.Reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("firstcityledgerpgfinalizer: finish CAS failed")
	}
	return tx.Commit(ctx)
}
