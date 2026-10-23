package world

import (
	"context"

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
		`SELECT x,y,terrain,COALESCE(resource_type,0),resource_level FROM map_cell
		 WHERE server_id=$1 AND x>=$2 AND x<$3 AND y>=$4 AND y<$5`, sid, minX, maxX, minY, maxY)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	var out []Cell
	for rows.Next() {
		var c Cell
		if err := rows.Scan(&c.X, &c.Y, &c.Terrain, &c.ResourceType, &c.ResourceLevel); err != nil {
			return nil, false, err
		}
		out = append(out, c)
	}
	return out, len(out) > 0, rows.Err()
}

func (p *PGStore) SaveChunk(ctx context.Context, sid int32, cells []Cell) error {
	q := `INSERT INTO map_cell(server_id,x,y,terrain,resource_type,resource_level)
		VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(server_id,x,y) DO UPDATE SET
		terrain=EXCLUDED.terrain,resource_type=EXCLUDED.resource_type,resource_level=EXCLUDED.resource_level`
	for _, c := range cells {
		var rt *int16
		if c.ResourceType != 0 {
			rt = &c.ResourceType
		}
		if _, err := p.Pool.Exec(ctx, q, sid, c.X, c.Y, c.Terrain, rt, c.ResourceLevel); err != nil {
			return err
		}
	}
	return nil
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
