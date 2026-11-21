package api

import (
	"context"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

const drillGroundCfgID int32 = 9

func (s *Server) drillLevel(ctx context.Context, serverID int32, cityID int64) (int32, error) {
	var level int32
	err := s.PlayersPool().QueryRow(ctx, `SELECT COALESCE(MAX(level),0) FROM city_building
		WHERE server_id=$1 AND city_id=$2 AND building_cfg_id=$3`, serverID, cityID, drillGroundCfgID).Scan(&level)
	return level, err
}

func (s *Server) tacticPresets(ctx context.Context, serverID int32, cityID int64) ([]*militaryv1.TacticPresetView, error) {
	rows, err := s.PlayersPool().Query(ctx, `SELECT troop_type,target_type,hold FROM city_tactic
		WHERE server_id=$1 AND city_id=$2`, serverID, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := make(map[int32]bool)
	presets := make([]*militaryv1.TacticPresetView, 0, 4)
	for rows.Next() {
		var troop, target int32
		var hold bool
		if err := rows.Scan(&troop, &target, &hold); err != nil {
			return nil, err
		}
		seen[troop] = true
		presets = append(presets, &militaryv1.TacticPresetView{TroopType: troop, TargetType: target, Hold: hold})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for troop := int32(0); troop < 4; troop++ {
		if !seen[troop] {
			presets = append(presets, &militaryv1.TacticPresetView{TroopType: troop, TargetType: -1})
		}
	}
	return presets, nil
}

func (s *Server) handleListTacticPresets(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.ListTacticPresetsRequest
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
	presets, err := s.tacticPresets(ctx, pc.ServerID, req.GetCityId())
	if err != nil {
		return nil, err
	}
	data, err := marshal(&militaryv1.ListTacticPresetsResponse{Presets: presets, DrillLevel: level})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSetTacticPreset(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.SetTacticPresetRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	if req.GetTroopType() < 0 || req.GetTroopType() > 3 || req.GetTargetType() < -1 || req.GetTargetType() > 3 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid tactic"), nil
	}
	level, err := s.drillLevel(ctx, pc.ServerID, req.GetCityId())
	if err != nil {
		return nil, err
	}
	if level < 1 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "drill ground not built"), nil
	}
	if _, err := s.PlayersPool().Exec(ctx, `INSERT INTO city_tactic(server_id,city_id,troop_type,target_type,hold)
		VALUES($1,$2,$3,$4,$5)
		ON CONFLICT (server_id,city_id,troop_type) DO UPDATE SET target_type=EXCLUDED.target_type,hold=EXCLUDED.hold`,
		pc.ServerID, req.GetCityId(), req.GetTroopType(), req.GetTargetType(), req.GetHold()); err != nil {
		return nil, err
	}
	presets, err := s.tacticPresets(ctx, pc.ServerID, req.GetCityId())
	if err != nil {
		return nil, err
	}
	data, err := marshal(&militaryv1.SetTacticPresetResponse{Presets: presets})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
