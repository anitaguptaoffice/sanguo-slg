package api

import (
	"context"
	"errors"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) historicalService() *hero.HistoricalService {
	return hero.NewHistorical(s.PlayersPool(), hero.NewPGStore(s.PlayersPool()), s.now)
}

func historicalProto(h hero.HistoricalHero) *herov1.HistoricalHeroView {
	return &herov1.HistoricalHeroView{
		NpcCfgId: h.NpcCfgID, TemplateCfgId: h.TemplateCfgID, DisplayName: h.DisplayName,
		Level: h.Level, Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command,
		X: h.X, Y: h.Y, State: int32(h.State), OwnerPlayerId: h.OwnerPlayerID,
		CityId: h.CityID, Friend: h.Friend, Discovered: h.Discovered,
	}
}

func (s *Server) handleListHistoricalHeroes(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.ListHistoricalHeroesRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	rows, err := s.historicalService().List(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	out := make([]*herov1.HistoricalHeroView, 0, len(rows))
	for _, h := range rows {
		out = append(out, historicalProto(h))
	}
	data, err := marshal(&herov1.ListHistoricalHeroesResponse{Heroes: out})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSearchHistoricalHero(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.SearchHistoricalHeroRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetNpcCfgId() <= 0 || !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid search"), nil
	}
	h, gold, err := s.historicalService().Search(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetNpcCfgId())
	if err != nil {
		return historicalErr(pkt, err), nil
	}
	data, err := marshal(&herov1.SearchHistoricalHeroResponse{Hero: historicalProto(h), Gold: gold})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handlePersuadeHistoricalHero(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req herov1.PersuadeHistoricalHeroRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetNpcCfgId() <= 0 || !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid persuade"), nil
	}
	heroRecord, gold, err := s.historicalService().Persuade(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetNpcCfgId())
	if err != nil {
		if s.log != nil {
			s.log.Error("historical persuade failed", "err", err)
		}
		return historicalErr(pkt, err), nil
	}
	rows, err := s.historicalService().List(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return nil, err
	}
	var view hero.HistoricalHero
	for _, row := range rows {
		if row.NpcCfgID == req.GetNpcCfgId() {
			view = row
			break
		}
	}
	data, err := marshal(&herov1.PersuadeHistoricalHeroResponse{
		Hero: historicalProto(view), HeroId: heroRecord.HeroID, Gold: gold,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func historicalErr(pkt *commonv1.ClientPacket, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, hero.ErrInsufficientGold), errors.Is(err, hero.ErrHistoricalItem):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient gold or jewel")
	case errors.Is(err, hero.ErrHotelNotBuilt):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "inn not built")
	case errors.Is(err, hero.ErrHistoricalState), errors.Is(err, hero.ErrHistoricalNotFound):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "historical hero unavailable")
	}
	return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "historical hero unavailable")
}
