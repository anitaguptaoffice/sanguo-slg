package hero

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGHotelStore implements HotelStore (spec/db/m4_004_hotel_recruit.sql).
type PGHotelStore struct{ Pool *pgxpool.Pool }

func NewPGHotelStore(pool *pgxpool.Pool) *PGHotelStore { return &PGHotelStore{Pool: pool} }

func (p *PGHotelStore) ListCandidates(ctx context.Context, serverID int32, cityID int64) ([]*HotelCandidate, error) {
	rows, err := p.Pool.Query(ctx, `
		SELECT candidate_id, display_name, sex, face_id, level,
		       force_base + force_add, intel_base + intel_add, politics_base + politics_add,
		       command_base, loyalty, gold_cost, generated_at
		FROM city_hotel_recruit
		WHERE server_id = $1 AND city_id = $2
		ORDER BY generated_at ASC, candidate_id ASC`,
		serverID, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*HotelCandidate
	for rows.Next() {
		var c HotelCandidate
		c.CityID = cityID
		if err := rows.Scan(&c.CandidateID, &c.DisplayName, &c.Sex, &c.FaceID, &c.Level,
			&c.Force, &c.Intel, &c.Politics, &c.Command, &c.Loyalty, &c.GoldCost, &c.GeneratedAt); err != nil {
			return nil, err
		}
		out = append(out, &c)
	}
	return out, rows.Err()
}

func (p *PGHotelStore) ReplaceCandidates(ctx context.Context, serverID int32, cityID int64, rows []*HotelCandidate) error {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `DELETE FROM city_hotel_recruit WHERE server_id=$1 AND city_id=$2`, serverID, cityID); err != nil {
		return err
	}
	for _, c := range rows {
		forceBase, forceAdd := splitBaseAdd(c.Force)
		intelBase, intelAdd := splitBaseAdd(c.Intel)
		politicsBase, politicsAdd := splitBaseAdd(c.Politics)
		if _, err := tx.Exec(ctx, `
			INSERT INTO city_hotel_recruit (
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
	return tx.Commit(ctx)
}

func splitBaseAdd(total int32) (base, add int32) {
	if total <= 0 {
		return 0, 0
	}
	add = total / 3
	base = total - add
	return base, add
}

func (p *PGHotelStore) DeleteCandidate(ctx context.Context, serverID int32, cityID int64, candidateID int64) error {
	_, err := p.Pool.Exec(ctx, `
		DELETE FROM city_hotel_recruit WHERE server_id=$1 AND city_id=$2 AND candidate_id=$3`,
		serverID, cityID, candidateID)
	return err
}

func (p *PGHotelStore) LastPoolTick(ctx context.Context, serverID int32, cityID int64) (time.Time, error) {
	var t time.Time
	err := p.Pool.QueryRow(ctx, `
		SELECT last_pool_tick_at FROM city_hotel_schedule WHERE server_id=$1 AND city_id=$2`,
		serverID, cityID).Scan(&t)
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, nil
	}
	return t, err
}

func (p *PGHotelStore) SetLastPoolTick(ctx context.Context, serverID int32, cityID int64, at time.Time) error {
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO city_hotel_schedule (server_id, city_id, last_pool_tick_at)
		VALUES ($1,$2,$3)
		ON CONFLICT (server_id, city_id) DO UPDATE SET last_pool_tick_at = EXCLUDED.last_pool_tick_at`,
		serverID, cityID, at)
	return err
}

func (p *PGHotelStore) NextCandidateID(ctx context.Context, serverID int32, cityID int64) (int64, error) {
	// Candidate identities are reserved across all cities/shards before persistence.
	// The reviewed migration owns setup; never fall back to MAX or reuse hero IDs.
	var id int64
	err := p.Pool.QueryRow(ctx, `SELECT nextval('city_hotel_candidate_id_seq')`).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}
