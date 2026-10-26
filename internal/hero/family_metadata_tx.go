package hero

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Metadata ports require the approved pre-provisioned schema; no Pool, ensure,
// DDL or transaction lifecycle is used. lock=false is only for authoritative
// actor-wallet-protected item planning, NOT a substitute for final locked reads.
// After item locks, lock heroes in ID order, then metadata. Consume metadata
// BEFORE changing/deleting its still-coming/captive hero; rollback on any error.
func familyMetadataLock(lock bool) string {
	if lock {
		return " FOR UPDATE OF m"
	}
	return ""
}

func familyExactlyOne(tag pgconn.CommandTag, err error, missing error) error {
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return missing
	}
	return nil
}

func (p *PGComingStore) GetComingInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, heroID int64, lock bool) (*ComingRecord, error) {
	if err := familyTxHero(tx, actor, heroID, StatusComing); err != nil {
		return nil, err
	}
	var rec ComingRecord
	err := tx.QueryRow(ctx, `SELECT m.city_id FROM player_hero_coming m
		JOIN player_hero h USING(server_id,hero_id)
		WHERE m.server_id=$1 AND m.hero_id=$2 AND h.player_id=$3 AND h.status=$4`+familyMetadataLock(lock),
		actor.ServerID, heroID, actor.PlayerID, StatusComing).Scan(&rec.CityID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// InsertComingInTx is for a newly created hero in the SAME caller transaction,
// never for preview/retry/repair. Conflict cannot overwrite an existing offer.
func (p *PGComingStore) InsertComingInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, heroID int64, rec ComingRecord) error {
	if err := familyTxHero(tx, actor, heroID, StatusComing); err != nil {
		return err
	}
	if rec.CityID <= 0 {
		return ErrInvalidFamilyState
	}
	tag, err := tx.Exec(ctx, `INSERT INTO player_hero_coming(server_id,hero_id,city_id)
		SELECT server_id,hero_id,$4 FROM player_hero
		WHERE server_id=$1 AND hero_id=$2 AND player_id=$3 AND status=$5
		ON CONFLICT(server_id,hero_id) DO NOTHING`, actor.ServerID, heroID, actor.PlayerID, rec.CityID, StatusComing)
	return familyExactlyOne(tag, err, ErrHeroNotComing)
}

func (p *PGComingStore) ConsumeComingInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, heroID int64, expected ComingRecord) error {
	if err := familyTxHero(tx, actor, heroID, StatusComing); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM player_hero_coming m USING player_hero h
		WHERE m.server_id=$1 AND m.hero_id=$2 AND m.city_id=$4
		AND h.server_id=m.server_id AND h.hero_id=m.hero_id AND h.player_id=$3 AND h.status=$5`,
		actor.ServerID, heroID, actor.PlayerID, expected.CityID, StatusComing)
	return familyExactlyOne(tag, err, ErrHeroNotComing)
}

func (p *PGCaptiveStore) GetCaptiveInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, heroID int64, lock bool) (*CaptiveRecord, error) {
	if err := familyTxHero(tx, actor, heroID, StatusCaptive); err != nil {
		return nil, err
	}
	var rec CaptiveRecord
	err := tx.QueryRow(ctx, `SELECT m.city_id,m.summon_item_cfg_id,m.summon_item_qty FROM player_hero_captive m
		JOIN player_hero h USING(server_id,hero_id)
		WHERE m.server_id=$1 AND m.hero_id=$2 AND h.player_id=$3 AND h.status=$4`+familyMetadataLock(lock),
		actor.ServerID, heroID, actor.PlayerID, StatusCaptive).Scan(&rec.CityID, &rec.SummonItemCfgID, &rec.SummonItemQty)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// InsertCaptiveInTx is the insert-only companion of CreateHeroInTx, not a
// replacement for a missing preview row or permission to introduce live capture.
func (p *PGCaptiveStore) InsertCaptiveInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, heroID int64, rec CaptiveRecord) error {
	if err := familyTxHero(tx, actor, heroID, StatusCaptive); err != nil {
		return err
	}
	if rec.CityID <= 0 {
		return ErrInvalidFamilyState
	}
	tag, err := tx.Exec(ctx, `INSERT INTO player_hero_captive(server_id,hero_id,city_id,summon_item_cfg_id,summon_item_qty)
		SELECT server_id,hero_id,$4,$5,$6 FROM player_hero
		WHERE server_id=$1 AND hero_id=$2 AND player_id=$3 AND status=$7
		ON CONFLICT(server_id,hero_id) DO NOTHING`, actor.ServerID, heroID, actor.PlayerID,
		rec.CityID, rec.SummonItemCfgID, rec.SummonItemQty, StatusCaptive)
	return familyExactlyOne(tag, err, ErrHeroNotCaptive)
}

// UpdateCaptiveInTx cannot insert/resurrect metadata or modify a completed hero.
// The expected record must be from the final locked re-read, not an old preview.
func (p *PGCaptiveStore) UpdateCaptiveInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, heroID int64, expected, next CaptiveRecord) error {
	if err := familyTxHero(tx, actor, heroID, StatusCaptive); err != nil {
		return err
	}
	if expected.CityID != next.CityID {
		return ErrInvalidFamilyState
	}
	tag, err := tx.Exec(ctx, `UPDATE player_hero_captive m SET summon_item_cfg_id=$7,summon_item_qty=$8
		FROM player_hero h WHERE m.server_id=$1 AND m.hero_id=$2 AND m.city_id=$4
		AND m.summon_item_cfg_id=$5 AND m.summon_item_qty=$6
		AND h.server_id=m.server_id AND h.hero_id=m.hero_id AND h.player_id=$3 AND h.status=$9`,
		actor.ServerID, heroID, actor.PlayerID, expected.CityID, expected.SummonItemCfgID, expected.SummonItemQty,
		next.SummonItemCfgID, next.SummonItemQty, StatusCaptive)
	return familyExactlyOne(tag, err, ErrHeroNotCaptive)
}

func (p *PGCaptiveStore) ConsumeCaptiveInTx(ctx context.Context, tx pgx.Tx, actor PlayerRef, heroID int64, expected CaptiveRecord) error {
	if err := familyTxHero(tx, actor, heroID, StatusCaptive); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM player_hero_captive m USING player_hero h
		WHERE m.server_id=$1 AND m.hero_id=$2 AND m.city_id=$4 AND m.summon_item_cfg_id=$5 AND m.summon_item_qty=$6
		AND h.server_id=m.server_id AND h.hero_id=m.hero_id AND h.player_id=$3 AND h.status=$7`,
		actor.ServerID, heroID, actor.PlayerID, expected.CityID, expected.SummonItemCfgID, expected.SummonItemQty, StatusCaptive)
	return familyExactlyOne(tag, err, ErrHeroNotCaptive)
}
