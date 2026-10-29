package report

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ErrNoTxStore is returned when a transactional save is requested from a
// non-PostgreSQL store.
var ErrNoTxStore = errors.New("report: transactional PG store required")

// Service archives battle output and exposes queries.
type Service struct {
	store Store
	now   func() time.Time
}

// NewService wires a report store.
func NewService(store Store) *Service {
	return &Service{store: store, now: time.Now}
}

func (s *Service) recordFromSave(p SaveParams) Record {
	rec := Record{
		ServerID:         p.ServerID,
		ReportID:         p.ReportID,
		AttackerPlayerID: p.AttackerPlayerID,
		LocationX:        p.LocationX,
		LocationY:        p.LocationY,
		Outcome:          OutcomeFromResult(p.Report.Result),
		Detail:           p.Report,
		CreatedAt:        s.now(),
	}
	if p.DefenderPlayerID != 0 {
		rec.DefenderPlayerID = p.DefenderPlayerID
		rec.HasDefenderPlayer = true
	}
	if p.DefenderCityID != 0 {
		rec.DefenderCityID = p.DefenderCityID
		rec.HasDefenderCity = true
	}
	return rec
}

// Save persists a battle engine report.
func (s *Service) Save(ctx context.Context, p SaveParams) (Record, error) {
	rec := s.recordFromSave(p)
	if err := s.store.Insert(ctx, rec); err != nil {
		return Record{}, err
	}
	return rec, nil
}

// SaveTx persists a report through the caller's transaction. The caller owns
// the transaction, the schema binding and the report ID allocation.
func (s *Service) SaveTx(ctx context.Context, tx pgx.Tx, schema string, p SaveParams) (Record, error) {
	if s == nil {
		return Record{}, ErrNoTxStore
	}
	pg, ok := s.store.(*PGStore)
	if !ok || tx == nil {
		return Record{}, ErrNoTxStore
	}
	rec := s.recordFromSave(p)
	if err := pg.InsertTx(ctx, tx, schema, rec); err != nil {
		return Record{}, err
	}
	return rec, nil
}

// Get loads one report by shard and id.
func (s *Service) Get(ctx context.Context, serverID int32, reportID int64) (Record, error) {
	return s.store.Get(ctx, serverID, reportID)
}

// ListForPlayer returns reports where the player attacked or defended.
func (s *Service) ListForPlayer(ctx context.Context, p ListParams) (Page, error) {
	if p.Limit <= 0 {
		p.Limit = 20
	}
	if p.Offset < 0 {
		p.Offset = 0
	}
	return s.store.ListByPlayer(ctx, p)
}
