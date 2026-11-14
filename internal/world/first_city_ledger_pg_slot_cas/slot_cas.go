// Frozen SPEC-FIRST-CITY-LEDGER-SLOT-CAS-001 intake slot/head CAS (disposable PG17 only).
package firstcityledgerpgslotcas

import (
	"context"
	"errors"
	"time"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var (
	ErrUnauthorized = errors.New("firstcityledgerpgslotcas: route unauthorized (obligations)")
	ErrHeadConflict = firstcityledgerpgintake.ErrHeadConflict
)

// Matrix gates intake CAS participants; row evidence drives acceptance, not SQL errors alone.
type Matrix struct {
	Evidence    firstcityledgerpgintake.ObligationEvidence
	Actor       firstcityledgerpgintake.Actor
	CommandID   string
	Predecessor *string
	Payload     firstcityledgerpgintake.Payload
}

func (m *Matrix) authorized() bool {
	if m == nil || m.CommandID == "" {
		return false
	}
	a := m.Actor
	if a.RealmID == "" || a.ServerID <= 0 || a.PlayerID <= 0 || a.AccountID <= 0 {
		return false
	}
	return m.Evidence.ProfileComplete && m.Evidence.ThroughCommitDrainOK && drainOK(m.Evidence.InventoryDrainEvidence)
}

func drainOK(inv [11]bool) bool {
	for _, ok := range inv {
		if !ok {
			return false
		}
	}
	return true
}

func (m *Matrix) writer() *firstcityledgerpgintake.Writer {
	return &firstcityledgerpgintake.Writer{Evidence: m.Evidence}
}

// IntakeParticipant applies companion §3 intake and COMMIT; loser rolls back with no durable mutation.
func (m *Matrix) IntakeParticipant(ctx context.Context, tx pgx.Tx) (bool, error) {
	if !m.authorized() {
		_ = tx.Rollback(ctx)
		return false, ErrUnauthorized
	}
	err := m.writer().ApplyPendingIntake(ctx, tx, m.Actor, m.CommandID, m.Predecessor, m.Payload)
	if err != nil {
		_ = tx.Rollback(ctx)
		if errors.Is(err, firstcityledgerpgintake.ErrHeadConflict) || errors.Is(err, firstcityledgerpgintake.ErrUnauthorized) {
			return false, nil
		}
		return false, err
	}
	return true, tx.Commit(ctx)
}

// PendingCount counts durable_state=1 commands for this actor (observer).
func (m *Matrix) PendingCount(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	var n int
	a := m.Actor
	err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND durable_state=1`,
		a.RealmID, a.ServerID, a.PlayerID).Scan(&n)
	return n, err
}

// HeadCommandID reads committed slot head (empty string when NULL).
func (m *Matrix) HeadCommandID(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	var head *string
	a := m.Actor
	err := pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, a.RealmID, a.ServerID, a.PlayerID).Scan(&head)
	if err != nil || head == nil {
		return "", err
	}
	return *head, nil
}

// ObserveInvariants checks orphan head pointers and dangling PENDING without matching head (row evidence).
func (m *Matrix) ObserveInvariants(ctx context.Context, pool *pgxpool.Pool) error {
	a := m.Actor
	var orphan int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_actor_slot s
 WHERE s.realm_id=$1::uuid AND s.server_id=$2 AND s.player_id=$3 AND s.head_command_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM world_first_city_command c
  WHERE c.realm_id=s.realm_id AND c.server_id=s.server_id AND c.player_id=s.player_id
  AND c.command_id=s.head_command_id)`, a.RealmID, a.ServerID, a.PlayerID).Scan(&orphan)
	if err != nil {
		return err
	}
	if orphan != 0 {
		return errors.New("slot_cas: head must reference command row")
	}
	var dangling int
	err = pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command c
 WHERE c.realm_id=$1::uuid AND c.server_id=$2 AND c.player_id=$3 AND c.durable_state=1
 AND NOT EXISTS (SELECT 1 FROM world_first_city_actor_slot s
  WHERE s.realm_id=c.realm_id AND s.server_id=c.server_id AND s.player_id=c.player_id
  AND s.head_command_id=c.command_id)`, a.RealmID, a.ServerID, a.PlayerID).Scan(&dangling)
	if err != nil {
		return err
	}
	if dangling != 0 {
		return errors.New("slot_cas: no isolated PENDING without head")
	}
	return nil
}

// StagedIntake holds FOR UPDATE between PENDING insert and head CAS (no transient EMPTY proofs).
type StagedIntake struct {
	m  *Matrix
	tx pgx.Tx
}

// BeginStagedIntake starts §3 intake and returns after PENDING insert without advancing head.
func (m *Matrix) BeginStagedIntake(ctx context.Context, pool *pgxpool.Pool) (*StagedIntake, error) {
	if !m.authorized() {
		return nil, ErrUnauthorized
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	s := &StagedIntake{m: m, tx: tx}
	if err := s.throughPendingInsert(ctx); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return s, nil
}

func (s *StagedIntake) throughPendingInsert(ctx context.Context) error {
	m := s.m
	a := m.Actor
	if _, err := s.tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, a.RealmID, a.ServerID, a.PlayerID); err != nil {
		return err
	}
	if _, err := s.tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		a.RealmID, a.ServerID, a.PlayerID, a.AccountID); err != nil {
		return err
	}
	var head *string
	if err := s.tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`, a.RealmID, a.ServerID, a.PlayerID).Scan(&head); err != nil {
		return err
	}
	if m.Predecessor == nil {
		if head != nil {
			return ErrHeadConflict
		}
	} else if head == nil || *head != *m.Predecessor {
		return ErrHeadConflict
	}
	_, err := s.tx.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,$7,$8,$9,$10,$11,$12,$13)`,
		a.RealmID, a.ServerID, a.PlayerID, m.CommandID, a.AccountID,
		m.Payload.CanonicalC1, m.Payload.TemplateVersion, m.Payload.RulesVersion, m.Payload.CatalogVersion,
		m.Payload.ContentEncodingVersion, m.Payload.TemplateFCT1, m.Payload.ContentSHA256, time.Now().UTC())
	return err
}

// CommitHeadCAS advances head under held FOR UPDATE and commits the staged transaction.
func (s *StagedIntake) CommitHeadCAS(ctx context.Context) error {
	m := s.m
	a := m.Actor
	var tag pgconn.CommandTag
	var err error
	if m.Predecessor == nil {
		tag, err = s.tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
			a.RealmID, a.ServerID, a.PlayerID, m.CommandID)
	} else {
		tag, err = s.tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id=$5::uuid`,
			a.RealmID, a.ServerID, a.PlayerID, m.CommandID, *m.Predecessor)
	}
	if err != nil || tag.RowsAffected() != 1 {
		_ = s.tx.Rollback(ctx)
		return ErrHeadConflict
	}
	return s.tx.Commit(ctx)
}

// Rollback abandons the staged transaction.
func (s *StagedIntake) Rollback(ctx context.Context) error {
	return s.tx.Rollback(ctx)
}
