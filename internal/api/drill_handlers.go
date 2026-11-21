package api

import (
	"context"
	"errors"
	"fmt"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
)

func drillStacks(rows []*militaryv1.DrillTroop) ([]march.TroopStack, bool) {
	var out []march.TroopStack
	var total int64
	for _, row := range rows {
		if row.GetUnitCfgId() < 1 || row.GetUnitCfgId() > 12 || row.GetCount() <= 0 {
			return nil, false
		}
		total += int64(row.GetCount())
		if total > 100000 {
			return nil, false
		}
		out = append(out, march.TroopStack{UnitCfgID: row.GetUnitCfgId(), Count: row.GetCount()})
	}
	return out, len(out) > 0
}

func (s *Server) drillWalls(ctx context.Context, serverID int32, cityID int64) []battle.WallGroup {
	var trap, stakes, tower, log, rock int
	var wallLevel int32
	err := s.PlayersPool().QueryRow(ctx, `SELECT c.wall_trap,c.wall_stakes,c.wall_tower,c.wall_log,c.wall_rock,
		COALESCE((SELECT MAX(level) FROM city_building WHERE server_id=c.server_id AND city_id=c.city_id
			AND building_cfg_id=7),0)
		FROM city_civic c WHERE c.server_id=$1 AND c.city_id=$2`, serverID, cityID).
		Scan(&trap, &stakes, &tower, &log, &rock, &wallLevel)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return nil
	}
	var out []battle.WallGroup
	for _, item := range []struct {
		code  string
		count int
	}{{"trap", trap}, {"stakes", stakes}, {"tower", tower}, {"log", log}, {"rock", rock}} {
		if g, ok := battle.WallDefense(item.code, item.count, wallLevel); ok {
			out = append(out, g)
		}
	}
	return out
}

func (s *Server) handleRunDrill(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.RunDrillRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	level, err := s.drillLevel(ctx, pc.ServerID, req.GetCityId())
	if err != nil {
		return nil, err
	}
	if level < 1 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "drill ground not built"), nil
	}
	attacker, okA := drillStacks(req.GetAttacker())
	defender, okD := drillStacks(req.GetDefender())
	if !okA || !okD {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid drill troops"), nil
	}
	catalog := march.DefaultUnitCatalog()
	defenderArmy := combat.ArmyFromStacks(catalog, defender, 0, 1)
	defenderArmy.Defenses = s.drillWalls(ctx, pc.ServerID, req.GetCityId())
	rep := battle.Simulate(battle.BattleInput{
		BattleID:   fmt.Sprintf("drill-%d-%d", req.GetCityId(), time.Now().UnixNano()),
		AttackerID: "drill-attacker", DefenderID: "drill-defender",
		Attacker: combat.ArmyFromStacks(catalog, attacker, 0, 1),
		Defender: defenderArmy,
	})
	data, err := marshal(&militaryv1.RunDrillResponse{Detail: battleReportDetailProto(rep)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
