// Package firstcityledgerpgphaseadmission is isolated PG17 phase admission / lease linearization (not production).
package firstcityledgerpgphaseadmission

import (
	"context"
	"errors"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var ErrUnauthorized = errors.New("firstcityledgerpgphaseadmission: route unauthorized (obligations)")

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
 admission text NOT NULL DEFAULT 'open' CHECK (admission IN ('open','closing','closed','poisoned')),
 drain text NOT NULL DEFAULT 'pending' CHECK (drain IN ('pending','unresolved','drained')), cleanup_attempts int NOT NULL DEFAULT 0)`,
		`CREATE TABLE IF NOT EXISTS harness_lease (lease_id uuid PRIMARY KEY, realm_id uuid NOT NULL REFERENCES harness_source_gate(realm_id),
 generation bigint NOT NULL, status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','ended')),
 phase text CHECK (phase IS NULL OR phase IN ('effect_begin','finalizer_begin')), ended_at timestamptz)`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			return err
		}
	}
	_, err := pool.Exec(ctx, `INSERT INTO harness_source_gate (realm_id) VALUES ($1::uuid) ON CONFLICT DO NOTHING`, realmID)
	return err
}

func (c *Controller) gateRow(ctx context.Context, tx pgx.Tx) (string, error) {
	var adm string
	err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid FOR UPDATE`, c.RealmID).Scan(&adm)
	return adm, err
}

func (c *Controller) TryAcquireAdmission(ctx context.Context, tx pgx.Tx, leaseID string, gen int64) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	adm, err := c.gateRow(ctx, tx)
	if err != nil || adm != "open" {
		return false, nil
	}
	var g int64
	if err = tx.QueryRow(ctx, `SELECT generation FROM harness_source_gate WHERE realm_id=$1::uuid`, c.RealmID).Scan(&g); err != nil || g != gen {
		return false, nil
	}
	tag, err := tx.Exec(ctx, `INSERT INTO harness_lease (lease_id,realm_id,generation,status) VALUES ($1::uuid,$2::uuid,$3,'held')`,
		leaseID, c.RealmID, gen)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) RequestClose(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	adm, err := c.gateRow(ctx, tx)
	if err != nil || adm == "poisoned" {
		return false, nil
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_source_gate SET admission='closed' WHERE realm_id=$1::uuid`, c.RealmID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) ApplyPoison(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	if _, err := c.gateRow(ctx, tx); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_source_gate SET admission='poisoned', drain='unresolved' WHERE realm_id=$1::uuid`, c.RealmID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) TryRecordBegin(ctx context.Context, tx pgx.Tx, leaseID, phase string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	adm, err := c.gateRow(ctx, tx)
	if err != nil || adm == "poisoned" {
		return false, nil
	}
	var st string
	var ph *string
	if err = tx.QueryRow(ctx, `SELECT status,phase FROM harness_lease WHERE lease_id=$1::uuid FOR UPDATE`, leaseID).Scan(&st, &ph); err != nil || st != "held" || ph != nil {
		return false, nil
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET phase=$2 WHERE lease_id=$1::uuid AND status='held' AND phase IS NULL`, leaseID, phase)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) EndLease(ctx context.Context, tx pgx.Tx, leaseID string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	if _, err := c.gateRow(ctx, tx); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET status='ended', ended_at=now() WHERE lease_id=$1::uuid AND status='held'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

func (c *Controller) IllegalCheckThenBegin(ctx context.Context, tx pgx.Tx, leaseID string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	var adm string
	if err := tx.QueryRow(ctx, `SELECT admission FROM harness_source_gate WHERE realm_id=$1::uuid`, c.RealmID).Scan(&adm); err != nil || adm != "open" {
		return false, nil
	}
	tag, err := tx.Exec(ctx, `UPDATE harness_lease SET phase='finalizer_begin' WHERE lease_id=$1::uuid AND status='held'`, leaseID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

