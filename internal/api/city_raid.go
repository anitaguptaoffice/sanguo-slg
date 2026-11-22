package api

import (
	"context"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

func (s *Server) cityDefense(ctx context.Context, x, y int) (*combat.CityDefense, error) {
	var out combat.CityDefense
	var protection *time.Time
	var capital bool
	err := s.PlayersPool().QueryRow(ctx, `SELECT city_id,player_id,name,is_capital,COALESCE(complaint,0),COALESCE(rule,100),protection_until
		FROM player_city WHERE server_id=$1 AND x=$2 AND y=$3`, defaultServerID, x, y).
		Scan(&out.CityID, &out.PlayerID, &out.Name, &capital, &out.Complaint, &out.Rule, &protection)
	if err != nil {
		return nil, err
	}
	out.IsCapital = capital
	if protection != nil {
		out.ProtectionUntil = *protection
	}
	var hall int32
	_ = s.PlayersPool().QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=1`, defaultServerID, out.CityID).Scan(&hall)
	out.Protected = protection != nil && protection.After(time.Now()) && hall < 5
	rows, err := s.PlayersPool().Query(ctx, `SELECT unit_cfg_id,count FROM city_troop
		WHERE server_id=$1 AND city_id=$2 AND count>0 ORDER BY unit_cfg_id`, defaultServerID, out.CityID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var st march.TroopStack
		if err := rows.Scan(&st.UnitCfgID, &st.Count); err != nil {
			rows.Close()
			return nil, err
		}
		out.Troops = append(out.Troops, st)
	}
	rows.Close()
	if allies, aerr := guild.NewDiplomacy(s.PlayersPool(), nil).GarrisonTroops(ctx, defaultServerID, out.CityID); aerr == nil {
		out.Troops = append(out.Troops, allies...)
	}
	var wallLevel int32
	var trap, stakes, tower, log, rock int32
	err = s.PlayersPool().QueryRow(ctx, `SELECT COALESCE((SELECT MAX(level) FROM city_building WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=7),0),
		COALESCE((SELECT wall_trap FROM city_civic WHERE server_id=$1 AND city_id=$2),0),
		COALESCE((SELECT wall_stakes FROM city_civic WHERE server_id=$1 AND city_id=$2),0),
		COALESCE((SELECT wall_tower FROM city_civic WHERE server_id=$1 AND city_id=$2),0),
		COALESCE((SELECT wall_log FROM city_civic WHERE server_id=$1 AND city_id=$2),0),
		COALESCE((SELECT wall_rock FROM city_civic WHERE server_id=$1 AND city_id=$2),0)`,
		defaultServerID, out.CityID).Scan(&wallLevel, &trap, &stakes, &tower, &log, &rock)
	if err == nil {
		for _, item := range []struct {
			code  string
			count int32
		}{{"trap", trap}, {"stakes", stakes}, {"tower", tower}, {"log", log}, {"rock", rock}} {
			if g, ok := battle.WallDefense(item.code, int(item.count), wallLevel); ok {
				out.Walls = append(out.Walls, g)
			}
		}
	}
	return &out, nil
}

func (s *Server) applyCityRaid(ctx context.Context, ev march.MarchArrivalEvent, city *combat.CityDefense) (*march.LootRecord, error) {
	if city == nil || city.PlayerID == ev.PlayerID {
		return nil, nil
	}
	tx, err := s.PlayersPool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var food, wood, stone, iron, gold int64
	if err := tx.QueryRow(ctx, `SELECT food,wood,stone,iron,gold FROM player_wallet
		WHERE server_id=$1 AND player_id=$2 FOR UPDATE`, defaultServerID, city.PlayerID).Scan(&food, &wood, &stone, &iron, &gold); err != nil {
		return nil, err
	}
	var warehouse int32
	_ = tx.QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=16`, defaultServerID, city.CityID).Scan(&warehouse)
	wallet := domestic.Resources{Food: food, Wood: wood, Stone: stone, Iron: iron}
	protected := domestic.StorehouseProtected(wallet, warehouse)
	loot := march.LootRecord{
		Food: (food - protected.Food) / 2, Wood: (wood - protected.Wood) / 2,
		Stone: (stone - protected.Stone) / 2, Iron: (iron - protected.Iron) / 2, Gold: gold / 4,
	}
	if loot.Food < 0 {
		loot.Food = 0
	}
	if loot.Wood < 0 {
		loot.Wood = 0
	}
	if loot.Stone < 0 {
		loot.Stone = 0
	}
	if loot.Iron < 0 {
		loot.Iron = 0
	}
	if loot.Gold < 0 {
		loot.Gold = 0
	}
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET food=food-$3,wood=wood-$4,stone=stone-$5,iron=iron-$6,gold=gold-$7
		WHERE server_id=$1 AND player_id=$2`, defaultServerID, city.PlayerID, loot.Food, loot.Wood, loot.Stone, loot.Iron, loot.Gold); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE player_wallet SET food=food+$3,wood=wood+$4,stone=stone+$5,iron=iron+$6,gold=gold+$7
		WHERE server_id=$1 AND player_id=$2`, defaultServerID, ev.PlayerID, loot.Food, loot.Wood, loot.Stone, loot.Iron, loot.Gold); err != nil {
		return nil, err
	}
	complaint := city.Complaint + 10
	if complaint > 100 {
		complaint = 100
	}
	rule := city.Rule
	transferred := false
	if ev.Order.Purpose == combat.PurposeOccupy && !city.IsCapital {
		rule -= 25
		if rule <= 0 {
			rule, complaint, transferred = 100, 0, true
		}
	}
	if transferred {
		if _, err := tx.Exec(ctx, `UPDATE player_city SET player_id=$3,complaint=0,rule=100,protection_until=NULL
			WHERE server_id=$1 AND city_id=$2`, defaultServerID, city.CityID, ev.PlayerID); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE mil_city_origin SET owner_player_id=$3 WHERE server_id=$1 AND city_id=$2`,
			defaultServerID, city.CityID, ev.PlayerID); err != nil {
			return nil, err
		}
	} else if _, err := tx.Exec(ctx, `UPDATE player_city SET complaint=$3,rule=$4 WHERE server_id=$1 AND city_id=$2`,
		defaultServerID, city.CityID, complaint, rule); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &loot, nil
}
