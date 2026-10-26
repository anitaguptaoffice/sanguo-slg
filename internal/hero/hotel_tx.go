package hero

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrHotelTransactionRequired = errors.New("hero: hotel transaction coordinator required")
	ErrInvalidHotelState        = errors.New("hero: invalid hotel state")
)

// Hotel transaction ports never use Pool, DDL, transaction lifecycle or other
// domains. The caller must already hold actor/wallet/city locks, and any item
// locks, in the reviewed order. City locking also serializes absent rows/ticks.
// These prerequisites do not activate any route or replace legacy writers.
func hotelTxScope(tx pgx.Tx, serverID int32, cityID int64) error {
	if tx == nil {
		return ErrHotelTransactionRequired
	}
	if serverID <= 0 || cityID <= 0 {
		return ErrInvalidHotelState
	}
	return nil
}

// ListCandidatesInTx locks by identity, then returns the legacy oldest ordering.
func (p *PGHotelStore) ListCandidatesInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID int64) ([]*HotelCandidate, error) {
	if err := hotelTxScope(tx, serverID, cityID); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `
		SELECT candidate_id, display_name, sex, face_id, level,
		       force_base + force_add, intel_base + intel_add, politics_base + politics_add,
		       command_base, loyalty, gold_cost, generated_at
		FROM city_hotel_recruit WHERE server_id=$1 AND city_id=$2
		ORDER BY candidate_id FOR UPDATE`, serverID, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*HotelCandidate
	for rows.Next() {
		c := &HotelCandidate{ServerID: serverID, CityID: cityID}
		if err := rows.Scan(&c.CandidateID, &c.DisplayName, &c.Sex, &c.FaceID, &c.Level,
			&c.Force, &c.Intel, &c.Politics, &c.Command, &c.Loyalty, &c.GoldCost, &c.GeneratedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sortHotelCandidates(out)
	return out, nil
}

func sortHotelCandidates(rows []*HotelCandidate) {
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].GeneratedAt.Equal(rows[j].GeneratedAt) {
			return rows[i].CandidateID < rows[j].CandidateID
		}
		return rows[i].GeneratedAt.Before(rows[j].GeneratedAt)
	})
}

// LastPoolTickInTx preserves the zero-time meaning of an absent schedule.
func (p *PGHotelStore) LastPoolTickInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID int64) (time.Time, error) {
	if err := hotelTxScope(tx, serverID, cityID); err != nil {
		return time.Time{}, err
	}
	var at time.Time
	err := tx.QueryRow(ctx, `SELECT last_pool_tick_at FROM city_hotel_schedule
		WHERE server_id=$1 AND city_id=$2 FOR UPDATE`, serverID, cityID).Scan(&at)
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, nil
	}
	return at, err
}

// NextCandidateIDInTx reserves from the dedicated sequence. A rolled-back
// reservation remains spent; there is no MAX fallback or hero-ID allocation.
func (p *PGHotelStore) NextCandidateIDInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID int64) (int64, error) {
	if err := hotelTxScope(tx, serverID, cityID); err != nil {
		return 0, err
	}
	var id int64
	if err := tx.QueryRow(ctx, `SELECT nextval('city_hotel_candidate_id_seq')`).Scan(&id); err != nil {
		return 0, err
	}
	if id <= 0 {
		return 0, ErrInvalidHotelState
	}
	return id, nil
}

// ReplaceCandidatesInTx accepts reserved IDs only. The caller must roll back on
// any error and save the plan's tick in this same transaction before commit.
func (p *PGHotelStore) ReplaceCandidatesInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID int64, rows []*HotelCandidate) error {
	if err := hotelTxScope(tx, serverID, cityID); err != nil {
		return err
	}
	seen := make(map[int64]bool, len(rows))
	for _, c := range rows {
		if c == nil || c.ServerID != serverID || c.CityID != cityID || c.CandidateID <= 0 || c.GoldCost < 0 || seen[c.CandidateID] {
			return ErrInvalidHotelState
		}
		seen[c.CandidateID] = true
	}
	if _, err := tx.Exec(ctx, `DELETE FROM city_hotel_recruit WHERE server_id=$1 AND city_id=$2`, serverID, cityID); err != nil {
		return err
	}
	// Existing rows were locked by ListCandidatesInTx; caller serialization is
	// mandatory even for an empty pool. Do not infer it from a zero-row lock.
	for _, c := range rows {
		forceBase, forceAdd := splitBaseAdd(c.Force)
		intelBase, intelAdd := splitBaseAdd(c.Intel)
		politicsBase, politicsAdd := splitBaseAdd(c.Politics)
		if _, err := tx.Exec(ctx, `INSERT INTO city_hotel_recruit (
			server_id, city_id, candidate_id, display_name, sex, face_id, level,
			force_base, intel_base, politics_base, command_base,
			force_add, intel_add, politics_add, loyalty, gold_cost, generated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
			serverID, cityID, c.CandidateID, c.DisplayName, c.Sex, c.FaceID, c.Level,
			forceBase, intelBase, politicsBase, c.Command,
			forceAdd, intelAdd, politicsAdd, c.Loyalty, c.GoldCost, c.GeneratedAt); err != nil {
			return err
		}
	}
	return nil
}

func (p *PGHotelStore) SetLastPoolTickInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID int64, at time.Time) error {
	if err := hotelTxScope(tx, serverID, cityID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `INSERT INTO city_hotel_schedule (server_id,city_id,last_pool_tick_at)
		VALUES ($1,$2,$3) ON CONFLICT (server_id,city_id)
		DO UPDATE SET last_pool_tick_at=EXCLUDED.last_pool_tick_at`, serverID, cityID, at)
	return err
}

// ConsumeCandidateInTx must affect exactly one selected row. It neither refills
// the hole nor advances the tick. Missing/stale selection is not success.
func (p *PGHotelStore) ConsumeCandidateInTx(ctx context.Context, tx pgx.Tx, serverID int32, cityID, candidateID int64) error {
	if err := hotelTxScope(tx, serverID, cityID); err != nil {
		return err
	}
	if candidateID <= 0 {
		return ErrInvalidHotelState
	}
	tag, err := tx.Exec(ctx, `DELETE FROM city_hotel_recruit
		WHERE server_id=$1 AND city_id=$2 AND candidate_id=$3`, serverID, cityID, candidateID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrHotelCandidateMissing
	}
	return nil
}
