// Frozen SPEC-FIRST-CITY-LEDGER-ID-CONTENT-CONFLICT-001: same-PK content vs command labels on disposable PG17.
package firstcityledgerpgidcontentconflict

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var ErrUnauthorized = errors.New("firstcityledgerpgidcontentconflict: route unauthorized (obligations)")

// Frozen harness response labels.
const (
	LabelIDContentConflict = "ID_CONTENT_CONFLICT"
	LabelCommand           = "COMMAND"
	LabelHeadConflict      = "HEAD_CONFLICT"
	LabelNotObserved       = "NOT_OBSERVED"
)

type (
	ObligationEvidence = firstcityledgerpgintake.ObligationEvidence
	Actor              = firstcityledgerpgintake.Actor
	Payload            = firstcityledgerpgintake.Payload
)

// RowSnap is committed row evidence (not return labels).
type RowSnap struct {
	C1Hex, FCT1Hex, TemplateVersion, ReceivedAt, Head string
	DurableState                                      int16
}

// Matrix is one submit/continue participant for the frozen matrix.
type Matrix struct {
	Evidence    ObligationEvidence
	Actor       Actor
	CommandID   string
	Predecessor *string
	Payload     Payload
}

func FullObligationEvidence() ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return ObligationEvidence{
		ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true,
	}
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

// SubmitOnce runs companion submit ordering on an independent connection.
func (m *Matrix) SubmitOnce(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return "", err
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		return "", err
	}
	label, _, err := m.submit(ctx, tx)
	return label, err
}

func (m *Matrix) submit(ctx context.Context, tx pgx.Tx) (label string, committed bool, err error) {
	if !m.authorized() {
		_ = tx.Rollback(ctx)
		return "", false, ErrUnauthorized
	}
	a := m.Actor
	if _, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, a.RealmID, a.ServerID, a.PlayerID); err != nil {
		return "", false, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		a.RealmID, a.ServerID, a.PlayerID, a.AccountID); err != nil {
		return "", false, err
	}
	var existing []byte
	err = tx.QueryRow(ctx, `SELECT canonical_c1 FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR SHARE`,
		a.RealmID, a.ServerID, a.PlayerID, m.CommandID).Scan(&existing)
	if err == nil {
		if bytes.Equal(existing, m.Payload.CanonicalC1) {
			return LabelCommand, false, tx.Rollback(ctx)
		}
		return LabelIDContentConflict, false, tx.Rollback(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", false, err
	}
	var head *string
	if err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`, a.RealmID, a.ServerID, a.PlayerID).Scan(&head); err != nil {
		return "", false, err
	}
	if m.Predecessor == nil {
		if head != nil {
			return LabelHeadConflict, false, tx.Rollback(ctx)
		}
	} else if head == nil || *head != *m.Predecessor {
		return LabelHeadConflict, false, tx.Rollback(ctx)
	}
	p := m.Payload
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,$7,$8,$9,$10,$11,$12,$13)`,
		a.RealmID, a.ServerID, a.PlayerID, m.CommandID, a.AccountID,
		p.CanonicalC1, p.TemplateVersion, p.RulesVersion, p.CatalogVersion,
		p.ContentEncodingVersion, p.TemplateFCT1, p.ContentSHA256, time.Now().UTC())
	if err != nil || tag.RowsAffected() != 1 {
		return "", false, tx.Rollback(ctx)
	}
	var upd pgconn.CommandTag
	if m.Predecessor == nil {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
			a.RealmID, a.ServerID, a.PlayerID, m.CommandID)
	} else {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND (head_command_id IS NULL OR head_command_id=$5::uuid)`,
			a.RealmID, a.ServerID, a.PlayerID, m.CommandID, *m.Predecessor)
	}
	if err != nil || upd.RowsAffected() != 1 {
		return "", false, tx.Rollback(ctx)
	}
	return "COMMITTED", true, tx.Commit(ctx)
}

// ContinueOnce runs Continue ledger read without INSERT on unknown IDs.
func ContinueOnce(ctx context.Context, pool *pgxpool.Pool, actor Actor, commandID string, c1 []byte) (string, error) {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return "", err
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		return "", err
	}
	var existing []byte
	err = tx.QueryRow(ctx, `SELECT canonical_c1 FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR SHARE`,
		actor.RealmID, actor.ServerID, actor.PlayerID, commandID).Scan(&existing)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return LabelNotObserved, tx.Rollback(ctx)
		}
		return "", err
	}
	if bytes.Equal(existing, c1) {
		return LabelCommand, tx.Rollback(ctx)
	}
	return LabelIDContentConflict, tx.Rollback(ctx)
}

// ReadSnap returns committed row + slot head for mutation checks.
func (m *Matrix) ReadSnap(ctx context.Context, pool *pgxpool.Pool, commandID string) (RowSnap, error) {
	var s RowSnap
	a := m.Actor
	err := pool.QueryRow(ctx, `SELECT encode(canonical_c1,'hex'),encode(template_fct1,'hex'),
 template_version,received_at::text,durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid`,
		a.RealmID, a.ServerID, a.PlayerID, commandID).Scan(&s.C1Hex, &s.FCT1Hex, &s.TemplateVersion, &s.ReceivedAt, &s.DurableState)
	if err != nil {
		return RowSnap{}, err
	}
	err = pool.QueryRow(ctx, `SELECT coalesce(head_command_id::text,'') FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, a.RealmID, a.ServerID, a.PlayerID).Scan(&s.Head)
	return s, err
}

// SnapsEqual reports whether two row snapshots match (harness same()).
func SnapsEqual(a, b RowSnap) bool { return a == b }

func NewMatrix(ev ObligationEvidence, actor Actor, commandID string, pred *string, payload Payload) *Matrix {
	return &Matrix{Evidence: ev, Actor: actor, CommandID: commandID, Predecessor: pred, Payload: payload}
}

func payloadFromByte(b byte) Payload {
	fct := make([]byte, 52)
	sha := bytes.Repeat([]byte{0xab}, 32)
	return Payload{
		CanonicalC1: []byte{b}, TemplateVersion: "tpl-b", RulesVersion: "r", CatalogVersion: "c",
		ContentEncodingVersion: 1, TemplateFCT1: fct, ContentSHA256: sha,
	}
}

// PayloadByte builds a one-byte canonical C1 payload matching frozen harness helpers.
func PayloadByte(b byte) Payload { return payloadFromByte(b) }

func UnauthorizedMatrix(actor Actor, commandID string, payload Payload) *Matrix {
	return NewMatrix(ObligationEvidence{}, actor, commandID, nil, payload)
}

// FailClosedSubmit expects ErrUnauthorized and no durable writes.
func (m *Matrix) FailClosedSubmit(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	label, committed, runErr := m.submit(ctx, tx)
	if !errors.Is(runErr, ErrUnauthorized) || committed || strings.TrimSpace(label) != "" {
		return fmt.Errorf("fail-closed: label=%q committed=%v err=%v", label, committed, runErr)
	}
	return nil
}
