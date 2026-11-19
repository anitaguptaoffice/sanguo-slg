package world

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists world state (spec/db/002_world.sql).
type PGStore struct{ Pool *pgxpool.Pool }

func NewPGStore(p *pgxpool.Pool) *PGStore { return &PGStore{Pool: p} }

func (p *PGStore) LoadChunk(ctx context.Context, sid int32, cx, cy int) ([]Cell, bool, error) {
	minX, minY, maxX, maxY := ChunkBounds(cx, cy)
	rows, err := p.Pool.Query(ctx,
		`SELECT x,y,terrain,COALESCE(resource_type,0),resource_level,level,max_level,province_id,
		        COALESCE(owner_city_id,0),npc_kind,garrison_json,recover_at FROM map_cell
		 WHERE server_id=$1 AND x>=$2 AND x<$3 AND y>=$4 AND y<$5 ORDER BY y,x`, sid, minX, maxX, minY, maxY)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	var out []Cell
	for rows.Next() {
		var c Cell
		var recoverAt *time.Time
		if err := rows.Scan(&c.X, &c.Y, &c.Terrain, &c.ResourceType, &c.ResourceLevel,
			&c.Level, &c.MaxLevel, &c.ProvinceID, &c.OwnerCityID, &c.NpcKind, &c.GarrisonJSON, &recoverAt); err != nil {
			return nil, false, err
		}
		if recoverAt != nil {
			c.RecoverAt = *recoverAt
		}
		out = append(out, c)
	}
	return out, len(out) > 0, rows.Err()
}

func (p *PGStore) SaveChunk(ctx context.Context, sid int32, cells []Cell) error {
	if len(cells) == 0 {
		return nil
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	return saveChunkTransaction(ctx, tx, sid, cells)
}

// saveChunkTransaction owns the transaction begun by SaveChunk, including its end.
func saveChunkTransaction(ctx context.Context, tx pgx.Tx, sid int32, cells []Cell) error {
	defer func() {
		// Caller cancellation must not prevent cleanup or replace the original error.
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	batch := &pgx.Batch{}
	q := `INSERT INTO map_cell(server_id,x,y,terrain,resource_type,resource_level,level,max_level,province_id,owner_city_id,npc_kind,garrison_json,recover_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(server_id,x,y) DO UPDATE SET
		terrain=EXCLUDED.terrain,resource_type=EXCLUDED.resource_type,resource_level=EXCLUDED.resource_level,
		level=EXCLUDED.level,max_level=EXCLUDED.max_level,province_id=EXCLUDED.province_id,
		owner_city_id=EXCLUDED.owner_city_id,npc_kind=EXCLUDED.npc_kind,
		garrison_json=EXCLUDED.garrison_json,recover_at=EXCLUDED.recover_at`
	for _, c := range cells {
		var rt *int16
		if c.ResourceType != 0 {
			rt = &c.ResourceType
		}
		var owner *int64
		if c.OwnerCityID != 0 {
			owner = &c.OwnerCityID
		}
		var recoverAt *time.Time
		if !c.RecoverAt.IsZero() {
			recoverAt = &c.RecoverAt
		}
		level, maxLevel := c.Level, c.MaxLevel
		if level < 1 {
			level = 1
		}
		if maxLevel < 1 {
			maxLevel = 1
		}
		// Separate ordered statements retain last-write-wins for duplicate coordinates.
		batch.Queue(q, sid, c.X, c.Y, c.Terrain, rt, c.ResourceLevel, level, maxLevel,
			c.ProvinceID, owner, c.NpcKind, c.GarrisonJSON, recoverAt)
	}
	// Close drains every result and preserves the first batch error before COMMIT.
	if err := tx.SendBatch(ctx, batch).Close(); err != nil {
		return err
	}
	// A commit error can have an unknown outcome: return it unchanged, never retry.
	return tx.Commit(ctx)
}

func (p *PGStore) CreateCity(ctx context.Context, c City) error {
	_, err := p.Pool.Exec(ctx, `INSERT INTO player_city
		(server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		c.ServerID, c.CityID, c.PlayerID, c.Name, c.X, c.Y, c.IsCapital, c.WallLevel, c.Morale)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			return ErrOccupied
		}
	}
	return err
}

func (p *PGStore) CityAt(ctx context.Context, sid int32, x, y int) (*City, error) {
	var c City
	err := p.Pool.QueryRow(ctx, `SELECT server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale
		FROM player_city WHERE server_id=$1 AND x=$2 AND y=$3`, sid, x, y).
		Scan(&c.ServerID, &c.CityID, &c.PlayerID, &c.Name, &c.X, &c.Y, &c.IsCapital, &c.WallLevel, &c.Morale)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (p *PGStore) PlayerCities(ctx context.Context, sid int32, pid int64) ([]City, error) {
	rows, err := p.Pool.Query(ctx, `SELECT server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale
		FROM player_city WHERE server_id=$1 AND player_id=$2`, sid, pid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []City
	for rows.Next() {
		var c City
		if err := rows.Scan(&c.ServerID, &c.CityID, &c.PlayerID, &c.Name, &c.X, &c.Y, &c.IsCapital, &c.WallLevel, &c.Morale); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (p *PGStore) ClearResourceOccupancy(ctx context.Context, sid int32, x, y int) error {
	_, err := p.Pool.Exec(ctx, `INSERT INTO resource_node_state(server_id,x,y,occupier_player_id,gather_rate,updated_at)
		VALUES($1,$2,$3,NULL,0,now()) ON CONFLICT(server_id,x,y) DO UPDATE SET
		occupier_player_id=NULL,gather_rate=0,updated_at=now()`, sid, x, y)
	return err
}

// Viewport returns the tiles inside an inclusive rectangle.
func (p *PGStore) Viewport(ctx context.Context, sid int32, minX, minY, maxX, maxY int) ([]TileView, error) {
	rows, err := p.Pool.Query(ctx, `
		SELECT m.x, m.y,
		       CASE WHEN site.city_id IS NOT NULL THEN 0 ELSE m.terrain END,
		       COALESCE(m.resource_type,0), m.resource_level,
		       m.level, m.max_level, m.province_id,
		       COALESCE(m.owner_city_id, site.city_id, 0), m.npc_kind,
		       m.garrison_json, m.recover_at,
		       COALESCE(owner.player_id, site.player_id, 0),
		       COALESCE(owner_pl.display_name, site_pl.display_name, ''),
		       COALESCE(owner.name, site.name, '')
		FROM map_cell m
		LEFT JOIN player_city site ON site.server_id = m.server_id AND site.x = m.x AND site.y = m.y
		LEFT JOIN player_city owner ON owner.server_id = m.server_id AND owner.city_id = m.owner_city_id
		LEFT JOIN player owner_pl ON owner_pl.server_id = owner.server_id AND owner_pl.player_id = owner.player_id
		LEFT JOIN player site_pl ON site_pl.server_id = site.server_id AND site_pl.player_id = site.player_id
		WHERE m.server_id = $1 AND m.x BETWEEN $2 AND $3 AND m.y BETWEEN $4 AND $5
		ORDER BY m.y, m.x`, sid, minX, maxX, minY, maxY)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]TileView, 0, (maxX-minX+1)*(maxY-minY+1))
	for rows.Next() {
		var tile TileView
		var recoverAt *time.Time
		if err := rows.Scan(&tile.X, &tile.Y, &tile.Terrain, &tile.ResourceType, &tile.ResourceLevel,
			&tile.Level, &tile.MaxLevel, &tile.ProvinceID, &tile.OwnerCityID, &tile.NpcKind,
			&tile.GarrisonJSON, &recoverAt,
			&tile.OwnerPlayerID, &tile.OwnerName, &tile.OwnerCityName); err != nil {
			return nil, err
		}
		if recoverAt != nil {
			tile.RecoverAt = *recoverAt
		}
		out = append(out, tile)
	}
	return out, rows.Err()
}

// MarchLines returns in-progress marches whose destination lies in the rectangle.
func (p *PGStore) MarchLines(ctx context.Context, sid int32, minX, minY, maxX, maxY int) ([]MarchLine, error) {
	rows, err := p.Pool.Query(ctx, `
		SELECT o.march_id, o.from_x, o.from_y, o.to_x, o.to_y, o.status, o.arrive_at, a.owner_player_id
		FROM march_order o
		JOIN field_army a ON a.server_id = o.server_id AND a.army_id = o.army_id
		WHERE o.server_id = $1 AND o.status = 1
		  AND o.to_x BETWEEN $2 AND $3 AND o.to_y BETWEEN $4 AND $5
		ORDER BY o.march_id`, sid, minX, maxX, minY, maxY)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MarchLine
	for rows.Next() {
		var line MarchLine
		if err := rows.Scan(&line.MarchID, &line.FromX, &line.FromY, &line.ToX, &line.ToY,
			&line.Phase, &line.ArriveAt, &line.OwnerID); err != nil {
			return nil, err
		}
		out = append(out, line)
	}
	return out, rows.Err()
}

// SaveGarrison persists a wild tile's remaining defenders and recovery deadline.
func (p *PGStore) SaveGarrison(ctx context.Context, serverID int32, x, y int, garrisonJSON []byte, recoverAt time.Time) error {
	_, err := p.Pool.Exec(ctx, `
		UPDATE map_cell SET garrison_json = $4, recover_at = $5
		WHERE server_id = $1 AND x = $2 AND y = $3`, serverID, x, y, garrisonJSON, recoverAt)
	return err
}

// OwnedFields returns the tiles owned by one city, ordered by position.
func (p *PGStore) OwnedFields(ctx context.Context, sid int32, cityID int64) ([]TileView, error) {
	rows, err := p.Pool.Query(ctx, `
		SELECT m.x, m.y, m.terrain, COALESCE(m.resource_type,0), m.resource_level,
		       m.level, m.max_level, m.province_id, m.owner_city_id, m.npc_kind,
		       m.garrison_json, m.recover_at
		FROM map_cell m
		WHERE m.server_id = $1 AND m.owner_city_id = $2
		ORDER BY m.y, m.x`, sid, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TileView
	for rows.Next() {
		var tile TileView
		var recoverAt *time.Time
		if err := rows.Scan(&tile.X, &tile.Y, &tile.Terrain, &tile.ResourceType, &tile.ResourceLevel,
			&tile.Level, &tile.MaxLevel, &tile.ProvinceID, &tile.OwnerCityID, &tile.NpcKind,
			&tile.GarrisonJSON, &recoverAt); err != nil {
			return nil, err
		}
		if recoverAt != nil {
			tile.RecoverAt = *recoverAt
		}
		out = append(out, tile)
	}
	return out, rows.Err()
}

// AbandonField clears ownership only when the tile still belongs to the city.
func (p *PGStore) AbandonField(ctx context.Context, sid int32, cityID int64, x, y int) (bool, error) {
	tag, err := p.Pool.Exec(ctx, `UPDATE map_cell SET owner_city_id = NULL
		WHERE server_id = $1 AND x = $2 AND y = $3 AND owner_city_id = $4`, sid, x, y, cityID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}
