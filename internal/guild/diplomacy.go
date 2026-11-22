package guild

import (
	"context"
	"errors"
	"time"

	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDiplomacyUnavailable = errors.New("guild: diplomacy unavailable")
	ErrGuildLeader          = errors.New("guild: leader required")
	ErrGuildTarget          = errors.New("guild: invalid target guild")
	ErrHongluRequired       = errors.New("guild: honglu required")
	ErrGuildTroops          = errors.New("guild: insufficient city troops")
)

const hongluCfgID int32 = 17

type Diplomacy struct {
	Pool *pgxpool.Pool
	Now  func() time.Time
}

func NewDiplomacy(pool *pgxpool.Pool, now func() time.Time) *Diplomacy {
	if now == nil {
		now = time.Now
	}
	return &Diplomacy{Pool: pool, Now: now}
}

func (d *Diplomacy) leader(ctx context.Context, tx pgx.Tx, serverID int32, playerID, guildID int64) error {
	var role int16
	if err := tx.QueryRow(ctx, `SELECT role FROM guild_member WHERE server_id=$1 AND player_id=$2 AND guild_id=$3`,
		serverID, playerID, guildID).Scan(&role); err != nil {
		return ErrGuildLeader
	}
	if role != 1 {
		return ErrGuildLeader
	}
	return nil
}

func (d *Diplomacy) SetRelation(ctx context.Context, serverID int32, playerID, guildID, targetGuildID int64, state int32) (*guildv1.GuildRelationView, error) {
	if state < 1 || state > 3 || guildID == targetGuildID {
		return nil, ErrGuildTarget
	}
	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := d.leader(ctx, tx, serverID, playerID, guildID); err != nil {
		return nil, err
	}
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM guild WHERE server_id=$1 AND guild_id=$2)`,
		serverID, targetGuildID).Scan(&exists); err != nil || !exists {
		return nil, ErrGuildTarget
	}
	effective := d.Now().UTC()
	if state == 3 {
		effective = effective.Add(8 * time.Hour)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO guild_relation(server_id,guild_id,target_guild_id,state,effective_at,updated_at)
		VALUES($1,$2,$3,$4,$5,$6)
		ON CONFLICT (server_id,guild_id,target_guild_id) DO UPDATE SET state=EXCLUDED.state,effective_at=EXCLUDED.effective_at,updated_at=EXCLUDED.updated_at`,
		serverID, guildID, targetGuildID, state, effective, d.Now()); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &guildv1.GuildRelationView{GuildId: guildID, TargetGuildId: targetGuildID, State: state,
		EffectiveAtMs: effective.UnixMilli(), Pending: effective.After(d.Now())}, nil
}

func (d *Diplomacy) ListRelations(ctx context.Context, serverID int32, guildID int64) ([]*guildv1.GuildRelationView, error) {
	rows, err := d.Pool.Query(ctx, `SELECT guild_id,target_guild_id,state,effective_at FROM guild_relation
		WHERE server_id=$1 AND guild_id=$2 ORDER BY target_guild_id`, serverID, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*guildv1.GuildRelationView
	now := d.Now()
	for rows.Next() {
		var v guildv1.GuildRelationView
		var at time.Time
		if err := rows.Scan(&v.GuildId, &v.TargetGuildId, &v.State, &at); err != nil {
			return nil, err
		}
		v.EffectiveAtMs = at.UnixMilli()
		v.Pending = at.After(now)
		out = append(out, &v)
	}
	return out, rows.Err()
}

func (d *Diplomacy) Station(ctx context.Context, serverID int32, playerID, fromCityID, cityID, guildID int64, unit int32, count int32) ([]*guildv1.GuildGarrisonView, error) {
	if count <= 0 || unit < 1 || unit > 12 {
		return nil, ErrGuildTroops
	}
	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var sourceOwner int64
	if err := tx.QueryRow(ctx, `SELECT player_id FROM player_city WHERE server_id=$1 AND city_id=$2`,
		serverID, fromCityID).Scan(&sourceOwner); err != nil || sourceOwner != playerID {
		return nil, ErrGuildTarget
	}
	var member bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM guild_member WHERE server_id=$1 AND player_id=$2 AND guild_id=$3)`,
		serverID, playerID, guildID).Scan(&member); err != nil || !member {
		return nil, ErrGuildLeader
	}
	// The destination must belong to the same guild: self or an ally.
	var ally bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(
		SELECT 1 FROM player_city c JOIN guild_member m
		ON m.server_id=c.server_id AND m.player_id=c.player_id
		WHERE c.server_id=$1 AND c.city_id=$2 AND m.guild_id=$3)`,
		serverID, cityID, guildID).Scan(&ally); err != nil || !ally {
		return nil, ErrGuildTarget
	}
	var honglu int32
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=$3`, serverID, cityID, hongluCfgID).Scan(&honglu); err != nil || honglu < 1 {
		return nil, ErrHongluRequired
	}
	tag, err := tx.Exec(ctx, `UPDATE city_troop SET count=count-$4 WHERE server_id=$1 AND city_id=$2
		AND unit_cfg_id=$3 AND count >= $4`, serverID, fromCityID, unit, count)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() != 1 {
		return nil, ErrGuildTroops
	}
	if _, err := tx.Exec(ctx, `INSERT INTO guild_garrison(server_id,city_id,guild_id,player_id,unit_cfg_id,count,updated_at)
		VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (server_id,city_id,guild_id,player_id,unit_cfg_id)
		DO UPDATE SET count=guild_garrison.count+EXCLUDED.count,updated_at=EXCLUDED.updated_at`,
		serverID, cityID, guildID, playerID, unit, count, d.Now()); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return d.ListGarrison(ctx, serverID, cityID)
}

func (d *Diplomacy) ListGarrison(ctx context.Context, serverID int32, cityID int64) ([]*guildv1.GuildGarrisonView, error) {
	rows, err := d.Pool.Query(ctx, `SELECT g.city_id,g.player_id,g.unit_cfg_id,g.count FROM guild_garrison g
		JOIN player_city c ON c.server_id=g.server_id AND c.city_id=g.city_id
		WHERE g.server_id=$1 AND g.city_id=$2 AND g.guild_id=COALESCE((
			SELECT m.guild_id FROM guild_member m WHERE m.server_id=c.server_id AND m.player_id=c.player_id),0)
		ORDER BY g.player_id,g.unit_cfg_id`, serverID, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*guildv1.GuildGarrisonView
	for rows.Next() {
		var v guildv1.GuildGarrisonView
		if err := rows.Scan(&v.CityId, &v.PlayerId, &v.UnitCfgId, &v.Count); err != nil {
			return nil, err
		}
		out = append(out, &v)
	}
	return out, rows.Err()
}

// GarrisonTroops returns ally troops for city defense.
func (d *Diplomacy) GarrisonTroops(ctx context.Context, serverID int32, cityID int64) ([]march.TroopStack, error) {
	rows, err := d.Pool.Query(ctx, `SELECT g.unit_cfg_id,sum(g.count)::int FROM guild_garrison g
		JOIN player_city c ON c.server_id=g.server_id AND c.city_id=g.city_id
		WHERE g.server_id=$1 AND g.city_id=$2 AND g.guild_id=COALESCE((
			SELECT m.guild_id FROM guild_member m WHERE m.server_id=c.server_id AND m.player_id=c.player_id),0)
		GROUP BY g.unit_cfg_id ORDER BY g.unit_cfg_id`, serverID, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []march.TroopStack
	for rows.Next() {
		var st march.TroopStack
		if err := rows.Scan(&st.UnitCfgID, &st.Count); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}
