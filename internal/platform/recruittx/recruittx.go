// Package recruittx provides dormant Recruit-specific transaction ownership.
// Pool provenance/lifetime is NOT source metadata, authorization or epoch proof.
package recruittx

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrBinding        = errors.New("recruittx: invalid binding")
	ErrInactive       = errors.New("recruittx: inactive transaction")
	ErrDeadline       = errors.New("recruittx: bounded context required")
	ErrOutcomeUnknown = errors.New("recruittx: commit outcome unknown")
)

type Binding struct{ pool *pgxpool.Pool }
type Owner struct{ s *state }
type Access struct{ s *state }
type state struct {
	binding *Binding
	tx      pgx.Tx
	ctx     context.Context
	cancel  context.CancelFunc
	gate    chan struct{}
	ended   bool // protected by gate; copied handles share this state
}

func NewBinding(pool *pgxpool.Pool) (*Binding, error) {
	if pool == nil {
		return nil, ErrBinding
	}
	return &Binding{pool: pool}, nil
}

func (b *Binding) Begin(ctx context.Context) (*Owner, error) {
	if b == nil || b.pool == nil {
		return nil, ErrBinding
	}
	if ctx == nil {
		return nil, ErrDeadline
	}
	if _, ok := ctx.Deadline(); !ok {
		return nil, ErrDeadline
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	owned, cancel := context.WithCancel(ctx)
	tx, err := b.pool.BeginTx(owned, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		cancel()
		return nil, err
	}
	s := &state{binding: b, tx: tx, ctx: owned, cancel: cancel, gate: make(chan struct{}, 1)}
	s.gate <- struct{}{}
	return &Owner{s: s}, nil
}

func (o *Owner) Access() *Access {
	if o == nil {
		return nil
	}
	return &Access{s: o.s}
}

func (s *state) lock(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-s.gate:
	}
	if err := ctx.Err(); err != nil {
		s.unlock()
		return err
	}
	if s.ended {
		s.unlock()
		return ErrInactive
	}
	return nil
}
func (s *state) unlock() { s.gate <- struct{}{} }

// Admission and the entire Scan stay inside the gate; nothing raw escapes.
func (a *Access) enter(ctx context.Context, expected *Binding) (context.Context, func(), error) {
	if a == nil || a.s == nil || expected == nil || expected != a.s.binding {
		return nil, nil, ErrBinding
	}
	if ctx == nil {
		return nil, nil, ErrDeadline
	}
	s := a.s
	call, cancel := context.WithCancel(ctx)
	stop := context.AfterFunc(s.ctx, cancel)
	discard := func() { stop(); cancel() }
	if err := s.lock(call); err != nil {
		discard()
		return nil, nil, err
	}
	if err := s.ctx.Err(); err != nil {
		s.unlock()
		discard()
		return nil, nil, err
	}
	return call, func() { s.unlock(); discard() }, nil
}

func (a *Access) Exec(ctx context.Context, expected *Binding, sql string, args ...any) (pgconn.CommandTag, error) {
	call, leave, err := a.enter(ctx, expected)
	if err != nil {
		return pgconn.CommandTag{}, err
	}
	defer leave()
	return a.s.tx.Exec(call, sql, args...)
}

func (a *Access) Scan(ctx context.Context, expected *Binding, sql string, args []any, dest ...any) error {
	call, leave, err := a.enter(ctx, expected)
	if err != nil {
		return err
	}
	defer leave()
	return a.s.tx.QueryRow(call, sql, args...).Scan(dest...)
}

// cleanup is an attempt, not proof that an uncertain commit rolled back.
func (s *state) cleanup(ctx context.Context) error {
	clean, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	err := s.tx.Rollback(clean)
	if errors.Is(err, pgx.ErrTxClosed) {
		return nil
	}
	return err
}

func (o *Owner) Commit(ctx context.Context) (err error) {
	if o == nil || o.s == nil {
		return ErrInactive
	}
	s := o.s
	call, leave, err := o.Access().enter(ctx, s.binding)
	if err != nil {
		return err
	} // no underlying Commit was attempted
	defer leave()
	s.ended = true // end linearization; admission is now permanently closed
	defer s.cancel()
	committed := false
	defer func() {
		if !committed {
			err = errors.Join(err, s.cleanup(call))
		}
	}() // also runs on panic; the panic continues after bounded cleanup
	if err = s.tx.Commit(call); err != nil {
		return errors.Join(ErrOutcomeUnknown, err)
	}
	committed = true
	return nil
}

// Rollback honors its bounded context. APP supplies independent cleanup context;
// a canceled gate wait neither cancels admitted SQL nor attempts transaction end.
func (o *Owner) Rollback(ctx context.Context) error {
	if o == nil || o.s == nil {
		return ErrInactive
	}
	if ctx == nil {
		return ErrDeadline
	}
	if _, ok := ctx.Deadline(); !ok {
		return ErrDeadline
	}
	s := o.s
	if err := s.lock(ctx); err != nil {
		return err
	}
	defer s.unlock()
	s.ended = true
	defer s.cancel()
	return s.tx.Rollback(ctx)
}
