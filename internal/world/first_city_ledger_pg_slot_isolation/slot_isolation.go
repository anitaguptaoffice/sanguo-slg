// Cross-actor slot isolation matrix (disposable PG17 only); reuses slot_cas intake semantics read-only.
package firstcityledgerpgslotisolation

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	firstcityledgerpgslotcas "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_slot_cas"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var ErrUnauthorized = firstcityledgerpgslotcas.ErrUnauthorized

// Matrix is one cross-actor isolation participant; row evidence drives acceptance.
type Matrix struct {
	inner *firstcityledgerpgslotcas.Matrix
}

// ObligationEvidence is the frozen obligation bundle for authorized intake.
type ObligationEvidence = firstcityledgerpgintake.ObligationEvidence

// Actor scopes one (realm_id, server_id, player_id) namespace.
type Actor = firstcityledgerpgintake.Actor

// Payload is immutable C1 payload for PENDING intake.
type Payload = firstcityledgerpgintake.Payload

// RowSnapshot captures head + command row counts for peer non-interference checks.
type RowSnapshot struct {
	Head      string
	CmdRows   int
}

// FullObligationEvidence returns an all-gates-pass obligation bundle for isolated proofs.
func FullObligationEvidence() ObligationEvidence {
	var inv [11]bool
	for i := range inv {
		inv[i] = true
	}
	return ObligationEvidence{
		ProfileComplete: true, InventoryDrainEvidence: inv, ThroughCommitDrainOK: true,
	}
}

// NewMatrix builds an intake participant for one actor namespace.
func NewMatrix(ev ObligationEvidence, actor Actor, commandID string, pred *string, payload Payload) *Matrix {
	return &Matrix{inner: &firstcityledgerpgslotcas.Matrix{
		Evidence: ev, Actor: actor, CommandID: commandID, Predecessor: pred, Payload: payload,
	}}
}

// IntakeOnce runs one §3 intake transaction on an independent pool connection.
func (m *Matrix) IntakeOnce(ctx context.Context, pool *pgxpool.Pool) (committed bool, err error) {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return false, err
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		return false, err
	}
	return m.inner.IntakeParticipant(ctx, tx)
}

// HeadCommandID reads committed slot head (empty when NULL).
func (m *Matrix) HeadCommandID(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	return m.inner.HeadCommandID(ctx, pool)
}

// PendingCount counts durable_state=1 commands for this actor.
func (m *Matrix) PendingCount(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	return m.inner.PendingCount(ctx, pool)
}

// ObserveInvariants checks orphan heads and dangling PENDING rows (row evidence).
func (m *Matrix) ObserveInvariants(ctx context.Context, pool *pgxpool.Pool) error {
	return m.inner.ObserveInvariants(ctx, pool)
}

// Snapshot rows for peer isolation assertions.
func (m *Matrix) Snapshot(ctx context.Context, pool *pgxpool.Pool) (RowSnapshot, error) {
	head, err := m.HeadCommandID(ctx, pool)
	if err != nil {
		return RowSnapshot{}, err
	}
	var total int
	a := m.inner.Actor
	err = pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`, a.RealmID, a.ServerID, a.PlayerID).Scan(&total)
	return RowSnapshot{Head: head, CmdRows: total}, err
}

// PeersUnchanged reports whether two snapshots are identical (no cross-actor residue).
func PeersUnchanged(before, after RowSnapshot) bool {
	return before.Head == after.Head && before.CmdRows == after.CmdRows
}

// DualConcurrentInitial starts two actors' EMPTY INITIAL intakes on separate connections.
func DualConcurrentInitial(ctx context.Context, pool *pgxpool.Pool, a, b *Matrix) (okA, okB bool, err error) {
	begin := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	var runErr error
	var once sync.Once
	record := func(e error) {
		if e != nil {
			once.Do(func() { runErr = e })
		}
	}
	run := func(m *Matrix, dst *bool) {
		defer wg.Done()
		<-begin
		var e error
		*dst, e = m.IntakeOnce(ctx, pool)
		record(e)
	}
	go run(a, &okA)
	go run(b, &okB)
	close(begin)
	wg.Wait()
	return okA, okB, runErr
}

// MidIntakeHold runs BeginStagedIntake, signals ready, sleeps, then CommitHeadCAS (actor A path).
func (m *Matrix) MidIntakeHold(ctx context.Context, pool *pgxpool.Pool, holdDurMs int, ready chan<- struct{}) error {
	staged, err := m.inner.BeginStagedIntake(ctx, pool)
	if err != nil {
		return err
	}
	if ready != nil {
		close(ready)
	}
	if holdDurMs > 0 {
		timer := time.NewTimer(time.Duration(holdDurMs) * time.Millisecond)
		defer timer.Stop()
		select {
		case <-ctx.Done():
			_ = staged.Rollback(ctx)
			return ctx.Err()
		case <-timer.C:
		}
	}
	return staged.CommitHeadCAS(ctx)
}

// HeadConflictEmptyPredecessor retries INITIAL with a new command id while head is non-NULL (must roll back).
func (m *Matrix) HeadConflictEmptyPredecessor(ctx context.Context, pool *pgxpool.Pool, failCmdID string) (committed bool, err error) {
	fail := NewMatrix(m.inner.Evidence, m.inner.Actor, failCmdID, nil, m.inner.Payload)
	return fail.IntakeOnce(ctx, pool)
}

// Actor returns the matrix actor tuple.
func (m *Matrix) Actor() Actor {
	return m.inner.Actor
}

// AssertHead wants the committed head command id string.
func (m *Matrix) AssertHead(ctx context.Context, pool *pgxpool.Pool, want string) error {
	got, err := m.HeadCommandID(ctx, pool)
	if err != nil {
		return err
	}
	if got != want {
		return fmt.Errorf("unexpected head: got %q want %q", got, want)
	}
	return nil
}

// AssertSingleCommand expects exactly one command row for this actor.
func (m *Matrix) AssertSingleCommand(ctx context.Context, pool *pgxpool.Pool) error {
	snap, err := m.Snapshot(ctx, pool)
	if err != nil {
		return err
	}
	if snap.CmdRows != 1 {
		return fmt.Errorf("expected 1 command row, got %d", snap.CmdRows)
	}
	return nil
}

// UnauthorizedMatrix is a fail-closed participant without obligation evidence.
func UnauthorizedMatrix(actor Actor, commandID string, payload Payload) *Matrix {
	return NewMatrix(ObligationEvidence{}, actor, commandID, nil, payload)
}

// FailClosedIntake expects ErrUnauthorized and no commit.
func (m *Matrix) FailClosedIntake(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	committed, runErr := m.inner.IntakeParticipant(ctx, tx)
	if !errors.Is(runErr, ErrUnauthorized) || committed {
		return fmt.Errorf("fail-closed: committed=%v err=%v", committed, runErr)
	}
	return nil
}
