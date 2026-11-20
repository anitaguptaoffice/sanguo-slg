package api

import (
	"context"
	"errors"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func officeProto(row hero.CityOffice) *domesticv1.CityOfficeView {
	return &domesticv1.CityOfficeView{
		Office: int32(row.Office), HeroId: row.HeroID, Name: row.Name, Level: row.Level, Loyalty: int32(row.Loyalty),
		Salary: row.Salary, ProductionPct: row.Production, BuildPct: row.BuildSpeed,
		ResearchPct: row.Research, DefensePct: row.Defense, AttackPct: row.Attack,
	}
}

func officeViews(rows []hero.CityOffice) []*domesticv1.CityOfficeView {
	out := make([]*domesticv1.CityOfficeView, 0, len(rows))
	for _, row := range rows {
		out = append(out, officeProto(row))
	}
	return out
}

func (s *Server) officeCity(ctx context.Context, pc PlayerContext, cityID int64) bool {
	city := s.citySnapshot(cityID)
	return s.ownsCity(ctx, pc, cityID) && city != nil && city.PlayerID == pc.PlayerID
}

func (s *Server) handleListCityOffices(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.ListCityOfficesRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if s.heroSvc == nil || !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	rows, err := s.heroSvc.CityOffices(ctx, pc.ServerID, req.GetCityId())
	if err != nil {
		return nil, err
	}
	data, err := marshal(&domesticv1.ListCityOfficesResponse{Offices: officeViews(rows)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSetCityOffice(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.SetCityOfficeRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if s.heroSvc == nil || !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	rows, err := s.heroSvc.SetCityOffice(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID},
		req.GetCityId(), int16(req.GetOffice()), req.GetHeroId(), s.heroCityOwnership(ctx, pc))
	if err != nil {
		if errors.Is(err, hero.ErrInvalidOffice) || errors.Is(err, hero.ErrHeroBusy) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, err.Error()), nil
		}
		return nil, err
	}
	data, err := marshal(&domesticv1.SetCityOfficeResponse{Offices: officeViews(rows)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleClearCityOffice(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.ClearCityOfficeRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if s.heroSvc == nil || !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	rows, err := s.heroSvc.ClearCityOffice(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID},
		req.GetCityId(), int16(req.GetOffice()), s.heroCityOwnership(ctx, pc))
	if err != nil {
		return nil, err
	}
	data, err := marshal(&domesticv1.ClearCityOfficeResponse{Offices: officeViews(rows)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handlePayCityOfficeSalary(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.PayCityOfficeSalaryRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if s.heroSvc == nil || !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	rows, err := s.heroSvc.CityOffices(ctx, pc.ServerID, req.GetCityId())
	if err != nil {
		return nil, err
	}
	cost := hero.TotalOfficeSalary(rows)
	paid := false
	if cost > 0 {
		if _, err := s.domestic.AdjustGold(ctx, req.GetCityId(), -cost); err == nil {
			paid = true
		} else if !errors.Is(err, domestic.ErrInsufficientGold) {
			return nil, err
		}
	}
	rows, err = s.heroSvc.ApplyOfficeSalary(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetCityId(), paid)
	if err != nil {
		return nil, err
	}
	city := s.citySnapshot(req.GetCityId())
	wallet := domestic.Resources{}
	if city != nil {
		wallet = city.Wallet
	}
	data, err := marshal(&domesticv1.PayCityOfficeSalaryResponse{Offices: officeViews(rows), Wallet: walletProto(wallet), Paid: paid})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleRewardCityOfficeHero(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.RewardCityOfficeHeroRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if s.heroSvc == nil || !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	const rewardGold = 500
	if _, err := s.domestic.AdjustGold(ctx, req.GetCityId(), -rewardGold); err != nil {
		if errors.Is(err, domestic.ErrInsufficientGold) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient gold"), nil
		}
		return nil, err
	}
	loyalty, err := s.heroSvc.RewardOfficeHero(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetHeroId(), 10)
	if err != nil {
		return nil, err
	}
	city := s.citySnapshot(req.GetCityId())
	wallet := domestic.Resources{}
	if city != nil {
		wallet = city.Wallet
	}
	data, err := marshal(&domesticv1.RewardCityOfficeHeroResponse{Loyalty: int32(loyalty), Wallet: walletProto(wallet)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
