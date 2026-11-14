// Package firstcityledgerpgunknowndrain is isolated PG17 unknown drain matrix (not production).
package firstcityledgerpgunknowndrain

import (
	"context"
	"errors"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var ErrUnauthorized = errors.New("firstcityledgerpgunknowndrain: route unauthorized (obligations)")

type Controller struct {
	Evidence firstcityledgerpgintake.ObligationEvidence
	RealmID  string
}

func (c *Controller) authorized() bool {
	if c == nil || c.RealmID == "" || !c.Evidence.ProfileComplete || !c.Evidence.ThroughCommitDrainOK {
		return false
	}
	for _, ok := range c.Evidence.InventoryDrainEvidence {
		if !ok {
			return false
		}
	}
	return true
}

func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool, realmID string) error {
	if pool == nil || realmID == "" {
		return ErrUnauthorized
	}
	for _, sql := range []string{
		`CREATE TABLE IF NOT EXISTS harness_source_gate (realm_id uuid PRIMARY KEY, generation bigint NOT NULL DEFAULT 1,
 admission text NOT NULL DEFAULT 'open' CHECK (admission IN ('open','closed','poisoned')),
 drain text NOT NULL DEFAULT 'pending' CHECK (drain IN ('pending','unresolved','drained')),
 cleanup_attempts int NOT NULL DEFAULT 0, cancel_flag bool NOT NULL DEFAULT false)`,
		`CREATE TABLE IF NOT EXISTS harness_lease (lease_id uuid PRIMARY KEY, realm_id uuid NOT NULL REFERENCES harness_source_gate(realm_id),
 generation bigint NOT NULL, status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','ended')),
 ended_at timestamptz)`,
		`CREATE TABLE IF NOT EXISTS harness_command (
 command_id uuid PRIMARY KEY, realm_id uuid NOT NULL,
 ending text NOT NULL DEFAULT 'pending' CHECK (ending IN ('pending','unknown','known_success','known_reject')))`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			return err
		}
	}
	_, err := pool.Exec(ctx, `INSERT INTO harness_source_gate (realm_id) VALUES ($1::uuid) ON CONFLICT DO NOTHING`, realmID)
	return err
}

func (c *Controller) lockGate(ctx context.Context, tx pgx.Tx) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	_, err := tx.Exec(ctx, `SELECT 1 FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, c.RealmID)
	return err
}

func (c *Controller) ApplyPoison(ctx context.Context, tx pgx.Tx) (bool, error) {
	if err := c.lockGate(ctx, tx); err != nil {
		if err == ErrUnauthorized {
			return false, err
		}
		return false, nil
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_source_gate SET admission='poisoned',drain='unresolved' WHERE realm_id=$1::uuid`, c.RealmID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) RequestClose(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	var adm string
	if err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, c.RealmID).Scan(&adm); err != nil || adm == "poisoned" {
		return false, nil
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_source_gate SET admission='closed' WHERE realm_id=$1::uuid`, c.RealmID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) TryAcquireAdmission(ctx context.Context, tx pgx.Tx, leaseID string, gen int64) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	var adm string
	if err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, c.RealmID).Scan(&adm); err != nil || adm != "open" {
		return false, nil
	}
	var g int64
	if err := tx.QueryRow(ctx, `SELECT generation FROM harness_source_gate WHERE realm_id=$1::uuid`, c.RealmID).Scan(&g); err != nil || g != gen {
		return false, nil
	}
	tag, err := tx.Exec(ctx, `INSERT INTO harness_lease (lease_id,realm_id,generation) VALUES ($1::uuid,$2::uuid,$3)`, leaseID, c.RealmID, gen)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) WriteReceipt(ctx context.Context, tx pgx.Tx, cmdID string, durable int16, ending string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	if err := c.lockGate(ctx, tx); err != nil {
		return false, err
	}
	var sql string
	switch durable {
	case 2:
		sql = `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=9001,success_server_id=server_id,success_player_id=player_id,
 success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1::uuid AND command_id=$2::uuid AND durable_state=1`
	case 3:
		sql = `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE realm_id=$1::uuid AND command_id=$2::uuid AND durable_state=1`
	default:
		return false, nil
	}
	tag, err := tx.Exec(ctx, sql, c.RealmID, cmdID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	tag, err = tx.Exec(ctx, `UPDATE harness_command SET ending=$2 WHERE command_id=$1::uuid`, cmdID, ending)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) MarkCommandUnknown(ctx context.Context, tx pgx.Tx, cmdID string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_command SET ending='unknown' WHERE command_id=$1::uuid`, cmdID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) TryDeclareDrained(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	var adm string
	var gen int64
	if err := tx.QueryRow(ctx, `SELECT admission,generation FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, c.RealmID).
		Scan(&adm, &gen); err != nil || adm != "closed" {
		return false, nil
	}
	var n int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM harness_lease WHERE realm_id=$1::uuid AND generation=$2 AND status='held'`, c.RealmID, gen).Scan(&n); err != nil || n > 0 {
		return false, nil
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM harness_command WHERE realm_id=$1::uuid AND ending IN ('pending','unknown')`, c.RealmID).Scan(&n); err != nil || n > 0 {
		return false, nil
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_source_gate SET generation=generation+1,admission='open',drain='pending' WHERE realm_id=$1::uuid`, c.RealmID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) LocalReleaseLease(ctx context.Context, tx pgx.Tx, leaseID string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET status='ended',ended_at=now() WHERE lease_id=$1::uuid AND status='held'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) BumpLocalCleanup(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_source_gate SET cleanup_attempts=cleanup_attempts+1,cancel_flag=true WHERE realm_id=$1::uuid`, c.RealmID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

type GateSnapshot struct {
	Admission       string
	Drain           string
	Generation      int64
	CleanupAttempts int
}

func (c *Controller) ReadGate(ctx context.Context, pool *pgxpool.Pool) (GateSnapshot, error) {
	var g GateSnapshot
	if pool == nil || c == nil {
		return g, ErrUnauthorized
	}
	err := pool.QueryRow(ctx, `SELECT admission,drain,generation,cleanup_attempts FROM harness_source_gate WHERE realm_id=$1::uuid`, c.RealmID).
		Scan(&g.Admission, &g.Drain, &g.Generation, &g.CleanupAttempts)
	return g, err
}
