package api

import (
	"context"
	"errors"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleListHotelRecruitCandidates(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil || s.heroSvc.HotelStore == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hotel recruit not wired"), nil
	}
	var req herov1.ListHotelRecruitCandidatesRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetCityId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id required"), nil
	}
	p := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	city := hero.CityRef{CityID: req.GetCityId()}
	port := s.heroHotelCityPort()
	rows, err := s.heroSvc.ListHotelCandidates(ctx, p, city, s.heroSvc.HotelStore, port)
	if err != nil {
		return hotelErr(pkt.GetTraceId(), err), nil
	}
	hotelLevel, _ := port.HotelLevel(ctx, pc.ServerID, req.GetCityId())
	officeLevel, _ := port.OfficeLevel(ctx, pc.ServerID, req.GetCityId())
	heroes, _ := s.heroSvc.ListPlayerHeroes(ctx, p, hero.ListQuery{})
	out := hotelCandidatesToProto(rows)
	data, err := marshal(&herov1.ListHotelRecruitCandidatesResponse{
		Candidates: out, HotelLevel: hotelLevel, HeroCapacity: officeLevel, HeroOwned: int32(heroes.Total),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleRefreshHotelRecruitPool(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil || s.heroSvc.HotelStore == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hotel recruit not wired"), nil
	}
	var req herov1.RefreshHotelRecruitPoolRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetCityId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id required"), nil
	}
	p := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	city := hero.CityRef{CityID: req.GetCityId()}
	port := s.heroHotelCityPort()
	if err := s.heroSvc.RefreshHotelPoolPaid(ctx, p, city, s.heroSvc.HotelStore, port); err != nil {
		return hotelErr(pkt.GetTraceId(), err), nil
	}
	rows, err := s.heroSvc.HotelStore.ListCandidates(ctx, pc.ServerID, req.GetCityId())
	if err != nil {
		return nil, err
	}
	data, err := marshal(&herov1.RefreshHotelRecruitPoolResponse{Candidates: hotelCandidatesToProto(rows)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleRecruitHotelCandidate(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil || s.heroSvc.HotelStore == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hotel recruit not wired"), nil
	}
	var req herov1.RecruitHotelCandidateRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetCityId() == 0 || req.GetCandidateId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id and candidate_id required"), nil
	}
	p := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	res, err := s.heroSvc.RecruitHotelCandidate(ctx, p, hero.CityRef{CityID: req.GetCityId()},
		s.heroSvc.HotelStore, s.heroHotelCityPort(), req.GetCandidateId())
	if err != nil {
		return hotelErr(pkt.GetTraceId(), err), nil
	}
	s.questAfterRecruitHero(ctx, pc.ServerID, pc.PlayerID)
	data, err := marshal(&herov1.RecruitHotelCandidateResponse{
		HeroId: res.Hero.HeroID, DisplayName: res.Hero.DisplayName,
		Level: res.Hero.Level, Loyalty: int32(res.Hero.Loyalty),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func hotelCandidatesToProto(rows []*hero.HotelCandidate) []*herov1.HotelRecruitCandidate {
	out := make([]*herov1.HotelRecruitCandidate, 0, len(rows))
	for _, c := range rows {
		out = append(out, &herov1.HotelRecruitCandidate{
			CandidateId: c.CandidateID, CityId: c.CityID, DisplayName: c.DisplayName,
			Sex: int32(c.Sex), FaceId: c.FaceID, Level: c.Level, Loyalty: int32(c.Loyalty), GoldCost: c.GoldCost,
			Attributes: &herov1.HeroAttributes{
				Force: c.Force, Intel: c.Intel, Politics: c.Politics, Command: c.Command,
			},
		})
	}
	return out
}

func hotelErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, hero.ErrHotelNotBuilt), errors.Is(err, hero.ErrHotelCandidateMissing):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrHotelCapacityFull), errors.Is(err, hero.ErrInsufficientGold), errors.Is(err, hero.ErrInsufficientItem):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}
