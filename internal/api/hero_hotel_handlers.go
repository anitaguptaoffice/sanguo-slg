package api

import (
	"context"
	"errors"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
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
	if req.GetCityId() <= 0 || (req.GetServerId() != 0 && req.GetServerId() != pc.ServerID) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id required"), nil
	}
	snapshot, err := s.hotelAtomic(ctx, pc, req.GetCityId(), 0, hotelList)
	if err != nil {
		return hotelErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.ListHotelRecruitCandidatesResponse{
		Candidates: hotelCandidatesToProto(snapshot.candidates), HotelLevel: snapshot.levels.Hotel,
		HeroCapacity: snapshot.levels.Office, HeroOwned: int32(snapshot.owned),
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
	if req.GetCityId() <= 0 || (req.GetServerId() != 0 && req.GetServerId() != pc.ServerID) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id required"), nil
	}
	snapshot, err := s.hotelAtomic(ctx, pc, req.GetCityId(), 0, hotelRefresh)
	if err != nil {
		return hotelErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.RefreshHotelRecruitPoolResponse{Candidates: hotelCandidatesToProto(snapshot.candidates)})
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
	if req.GetCityId() <= 0 || req.GetCandidateId() <= 0 || (req.GetServerId() != 0 && req.GetServerId() != pc.ServerID) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id and candidate_id required"), nil
	}
	snapshot, err := s.hotelAtomic(ctx, pc, req.GetCityId(), req.GetCandidateId(), hotelRecruit)
	if err != nil {
		return hotelErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.RecruitHotelCandidateResponse{
		HeroId: snapshot.hero.HeroID, DisplayName: snapshot.hero.DisplayName,
		Level: snapshot.hero.Level, Loyalty: int32(snapshot.hero.Loyalty),
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
	case errors.Is(err, errRecruitActor), errors.Is(err, world.ErrCityNotOwned):
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAUTHORIZED, "player or city unavailable")
	case errors.Is(err, hero.ErrHotelTransactionRequired), errors.Is(err, errHotelWallet):
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAVAILABLE, "atomic hotel unavailable")
	case errors.Is(err, errHotelOutcome):
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAVAILABLE, "hotel outcome unavailable; reload state")
	case errors.Is(err, hero.ErrHotelNotBuilt), errors.Is(err, hero.ErrHotelCandidateMissing):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrHotelCapacityFull), errors.Is(err, hero.ErrInsufficientGold), errors.Is(err, hero.ErrInsufficientItem):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, "hotel outcome unavailable; reload state")
	}
}
