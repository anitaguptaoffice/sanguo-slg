package api

import (
	"context"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleAddHeroPoint(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.AddHeroPointRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	res, err := s.heroSvc.AddHeroPointPlayer(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, hero.AddHeroPointRequest{
		HeroID: req.GetHeroId(), Politics: req.GetPolitics(), Force: req.GetForce(), Intel: req.GetIntel(),
	})
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(pointResponse(res))
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleClearHeroPoint(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.ClearHeroPointRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	res, err := s.heroSvc.ClearHeroPointPlayer(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetHeroId())
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(clearPointResponse(res))
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func pointResponse(res hero.PointResult) *herov1.AddHeroPointResponse {
	h := res.Hero
	return &herov1.AddHeroPointResponse{
		HeroId: h.HeroID, PotentialRemaining: res.PotentialRemaining,
		ForceAdd: h.ForceAdd, IntelAdd: h.IntelAdd, PoliticsAdd: h.PoliticsAdd,
		Attributes: &herov1.HeroAttributes{
			Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command,
		},
	}
}

func clearPointResponse(res hero.PointResult) *herov1.ClearHeroPointResponse {
	h := res.Hero
	return &herov1.ClearHeroPointResponse{
		HeroId: h.HeroID, PotentialRemaining: res.PotentialRemaining,
		ForceAdd: h.ForceAdd, IntelAdd: h.IntelAdd, PoliticsAdd: h.PoliticsAdd,
		Attributes: &herov1.HeroAttributes{
			Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command,
		},
	}
}
