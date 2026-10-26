package api

import (
	"context"
	"errors"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleListCaptiveHeroes(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.ListCaptiveHeroesRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	rows, meta, err := s.familyOffers(ctx, pc, hero.StatusCaptive)
	if err != nil {
		return captiveErr(pkt.GetTraceId(), err), nil
	}
	out := make([]*herov1.CaptiveHeroSummary, 0, len(rows))
	for _, h := range rows {
		cityID := int64(0)
		if rec, ok := meta[h.HeroID]; ok {
			cityID = rec
		}
		out = append(out, &herov1.CaptiveHeroSummary{
			HeroId: h.HeroID, CityId: cityID, TemplateCfgId: h.TemplateCfgID, DisplayName: h.DisplayName,
			Level: h.Level, Loyalty: int32(h.Loyalty),
			Attributes: &herov1.HeroAttributes{
				Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command,
			},
		})
	}
	data, err := marshal(&herov1.ListCaptiveHeroesResponse{Captives: out})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleTrySummonCaptive(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.TrySummonCaptiveRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetHeroId() <= 0 || (req.GetServerId() != 0 && req.GetServerId() != pc.ServerID) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	res, err := s.captiveAtomic(ctx, pc, req.GetCityId(), req.GetHeroId(), captivePreview)
	if err != nil {
		return captiveErr(pkt.GetTraceId(), err), nil
	}
	items := make([]*herov1.SummonCostItem, 0, len(res.Items))
	for _, it := range res.Items {
		items = append(items, &herov1.SummonCostItem{ItemCfgId: it.ItemCfgID, Quantity: it.Quantity})
	}
	data, err := marshal(&herov1.TrySummonCaptiveResponse{
		HeroId: res.Hero.HeroID, GoldCost: res.GoldCost, Items: items, Summary: res.Summary,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSureSummonCaptive(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.SureSummonCaptiveRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetHeroId() <= 0 || (req.GetServerId() != 0 && req.GetServerId() != pc.ServerID) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	res, err := s.captiveAtomic(ctx, pc, req.GetCityId(), req.GetHeroId(), captiveSummon)
	if err != nil {
		return captiveErr(pkt.GetTraceId(), err), nil
	}
	h := res.Hero
	data, err := marshal(&herov1.SureSummonCaptiveResponse{
		HeroId: h.HeroID, DisplayName: h.DisplayName, Level: h.Level, Loyalty: int32(h.Loyalty),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleReleaseCaptive(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.ReleaseCaptiveRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetHeroId() <= 0 || (req.GetServerId() != 0 && req.GetServerId() != pc.ServerID) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	if _, err := s.captiveAtomic(ctx, pc, req.GetCityId(), req.GetHeroId(), captiveRelease); err != nil {
		return captiveErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.ReleaseCaptiveResponse{HeroId: req.GetHeroId()})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func captiveErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, hero.ErrHeroNotCaptive), errors.Is(err, hero.ErrCaptiveCityMismatch):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrHotelCapacityFull), errors.Is(err, hero.ErrInsufficientGold), errors.Is(err, hero.ErrInsufficientItem):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrHeroNotFound):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	default:
		return familyErr(trace, err)
	}
}
