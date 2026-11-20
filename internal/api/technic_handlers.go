package api

import (
	"context"
	"errors"
	"sort"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func technicView(city *domestic.CityState, def domestic.TechnicDef) *domesticv1.TechnicView {
	level := domestic.TechnicLevelOf(city, def.TID)
	view := &domesticv1.TechnicView{
		Tid: def.TID, Code: def.Code, Name: def.Name, Category: def.Category,
		Level: level, MaxLevel: def.MaxLevel, AcademyLevel: def.AcademyLevel,
	}
	if level < def.MaxLevel {
		row := def.Levels[level]
		view.NextCost = walletProto(row.Cost)
		view.NextTimeSec = row.TimeSec
	}
	view.CanResearch, view.Reason = domestic.TechnicAvailable(city, def)
	return view
}

func (s *Server) handleListTechnics(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.ListTechnicsRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	city := s.citySnapshot(req.GetCityId())
	if !s.ownsCity(ctx, pc, req.GetCityId()) || city == nil || city.PlayerID != pc.PlayerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	tree := domestic.DefaultTechnicTree()
	ids := make([]int32, 0, len(tree))
	for tid := range tree {
		ids = append(ids, tid)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	out := &domesticv1.ListTechnicsResponse{Technics: make([]*domesticv1.TechnicView, 0, len(ids))}
	for _, tid := range ids {
		out.Technics = append(out.Technics, technicView(city, tree[tid]))
	}
	if job := city.ActiveResearch(); job != nil {
		out.Job = &domesticv1.ResearchJobView{Tid: job.TID, Target: job.Target, FinishAtMs: job.FinishAt.UnixMilli()}
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleStartTechnicResearch(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.StartTechnicResearchRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	city := s.citySnapshot(req.GetCityId())
	if !s.ownsCity(ctx, pc, req.GetCityId()) || city == nil || city.PlayerID != pc.PlayerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	res, err := s.domestic.StartTechnicResearch(ctx, req.GetCityId(), req.GetTid())
	if err != nil {
		switch {
		case errors.Is(err, domestic.ErrInsufficientRes):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient resources"), nil
		case errors.Is(err, domestic.ErrResearchBusy):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_BUILDING_BUSY, "academy research busy"), nil
		case errors.Is(err, domestic.ErrTechnicPrereq), errors.Is(err, domestic.ErrUnknownTechnic):
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, err.Error()), nil
		}
		return nil, err
	}
	city = s.citySnapshot(req.GetCityId())
	out := &domesticv1.StartTechnicResearchResponse{
		Wallet: walletProto(res.Wallet), FinishAtMs: res.FinishAt.UnixMilli(),
	}
	if def, ok := domestic.DefaultTechnicTree()[req.GetTid()]; ok && city != nil {
		out.Technic = technicView(city, def)
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
