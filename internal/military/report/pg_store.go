package report

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotInserted reports an insert that affected no row, for example a NULL trigger.
var ErrNotInserted = errors.New("report: insert affected no row")

// PGStore persists reports in PostgreSQL (spec/db/004_military.sql).
type PGStore struct {
	Pool *pgxpool.Pool
}

// NewPGStore wraps a pool.
func NewPGStore(p *pgxpool.Pool) *PGStore {
	return &PGStore{Pool: p}
}

func (p *PGStore) Insert(ctx context.Context, rec Record) error {
	if p == nil || p.Pool == nil {
		return ErrNoTxStore
	}
	return insertReport(ctx, p.Pool, "battle_report", rec)
}

// InsertTx writes the report through the caller's transaction using a
// schema-qualified table; it never begins, ends or allocates an ID.
func (p *PGStore) InsertTx(ctx context.Context, tx pgx.Tx, schema string, rec Record) error {
	if p == nil || tx == nil || schema == "" {
		return ErrNoTxStore
	}
	return insertReport(ctx, tx, pgx.Identifier{schema, "battle_report"}.Sanitize(), rec)
}

type statementRunner interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func insertReport(ctx context.Context, db statementRunner, table string, rec Record) error {
	detail, err := encodeDetail(rec.Detail)
	if err != nil {
		return err
	}
	var defPlayer, defCity interface{}
	if rec.HasDefenderPlayer {
		defPlayer = rec.DefenderPlayerID
	}
	if rec.HasDefenderCity {
		defCity = rec.DefenderCityID
	}
	created := rec.CreatedAt
	if created.IsZero() {
		created = time.Now()
	}
	tag, err := db.Exec(ctx, `
		INSERT INTO `+table+` (
			server_id, report_id, attacker_player_id, defender_player_id, defender_city_id,
			location_x, location_y, outcome, detail, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		rec.ServerID, rec.ReportID, rec.AttackerPlayerID, defPlayer, defCity,
		rec.LocationX, rec.LocationY, rec.Outcome, detail, created,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrDuplicate
		}
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrNotInserted
	}
	return nil
}

func (p *PGStore) Get(ctx context.Context, serverID int32, reportID int64) (Record, error) {
	var rec Record
	var defPlayer, defCity *int64
	var detail []byte
	err := p.Pool.QueryRow(ctx, `
		SELECT server_id, report_id, attacker_player_id, defender_player_id, defender_city_id,
			location_x, location_y, outcome, detail, created_at
		FROM battle_report
		WHERE server_id = $1 AND report_id = $2`, serverID, reportID,
	).Scan(
		&rec.ServerID, &rec.ReportID, &rec.AttackerPlayerID, &defPlayer, &defCity,
		&rec.LocationX, &rec.LocationY, &rec.Outcome, &detail, &rec.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Record{}, ErrNotFound
	}
	if err != nil {
		return Record{}, err
	}
	if defPlayer != nil {
		rec.DefenderPlayerID = *defPlayer
		rec.HasDefenderPlayer = true
	}
	if defCity != nil {
		rec.DefenderCityID = *defCity
		rec.HasDefenderCity = true
	}
	rep, err := decodeDetail(detail)
	if err != nil {
		return Record{}, err
	}
	rec.Detail = rep
	return rec, nil
}

func (p *PGStore) ListByPlayer(ctx context.Context, params ListParams) (Page, error) {
	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}
	var total int
	err := p.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM battle_report
		WHERE server_id = $1 AND (
			attacker_player_id = $2 OR defender_player_id = $2
		)`, params.ServerID, params.PlayerID,
	).Scan(&total)
	if err != nil {
		return Page{}, err
	}
	rows, err := p.Pool.Query(ctx, `
		SELECT server_id, report_id, attacker_player_id, defender_player_id, defender_city_id,
			location_x, location_y, outcome, detail, created_at
		FROM battle_report
		WHERE server_id = $1 AND (
			attacker_player_id = $2 OR defender_player_id = $2
		)
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`, params.ServerID, params.PlayerID, limit, offset,
	)
	if err != nil {
		return Page{}, err
	}
	defer rows.Close()
	var items []Record
	for rows.Next() {
		rec, err := scanRecord(rows)
		if err != nil {
			return Page{}, err
		}
		items = append(items, rec)
	}
	if err := rows.Err(); err != nil {
		return Page{}, err
	}
	return Page{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanRecord(rows rowScanner) (Record, error) {
	var rec Record
	var defPlayer, defCity *int64
	var detail []byte
	if err := rows.Scan(
		&rec.ServerID, &rec.ReportID, &rec.AttackerPlayerID, &defPlayer, &defCity,
		&rec.LocationX, &rec.LocationY, &rec.Outcome, &detail, &rec.CreatedAt,
	); err != nil {
		return Record{}, err
	}
	if defPlayer != nil {
		rec.DefenderPlayerID = *defPlayer
		rec.HasDefenderPlayer = true
	}
	if defCity != nil {
		rec.DefenderCityID = *defCity
		rec.HasDefenderCity = true
	}
	rep, err := decodeDetail(detail)
	if err != nil {
		return Record{}, err
	}
	rec.Detail = rep
	return rec, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
