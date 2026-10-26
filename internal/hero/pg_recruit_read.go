package hero

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// ListPlayerHeroesInTx reads only through the supplied transaction, with no pool
// access, schema setup or commit. The API owner must first lock the player's
// wallet, then read heroes and bag in that same transaction before planning.
func (p *PGStore) ListPlayerHeroesInTx(ctx context.Context, tx pgx.Tx, serverID int32, playerID int64) ([]*Hero, error) {
	if tx == nil {
		return nil, ErrRecruitTransactionRequired
	}
	return listPlayerHeroesInTx(ctx, tx, serverID, playerID, false)
}

// LockPlayerHeroesInTx locks the cross-city snapshot in hero-ID order. The
// caller must already hold wallet and all item locks, before any metadata lock.
func (p *PGStore) LockPlayerHeroesInTx(ctx context.Context, tx pgx.Tx, serverID int32, playerID int64) ([]*Hero, error) {
	if err := familyTxScope(tx, PlayerRef{ServerID: serverID, PlayerID: playerID}); err != nil {
		return nil, err
	}
	return listPlayerHeroesInTx(ctx, tx, serverID, playerID, true)
}

func listPlayerHeroesInTx(ctx context.Context, tx pgx.Tx, serverID int32, playerID int64, lock bool) ([]*Hero, error) {
	suffix := ""
	if lock {
		suffix = " FOR UPDATE"
	}
	// Point-add columns are legacy optional columns (not in the schema contract).
	// Read them when present without request-time ALTER TABLE or losing existing
	// values; base attributes already contain their applied totals.
	rows, err := tx.Query(ctx, `
		SELECT server_id, hero_id, player_id, template_cfg_id, COALESCE(display_name,''), level, exp, loyalty,
		       force, intel, politics, command,
		       COALESCE((to_jsonb(h)->>'force_add')::int,0),
		       COALESCE((to_jsonb(h)->>'intel_add')::int,0),
		       COALESCE((to_jsonb(h)->>'politics_add')::int,0), status, created_at
		FROM player_hero h
		WHERE server_id = $1 AND player_id = $2
		ORDER BY hero_id`+suffix, serverID, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Hero
	for rows.Next() {
		var h Hero
		if err := rows.Scan(
			&h.ServerID, &h.HeroID, &h.PlayerID, &h.TemplateCfgID, &h.DisplayName, &h.Level, &h.Exp, &h.Loyalty,
			&h.Force, &h.Intel, &h.Politics, &h.Command, &h.ForceAdd, &h.IntelAdd, &h.PoliticsAdd, &h.Status, &h.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, &h)
	}
	return out, rows.Err()
}
