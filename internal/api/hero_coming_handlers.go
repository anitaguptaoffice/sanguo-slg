package api

import (
	"context"
	"errors"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleListComingHeroes(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.ListComingHeroesRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	p := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	rows, meta, err := s.heroSvc.ListComingHeroes(ctx, p)
	if err != nil {
		return nil, err
	}
	out := make([]*herov1.ComingHeroSummary, 0, len(rows))
	for _, h := range rows {
		cityID := int64(0)
		if rec, ok := meta[h.HeroID]; ok {
			cityID = rec.CityID
		}
		out = append(out, &herov1.ComingHeroSummary{
			HeroId: h.HeroID, CityId: cityID, TemplateCfgId: h.TemplateCfgID, DisplayName: h.DisplayName,
			Level: h.Level, Loyalty: int32(h.Loyalty),
			Attributes: &herov1.HeroAttributes{
				Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command,
			},
		})
	}
	data, err := marshal(&herov1.ListComingHeroesResponse{Coming: out})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleTryAcceptComing(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.TryAcceptComingRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	p := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	res, err := s.heroSvc.TryAcceptComing(ctx, p, req.GetCityId(), req.GetHeroId())
	if err != nil {
		return comingErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.TryAcceptComingResponse{
		HeroId: res.Hero.HeroID, Summary: res.Summary,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSureAcceptComing(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.SureAcceptComingRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	p := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	res, err := s.heroSvc.SureAcceptComing(ctx, p, hero.CityRef{CityID: req.GetCityId()}, req.GetHeroId(), s.heroHotelCityPort())
	if err != nil {
		return comingErr(pkt.GetTraceId(), err), nil
	}
	h := res.Hero
	data, err := marshal(&herov1.SureAcceptComingResponse{
		HeroId: h.HeroID, DisplayName: h.DisplayName, Level: h.Level, Loyalty: int32(h.Loyalty),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleRejectComing(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.RejectComingRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	p := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	if err := s.heroSvc.RejectComing(ctx, p, req.GetCityId(), req.GetHeroId()); err != nil {
		return comingErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.RejectComingResponse{HeroId: req.GetHeroId()})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func comingErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, hero.ErrHeroNotComing), errors.Is(err, hero.ErrComingCityMismatch):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrHotelCapacityFull):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrHeroNotFound):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	default:
		return heroErr(trace, err)
	}
}
