package api

import (
	"context"
	"errors"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/specialcity"
)

func (s *Server) specialCityService() *specialcity.Service {
	return specialcity.New(s.PlayersPool(), nil)
}

func (s *Server) handleListSpecialCities(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	cities, err := s.specialCityService().List(ctx, pc.ServerID)
	if err != nil {
		return nil, err
	}
	units, err := s.specialCityService().UnlockedUnits(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	out := &worldv1.ListSpecialCitiesResponse{UnlockedUnits: units}
	for _, c := range cities {
		view := &worldv1.SpecialCityView{CityCfgId: c.CfgID, CityType: int32(c.CityType), Name: c.Name,
			X: int32(c.X), Y: int32(c.Y), OwnerGuildId: c.OwnerGuildID, OwnerGuildName: c.OwnerGuildName,
			Garrison: c.Total(), WallLevel: c.WallLevel, HeroName: c.HeroName, HeroLevel: int32(c.HeroLevel),
			UnitCfgId: c.UnitCfgID, UnitName: c.UnitName}
		if !c.NextRecoverAt.IsZero() && c.NextRecoverAt.Unix() > 0 {
			view.NextRecoverAtMs = c.NextRecoverAt.UnixMilli()
		}
		out.Cities = append(out.Cities, view)
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleClaimSpecialCityTax(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	tax, err := s.specialCityService().ClaimTax(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		code := commonv1.ErrorCode_COMMON_INVALID_PACKET
		if errors.Is(err, specialcity.ErrInsufficient) {
			code = commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE
		}
		return errResp(pkt.GetTraceId(), code, err.Error()), nil
	}
	data, err := marshal(&worldv1.ClaimSpecialCityTaxResponse{Cities: tax.Cities, Food: tax.Food, Wood: tax.Wood,
		Stone: tax.Stone, Iron: tax.Iron, Gold: tax.Gold})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleRecruitSpecialTroops(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.RecruitSpecialTroopsRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	total, err := s.specialCityService().Recruit(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(),
		req.GetUnitCfgId(), req.GetCount())
	if err != nil {
		code := commonv1.ErrorCode_COMMON_INVALID_PACKET
		if errors.Is(err, specialcity.ErrInsufficient) {
			code = commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE
		}
		return errResp(pkt.GetTraceId(), code, err.Error()), nil
	}
	data, err := marshal(&worldv1.RecruitSpecialTroopsResponse{CityTroopCount: total})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
