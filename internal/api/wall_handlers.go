package api

import (
	"context"
	"errors"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
)

func wallViews(rows []domestic.WallDefenseView) []*domesticv1.WallDefenseView {
	out := make([]*domesticv1.WallDefenseView, 0, len(rows))
	for _, row := range rows {
		out = append(out, &domesticv1.WallDefenseView{
			DefenseType: row.Type, Code: row.Code, Name: row.Name, Count: row.Count, Space: row.Space,
			Cost: walletProto(row.Cost),
		})
	}
	return out
}

func (s *Server) handleListWallDefenses(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.ListWallDefensesRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	rows, area, used, err := s.domestic.WallDefenses(ctx, req.GetCityId())
	if err != nil {
		return nil, err
	}
	data, err := marshal(&domesticv1.ListWallDefensesResponse{Defenses: wallViews(rows), WallArea: area, AreaUsed: used})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleBuildWallDefense(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.BuildWallDefenseRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	rows, area, used, err := s.domestic.BuildWallDefense(ctx, req.GetCityId(), req.GetDefenseType())
	if err != nil {
		switch {
		case errors.Is(err, domestic.ErrWallCapacity):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "wall area exhausted"), nil
		case errors.Is(err, domestic.ErrInsufficientRes):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient resources"), nil
		case errors.Is(err, domestic.ErrWallUnavailable):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "wall unavailable"), nil
		}
		return nil, err
	}
	city := s.citySnapshot(req.GetCityId())
	wallet := domestic.Resources{}
	if city != nil {
		wallet = city.Wallet
	}
	data, err := marshal(&domesticv1.BuildWallDefenseResponse{Defenses: wallViews(rows), WallArea: area, AreaUsed: used,
		Wallet: walletProto(wallet)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleHealWounded(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.HealWoundedRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetCount() <= 0 || req.GetUnitCfgId() < 1 || req.GetUnitCfgId() > 12 || !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid heal request"), nil
	}
	const goldPerUnit = 3
	var healed, wounded, ready int32
	var gold int64
	err := pgx.BeginFunc(ctx, s.players.Pool, func(tx pgx.Tx) error {
		var playerID int64
		if err := tx.QueryRow(ctx, `SELECT player_id FROM player_city WHERE server_id=$1 AND city_id=$2`,
			pc.ServerID, req.GetCityId()).Scan(&playerID); err != nil {
			return err
		}
		if playerID != pc.PlayerID {
			return domestic.ErrCityNotFound
		}
		var count, wound int32
		if err := tx.QueryRow(ctx, `SELECT count,wounded FROM city_troop WHERE server_id=$1 AND city_id=$2 AND unit_cfg_id=$3 FOR UPDATE`,
			pc.ServerID, req.GetCityId(), req.GetUnitCfgId()).Scan(&count, &wound); err != nil {
			return err
		}
		healed = req.GetCount()
		if healed > wound {
			healed = wound
		}
		if healed <= 0 {
			return domestic.ErrCivicInvalid
		}
		cost := int64(healed) * goldPerUnit
		if err := tx.QueryRow(ctx, `SELECT gold FROM player_wallet WHERE server_id=$1 AND player_id=$2 FOR UPDATE`,
			pc.ServerID, pc.PlayerID).Scan(&gold); err != nil {
			return err
		}
		if gold < cost {
			return domestic.ErrInsufficientGold
		}
		gold -= cost
		if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=$3 WHERE server_id=$1 AND player_id=$2`,
			pc.ServerID, pc.PlayerID, gold); err != nil {
			return err
		}
		wounded = wound - healed
		ready = count + healed
		_, err := tx.Exec(ctx, `UPDATE city_troop SET count=$4,wounded=$5 WHERE server_id=$1 AND city_id=$2 AND unit_cfg_id=$3`,
			pc.ServerID, req.GetCityId(), req.GetUnitCfgId(), ready, wounded)
		return err
	})
	if err != nil {
		switch {
		case errors.Is(err, domestic.ErrInsufficientGold), errors.Is(err, domestic.ErrInsufficientRes):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient gold"), nil
		case errors.Is(err, domestic.ErrCivicInvalid):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "no wounded to heal"), nil
		}
		return nil, err
	}
	data, err := marshal(&domesticv1.HealWoundedResponse{Healed: healed, Wounded: wounded, Ready: ready, Gold: gold})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
