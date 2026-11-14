// Package firstcityledgerpgeffect is an isolated PG17 PENDING→success effect writer (not production).
package firstcityledgerpgeffect

import (
	"context"
	"errors"
	"fmt"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const DefaultFixtureCityID = int64(88001)
const cityMapAdvisoryKey = int64(1128879193)

var ErrUnauthorized = errors.New("firstcityledgerpgeffect: OID §6.12 route unauthorized (obligations)")

type Placement struct {
	CityID, MapX, MapY int32
	CityName           string
}

type Writer struct {
	Evidence  firstcityledgerpgintake.ObligationEvidence
	Placement Placement
}

func (w *Writer) CommitSuccessEffect(ctx context.Context, pool *pgxpool.Pool, a firstcityledgerpgintake.Actor, cmd string) error {
	if w == nil || !w.Evidence.ProfileComplete || !w.Evidence.ThroughCommitDrainOK {
		return ErrUnauthorized
	}
	for _, ok := range w.Evidence.InventoryDrainEvidence {
		if !ok {
			return ErrUnauthorized
		}
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := w.applyInTx(ctx, tx, a, cmd); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (w *Writer) writeReceipt(ctx context.Context, tx pgx.Tx, a firstcityledgerpgintake.Actor, cmd string, cityID int64) error {
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=$5,success_server_id=$2,success_player_id=$3,success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
		a.RealmID, a.ServerID, a.PlayerID, cmd, cityID)
	if err != nil || tag.RowsAffected() != 1 {
		if err == nil {
			return fmt.Errorf("firstcityledgerpgeffect: receipt CAS failed")
		}
		return err
	}
	return nil
}

func (w *Writer) applyInTx(ctx context.Context, tx pgx.Tx, a firstcityledgerpgintake.Actor, cmd string) error {
	pl := w.Placement
	if pl.CityID == 0 {
		pl.CityID = int32(DefaultFixtureCityID)
	}
	if pl.CityName == "" {
		pl.CityName = "pg-effect-city"
	}
	if tx == nil || cmd == "" || a.RealmID == "" || a.ServerID <= 0 || pl.CityID <= 0 {
		return ErrUnauthorized
	}
	if err := w.lockPending(ctx, tx, a, cmd); err != nil {
		return err
	}
	if err := w.writeBusiness(ctx, tx, a, pl); err != nil {
		return err
	}
	return w.writeReceipt(ctx, tx, a, cmd, int64(pl.CityID))
}

func (w *Writer) lockPending(ctx context.Context, tx pgx.Tx, a firstcityledgerpgintake.Actor, cmd string) error {
	for _, sql := range []string{
		`LOCK TABLE account, player IN ROW SHARE MODE`,
		`LOCK TABLE world_first_city_actor_slot, world_first_city_command IN ROW EXCLUSIVE MODE`,
		`LOCK TABLE player_wallet, player_city IN ROW EXCLUSIVE MODE`,
		`LOCK TABLE map_cell IN ROW SHARE MODE`,
		`LOCK TABLE city_troop, city_production_checkpoint, city_building IN ROW EXCLUSIVE MODE`,
	} {
		if _, err := tx.Exec(ctx, sql); err != nil {
			return err
		}
	}
	var st int16
	var acct int64
	if err := tx.QueryRow(ctx, `SELECT status FROM account WHERE account_id=$1 FOR SHARE`, a.AccountID).Scan(&st); err != nil || st != 1 {
		return ErrUnauthorized
	}
	if err := tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=$1 AND player_id=$2 FOR SHARE`, a.ServerID, a.PlayerID).Scan(&acct); err != nil || acct != a.AccountID {
		return ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, a.RealmID, a.ServerID, a.PlayerID); err != nil {
		return err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`, a.RealmID, a.ServerID, a.PlayerID).Scan(&head); err != nil || head == nil || *head != cmd {
		return fmt.Errorf("firstcityledgerpgeffect: slot head mismatch")
	}
	var d int16
	if err := tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR UPDATE`,
		a.RealmID, a.ServerID, a.PlayerID, cmd).Scan(&d); err != nil || d != 1 {
		return fmt.Errorf("firstcityledgerpgeffect: not PENDING")
	}
	return nil
}

func (w *Writer) writeBusiness(ctx context.Context, tx pgx.Tx, a firstcityledgerpgintake.Actor, pl Placement) error {
	sid, cid, pid := a.ServerID, pl.CityID, a.PlayerID
	ops := []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold) VALUES ($1,$2,1000,1000,1000,1000,100) ON CONFLICT DO NOTHING`, []any{sid, pid}},
		{`SELECT 1 FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, []any{sid, pid}},
		{`SELECT pg_advisory_xact_lock($1,$2)`, []any{cityMapAdvisoryKey, sid}},
		{`SELECT 1 FROM map_cell WHERE server_id=$1 AND x=$2 AND y=$3 AND terrain=4 FOR UPDATE`, []any{sid, pl.MapX, pl.MapY}},
		{`INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES ($1,$2,$3,$4,$5,$6,true,1,100)`,
			[]any{sid, cid, pid, pl.CityName, pl.MapX, pl.MapY}},
		{`INSERT INTO mil_city_origin (server_id,city_id,owner_player_id,cohort_id,format_version,created_at)
 VALUES ($1,$2,$3,decode(repeat('01',16),'hex'),1,date_trunc('milliseconds',now() AT TIME ZONE 'UTC'))`, []any{sid, cid, pid}},
		{`INSERT INTO city_troop (server_id,city_id,unit_cfg_id,count) VALUES ($1,$2,1,0)`, []any{sid, cid}},
		{`INSERT INTO city_production_checkpoint (server_id,city_id,player_id,settled_at) VALUES ($1,$2,$3,date_trunc('microseconds',now()))`, []any{sid, cid, pid}},
		{`INSERT INTO city_building (server_id,city_id,slot_key,building_cfg_id,level) VALUES ($1,$2,'town_hall',1,1)`, []any{sid, cid}},
	}
	for _, op := range ops {
		if _, err := tx.Exec(ctx, op.sql, op.args...); err != nil {
			return err
		}
	}
	return nil
}
