package api

import (
	"context"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleBeginHeroExpr(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.BeginHeroExprRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	res, err := s.heroSvc.BeginExprPlayer(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, s.heroInventoryPort(), req.GetHeroId(), req.GetHours())
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.BeginHeroExprResponse{
		HeroId: res.Hero.HeroID, Status: int32(res.Hero.Status),
		EndsAtMs: res.Session.EndsAt.UnixMilli(), GoldSpent: res.GoldSpent, Hours: res.Session.Hours,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleCancelHeroExpr(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.CancelHeroExprRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	h, err := s.heroSvc.CancelExprPlayer(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetHeroId())
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.CancelHeroExprResponse{HeroId: h.HeroID, Status: int32(h.Status)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleFinishHeroExpr(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.FinishHeroExprRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	res, err := s.heroSvc.FinishExprPlayer(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetHeroId())
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(exprFinishResponse(res))
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleFasterHeroExpr(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.FasterHeroExprRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	res, err := s.heroSvc.FasterExprPlayer(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetHeroId())
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.FasterHeroExprResponse{
		HeroId: res.Hero.HeroID, Status: int32(res.Hero.Status),
		ExpGained: res.ExpGained, Exp: res.Hero.Exp,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func exprFinishResponse(res hero.ExprFinishResult) *herov1.FinishHeroExprResponse {
	return &herov1.FinishHeroExprResponse{
		HeroId: res.Hero.HeroID, Status: int32(res.Hero.Status),
		ExpGained: res.ExpGained, Exp: res.Hero.Exp,
	}
}
