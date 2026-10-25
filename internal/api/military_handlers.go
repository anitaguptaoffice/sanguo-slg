package api

import (
	"context"
	"errors"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

const (
	RouteRecruitTroop = "military.v1.RecruitTroop"
	RouteStartMarch   = "military.v1.StartMarch"
	RouteListMarches  = "military.v1.ListMarches"
)

func (s *Server) handleRecruitTroop(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.RecruitTroopRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetCount() <= 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_MILITARY_INVALID_TROOP_COUNT, "invalid count"), nil
	}
	if !s.ownsCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	dom := s.citySnapshot(req.GetCityId())
	if dom == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	s.ensureMilitaryCity(dom)
	res, err := s.military.RecruitWithWallet(march.RecruitRequest{
		CityID: req.GetCityId(), UnitCfgID: req.GetUnitCfgId(), Count: req.GetCount(),
	}, func(cost march.Resources) (march.Resources, error) {
		wallet, err := s.domestic.WithWallet(ctx, dom.ID, func(have domestic.Resources) (domestic.Resources, error) {
			if !have.Sub(marchWalletToDom(cost)) {
				return have, march.ErrInsufficientRes
			}
			return have, nil
		})
		return domWalletToMarch(wallet), err
	})
	if err != nil {
		return s.mapMarchRecruitErr(pkt.GetTraceId(), err), nil
	}
	mc := s.military.SnapshotCity(req.GetCityId())

	finishMS := int64(0)
	if !res.FinishAt.IsZero() {
		finishMS = res.FinishAt.UnixMilli()
	}
	count := int32(0)
	if mc != nil {
		count = mc.Troops[req.GetUnitCfgId()]
	}
	data, err := marshal(&militaryv1.RecruitTroopResponse{
		Troop: &apicommon.CityTroopStack{
			UnitCfgId: req.GetUnitCfgId(),
			Count:     count,
		},
		Wallet:     walletProto(marchWalletToDom(res.Wallet)),
		QueueId:    res.QueueID,
		FinishAtMs: finishMS,
	})
	if err != nil {
		return nil, err
	}
	s.questAfterTrainTroops(ctx, pc.ServerID, pc.PlayerID, req.GetUnitCfgId(), req.GetCount())
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleStartMarch(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.StartMarchRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.ownsCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	dom := s.citySnapshot(req.GetCityId())
	if dom == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	if req.GetHeroId() <= 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode(50005), "hero_id required"), nil
	}
	stacks, errPkt := parseMarchTroops(pkt.GetTraceId(), req.GetTroops())
	if errPkt != nil {
		return errPkt, nil
	}
	if _, err := s.domestic.SettleCity(ctx, dom.ID); err != nil {
		return nil, err
	}
	if err := s.claimMarchHero(ctx, pc, req.GetHeroId()); err != nil {
		return s.mapMarchHeroErr(pkt.GetTraceId(), err), nil
	}
	s.ensureMilitaryCity(dom)
	coord, ok := s.cityCoords[req.GetCityId()]
	if !ok {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode(50005), "city coordinates unknown"), nil
	}
	s.nextArmyID++
	order, err := s.military.CreateMarch(march.StartMarchRequest{
		ArmyID:       s.nextArmyID,
		OriginCityID: req.GetCityId(),
		PlayerID:     pc.PlayerID,
		HeroID:       req.GetHeroId(),
		FromX:        coord.x,
		FromY:        coord.y,
		ToX:          int(req.GetToX()),
		ToY:          int(req.GetToY()),
		Purpose:      int16(req.GetPurpose()),
		Troops:       stacks,
	})
	if err != nil {
		if s.heroSvc != nil {
			_ = s.heroSvc.ReleaseFromMarch(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetHeroId())
		}
		return s.mapMarchCreateErr(pkt.GetTraceId(), err), nil
	}
	s.recordPlayerMarch(pc.PlayerID, req.GetCityId(), order.ID, req.GetHeroId(), stacks)
	s.bindMarchHeroServer(order.ID, pc.ServerID)
	data, err := marshal(&militaryv1.StartMarchResponse{
		March:      marchSummaryProto(req.GetCityId(), order, stacks),
		CityTroops: troopStacksProto(s.military.SnapshotCity(dom.ID).Troops, stacks),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleListMarches(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.ListMarchesRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetCityId() != 0 && !s.ownsCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	refs, total := s.listPlayerMarches(pc.PlayerID, req.GetCityId(), req.GetLimit(), req.GetOffset())
	out := make([]*militaryv1.MarchSummary, 0, len(refs))
	for _, ref := range refs {
		order := s.military.March(ref.marchID)
		if order == nil {
			continue
		}
		out = append(out, marchSummaryProto(ref.cityID, order, ref.troops))
	}
	data, err := marshal(&militaryv1.ListMarchesResponse{Marches: out, Total: total})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func parseMarchTroops(trace string, in []*apicommon.CityTroopStack) ([]march.TroopStack, *commonv1.ServerPacket) {
	if len(in) == 0 {
		return nil, errResp(trace, commonv1.ErrorCode(50005), "empty troop stack")
	}
	out := make([]march.TroopStack, 0, len(in))
	for _, st := range in {
		if st.GetCount() <= 0 {
			return nil, errResp(trace, commonv1.ErrorCode_MILITARY_INVALID_TROOP_COUNT, "invalid troop count")
		}
		out = append(out, march.TroopStack{UnitCfgID: st.GetUnitCfgId(), Count: st.GetCount()})
	}
	return out, nil
}

func (s *Server) mapMarchRecruitErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, march.ErrCityNotFound):
		return errResp(trace, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found")
	case errors.Is(err, march.ErrUnknownUnit):
		return errResp(trace, commonv1.ErrorCode_MILITARY_INVALID_UNIT, "unknown unit")
	case errors.Is(err, march.ErrInvalidCount):
		return errResp(trace, commonv1.ErrorCode_MILITARY_INVALID_TROOP_COUNT, "invalid count")
	case errors.Is(err, march.ErrInsufficientRes):
		return errResp(trace, commonv1.ErrorCode_MILITARY_INSUFFICIENT_RESOURCE, "insufficient resources")
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}

func (s *Server) mapMarchHeroErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, hero.ErrHeroNotFound):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrHeroNotIdle), errors.Is(err, hero.ErrHeroBusy):
		return errResp(trace, commonv1.ErrorCode(50005), err.Error())
	case errors.Is(err, hero.ErrInsufficientMarchForce):
		return errResp(trace, commonv1.ErrorCode(50005), err.Error())
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}

func (s *Server) mapMarchCreateErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, march.ErrNoTroopsToMarch), errors.Is(err, march.ErrInvalidMarch):
		return errResp(trace, commonv1.ErrorCode(50005), err.Error())
	case errors.Is(err, march.ErrInsufficientTroops):
		return errResp(trace, commonv1.ErrorCode(50006), "insufficient troops")
	case errors.Is(err, march.ErrCityNotFound):
		return errResp(trace, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found")
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}

func marchPhaseProto(p march.MarchPhase) militaryv1.MarchPhase {
	switch p {
	case march.PhasePending:
		return militaryv1.MarchPhase_MARCH_PHASE_PENDING
	case march.PhaseMarching:
		return militaryv1.MarchPhase_MARCH_PHASE_MARCHING
	case march.PhaseArrived:
		return militaryv1.MarchPhase_MARCH_PHASE_ARRIVED
	case march.PhaseReturning:
		return militaryv1.MarchPhase_MARCH_PHASE_RETURNING
	default:
		return militaryv1.MarchPhase_MARCH_PHASE_UNSPECIFIED
	}
}

func marchSummaryProto(cityID int64, o *march.MarchOrder, troops []march.TroopStack) *militaryv1.MarchSummary {
	if o == nil {
		return nil
	}
	// The wire contract exposes a return deadline only while returning.
	var returnFinishAtMs int64
	if o.Phase == march.PhaseReturning && !o.ReturnFinishAt.IsZero() {
		returnFinishAtMs = o.ReturnFinishAt.UnixMilli()
	}
	return &militaryv1.MarchSummary{
		MarchId:          o.ID,
		ArmyId:           o.ArmyID,
		OriginCityId:     cityID,
		FromX:            int32(o.FromX),
		FromY:            int32(o.FromY),
		ToX:              int32(o.ToX),
		ToY:              int32(o.ToY),
		Purpose:          int32(o.Purpose),
		Phase:            marchPhaseProto(o.Phase),
		DepartAtMs:       o.DepartAt.UnixMilli(),
		ArriveAtMs:       o.ArriveAt.UnixMilli(),
		ReturnFinishAtMs: returnFinishAtMs,
		Troops:           troopStacksProtoFromMarch(troops),
	}
}

func troopStacksProtoFromMarch(stacks []march.TroopStack) []*apicommon.CityTroopStack {
	out := make([]*apicommon.CityTroopStack, 0, len(stacks))
	for _, st := range stacks {
		out = append(out, &apicommon.CityTroopStack{UnitCfgId: st.UnitCfgID, Count: st.Count})
	}
	return out
}

func troopStacksProto(all map[int32]int32, touched []march.TroopStack) []*apicommon.CityTroopStack {
	seen := make(map[int32]bool, len(touched))
	out := make([]*apicommon.CityTroopStack, 0, len(touched))
	for _, st := range touched {
		if seen[st.UnitCfgID] {
			continue
		}
		seen[st.UnitCfgID] = true
		out = append(out, &apicommon.CityTroopStack{
			UnitCfgId: st.UnitCfgID,
			Count:     all[st.UnitCfgID],
		})
	}
	return out
}

func (s *Server) ownsCity(ctx context.Context, pc PlayerContext, cityID int64) bool {
	// Domestic snapshots have no shard identity. Only the world store can
	// authorize a city in the authenticated shard; unavailable data fails closed.
	if cityID <= 0 || pc.PlayerID <= 0 || pc.ServerID <= 0 || s.world == nil || s.world.Store == nil {
		return false
	}
	cities, err := s.world.Store.PlayerCities(ctx, pc.ServerID, pc.PlayerID)
	if err != nil {
		return false
	}
	for _, c := range cities {
		if c.CityID == cityID && c.ServerID == pc.ServerID && c.PlayerID == pc.PlayerID {
			return true
		}
	}
	return false
}
