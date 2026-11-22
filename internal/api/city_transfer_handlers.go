package api

import (
	"context"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
)

func (s *Server) handleTransferCityTroops(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.TransferCityTroopsRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetFromCityId() == req.GetToCityId() || req.GetUnitCfgId() < 1 || req.GetUnitCfgId() > 12 || req.GetCount() <= 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid transfer"), nil
	}
	if !s.officeCity(ctx, pc, req.GetFromCityId()) || !s.officeCity(ctx, pc, req.GetToCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	var fromCount, toCount int32
	err := pgx.BeginFunc(ctx, s.PlayersPool(), func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `UPDATE city_troop SET count=count-$4 WHERE server_id=$1 AND city_id=$2
			AND unit_cfg_id=$3 AND count >= $4`, pc.ServerID, req.GetFromCityId(), req.GetUnitCfgId(), req.GetCount())
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return errCityCost
		}
		if _, err := tx.Exec(ctx, `INSERT INTO city_troop(server_id,city_id,unit_cfg_id,count,wounded)
			VALUES($1,$2,$3,$4,0) ON CONFLICT (server_id,city_id,unit_cfg_id)
			DO UPDATE SET count=city_troop.count+EXCLUDED.count`, pc.ServerID, req.GetToCityId(), req.GetUnitCfgId(), req.GetCount()); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `SELECT count FROM city_troop WHERE server_id=$1 AND city_id=$2 AND unit_cfg_id=$3`,
			pc.ServerID, req.GetFromCityId(), req.GetUnitCfgId()).Scan(&fromCount); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `SELECT count FROM city_troop WHERE server_id=$1 AND city_id=$2 AND unit_cfg_id=$3`,
			pc.ServerID, req.GetToCityId(), req.GetUnitCfgId()).Scan(&toCount)
	})
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient troops"), nil
	}
	data, err := marshal(&worldv1.TransferCityTroopsResponse{FromCount: fromCount, ToCount: toCount})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
