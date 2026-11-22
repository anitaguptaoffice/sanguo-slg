package api

import (
	"context"
	"time"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
)

func (s *Server) handleUseTruceToken(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.UseTruceTokenRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	var until time.Time
	err := pgx.BeginFunc(ctx, s.PlayersPool(), func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `UPDATE player_item SET quantity=quantity-1 WHERE server_id=$1 AND player_id=$2
			AND item_cfg_id=2050 AND quantity>0`, pc.ServerID, pc.PlayerID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return errCityCost
		}
		return tx.QueryRow(ctx, `UPDATE player_city SET protection_until=GREATEST(COALESCE(protection_until,now()),now())+interval '8 hours'
			WHERE server_id=$1 AND city_id=$2 RETURNING protection_until`, pc.ServerID, req.GetCityId()).Scan(&until)
	})
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "truce token missing"), nil
	}
	data, err := marshal(&worldv1.UseTruceTokenResponse{ProtectionUntilMs: until.UnixMilli()})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
