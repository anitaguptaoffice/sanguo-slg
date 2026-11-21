package api

import (
	"context"
	"errors"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/trick"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleCastTrick(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.CastTrickRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	roll := int(time.Now().UnixNano() % 100)
	if roll < 0 {
		roll = -roll
	}
	res, err := trick.New(s.PlayersPool(), s.now).Cast(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(),
		req.GetTrickType(), req.GetTargetMarchId(), roll)
	if err != nil {
		switch {
		case errors.Is(err, trick.ErrNoStrategist):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "strategist required"), nil
		case errors.Is(err, trick.ErrTrickItem):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "talisman missing"), nil
		case errors.Is(err, trick.ErrTrickTarget):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid trick target"), nil
		}
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "trick unavailable"), nil
	}
	if res.NewDeadline != nil {
		if err := s.military.ApplySpeedup(req.GetTargetMarchId(), *res.NewDeadline); err != nil {
			return nil, err
		}
	}
	out := &militaryv1.CastTrickResponse{CastId: res.CastID, Success: res.Success, Roll: int32(res.Roll), Chance: int32(res.Chance)}
	if res.NewDeadline != nil {
		out.NewDeadlineMs = res.NewDeadline.UnixMilli()
	}
	if res.FeintUntil != nil {
		out.FeintUntilMs = res.FeintUntil.UnixMilli()
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
