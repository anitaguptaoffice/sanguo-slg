// Frozen SPEC-FIRST-CITY-LEDGER-PENDING-UNIQUE-INDEX-001: one PENDING per slot partial unique (PG17).
package firstcityledgerpgpendinguniqueindex

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	NotProductionRoute = true
	IndexName          = "idx_world_first_city_command_one_pending_per_slot"
)

var ErrUnauthorized = errors.New("firstcityledgerpgpendinguniqueindex: route unauthorized (obligations)")

type (
	ObligationEvidence = firstcityledgerpgintake.ObligationEvidence
	Actor              = firstcityledgerpgintake.Actor
	Payload            = firstcityledgerpgintake.Payload
)

// Matrix inserts PENDING rows when obligation evidence is complete; default fail-closed.
type Matrix struct {
	Evidence  ObligationEvidence
	Actor     Actor
	CommandID string
	Payload   Payload
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

func PayloadByte(b byte) Payload {
	fct := make([]byte, 52)
	sha := make([]byte, 32)
	for i := range sha {
		sha[i] = 0xab
	}
	return Payload{
		CanonicalC1: []byte{b}, TemplateVersion: "t", RulesVersion: "r", CatalogVersion: "c",
		ContentEncodingVersion: 1, TemplateFCT1: fct, ContentSHA256: sha,
	}
}

func NewMatrix(ev ObligationEvidence, actor Actor, commandID string, payload Payload) *Matrix {
	return &Matrix{Evidence: ev, Actor: actor, CommandID: commandID, Payload: payload}
}

func UnauthorizedMatrix(actor Actor, commandID string, payload Payload) *Matrix {
	return NewMatrix(ObligationEvidence{}, actor, commandID, payload)
}

// InsertPendingOnce runs one real INSERT (durable_state=1) on an independent connection.
func (m *Matrix) InsertPendingOnce(ctx context.Context, pool *pgxpool.Pool) error {
	if !m.authorized() {
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
	defer func() { _ = tx.Rollback(ctx) }()
	a, p := m.Actor, m.Payload
	_, err = tx.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,$7,$8,$9,$10,$11,$12,$13)`,
		a.RealmID, a.ServerID, a.PlayerID, m.CommandID, a.AccountID,
		p.CanonicalC1, p.TemplateVersion, p.RulesVersion, p.CatalogVersion,
		p.ContentEncodingVersion, p.TemplateFCT1, p.ContentSHA256, time.Now().UTC())
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// FailClosedInsert expects ErrUnauthorized and no command rows for the actor.
func (m *Matrix) FailClosedInsert(ctx context.Context, pool *pgxpool.Pool) error {
	err := m.InsertPendingOnce(ctx, pool)
	if !errors.Is(err, ErrUnauthorized) {
		return fmt.Errorf("fail-closed: err=%v", err)
	}
	n, err := m.PendingCount(ctx, pool)
	if err != nil || n != 0 {
		return fmt.Errorf("fail-closed: pending=%d err=%v", n, err)
	}
	return nil
}

// PendingCount counts durable_state=1 rows for this actor slot (row evidence).
func (m *Matrix) PendingCount(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	var n int
	a := m.Actor
	err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND durable_state=1`,
		a.RealmID, a.ServerID, a.PlayerID).Scan(&n)
	return n, err
}

// GlobalPendingCount counts all durable_state=1 rows in the schema.
func GlobalPendingCount(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE durable_state=1`).Scan(&n)
	return n, err
}

// PendingCountByCommandID counts PENDING rows sharing a command_id UUID string.
func PendingCountByCommandID(ctx context.Context, pool *pgxpool.Pool, commandID string) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE command_id=$1::uuid AND durable_state=1`, commandID).Scan(&n)
	return n, err
}

func IsUniqueViolation(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23505"
}

// AssertPartialUniqueIndex verifies catalog definition (UNIQUE + durable_state=1 predicate).
func AssertPartialUniqueIndex(ctx context.Context, pool *pgxpool.Pool) error {
	var def string
	err := pool.QueryRow(ctx, `SELECT indexdef FROM pg_indexes
 WHERE schemaname = current_schema() AND indexname = $1`, IndexName).Scan(&def)
	if err != nil {
		return err
	}
	if !strings.Contains(def, "WHERE (durable_state = 1)") {
		return fmt.Errorf("partial predicate durable_state=1 missing in %q", def)
	}
	if !strings.Contains(def, "UNIQUE") {
		return fmt.Errorf("index must be UNIQUE: %q", def)
	}
	return nil
}

// MarkSucceeded sets durable_state=2 for this matrix command (independent connection).
func (m *Matrix) MarkSucceeded(ctx context.Context, pool *pgxpool.Pool) error {
	if !m.authorized() {
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
	defer func() { _ = tx.Rollback(ctx) }()
	a := m.Actor
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=88001,success_server_id=$2,success_player_id=$3,
 success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		a.RealmID, a.ServerID, a.PlayerID, m.CommandID)
	if err != nil || tag.RowsAffected() != 1 {
		return fmt.Errorf("mark succeeded: err=%v rows=%d", err, tag.RowsAffected())
	}
	return tx.Commit(ctx)
}

// MarkRejected sets durable_state=3 for this matrix command.
func (m *Matrix) MarkRejected(ctx context.Context, pool *pgxpool.Pool) error {
	if !m.authorized() {
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
	defer func() { _ = tx.Rollback(ctx) }()
	a := m.Actor
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		a.RealmID, a.ServerID, a.PlayerID, m.CommandID)
	if err != nil || tag.RowsAffected() != 1 {
		return fmt.Errorf("mark rejected: err=%v rows=%d", err, tag.RowsAffected())
	}
	return tx.Commit(ctx)
}

// DualConcurrentInsert starts two PENDING inserts on separate connections (same pool, concurrent).
func DualConcurrentInsert(ctx context.Context, pool *pgxpool.Pool, a, b *Matrix) (okA, okB bool, errA, errB error) {
	begin := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	run := func(m *Matrix, dstOK *bool, dstErr *error) {
		defer wg.Done()
		<-begin
		*dstErr = m.InsertPendingOnce(ctx, pool)
		*dstOK = *dstErr == nil
	}
	go run(a, &okA, &errA)
	go run(b, &okB, &errB)
	close(begin)
	wg.Wait()
	return okA, okB, errA, errB
}
