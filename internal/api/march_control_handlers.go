package api

import (
	"context"
	"errors"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

const (
	// RouteRecallMarch starts the return leg of one owned march.
	RouteRecallMarch = "military.v1.RecallMarch"
	// RouteSpeedupMarch consumes a march speedup item for one owned march.
	RouteSpeedupMarch = "military.v1.SpeedupMarch"
)

func (s *Server) controlStore(ctx context.Context) (*march.ControlStore, error) {
	if s.preparedRecruit == nil || s.preparedRecruit.s == nil || s.military == nil {
		return nil, march.ErrMarchControl
	}
	g := s.preparedRecruit
	return march.NewControlStore(ctx, g.s.binding, g.s.profile)
}

func (s *Server) handleRecallMarch(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.RecallMarchRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	store, err := s.controlStore(ctx)
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "march control unavailable"), nil
	}
	state, err := store.Recall(ctx, int64(pc.ServerID), pc.PlayerID, req.GetMarchId(), s.now())
	if err != nil {
		if errors.Is(err, march.ErrMarchControl) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_MILITARY_INVALID_MARCH, "march cannot be recalled"), nil
		}
		s.log.ErrorContext(ctx, "recall failed", "march_id", req.GetMarchId(), "error", err)
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "recall unavailable"), nil
	}
	if err := s.military.ApplyRecall(state.MarchID, state.ReturnAt); err != nil {
		s.log.ErrorContext(ctx, "recall hub mirror failed", "march_id", state.MarchID, "error", err)
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "recall unavailable"), nil
	}
	order, troops := s.military.SnapshotMarch(state.MarchID)
	if order == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "march unavailable"), nil
	}
	data, err := marshal(&militaryv1.RecallMarchResponse{
		March: marchSummaryProto(state.OriginCityID, order, troops),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSpeedupMarch(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req militaryv1.SpeedupMarchRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	sec, ok := s.marchSpeedupSeconds(req.GetItemCfgId())
	if !ok {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "item is not a march speedup"), nil
	}
	store, err := s.controlStore(ctx)
	if err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "march control unavailable"), nil
	}
	state, err := store.Speedup(ctx, int64(pc.ServerID), pc.PlayerID, req.GetMarchId(), req.GetItemCfgId(), sec, s.now())
	if err != nil {
		if errors.Is(err, march.ErrMarchSpeedupStock) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_MILITARY_INVALID_MARCH, "急行军令不足"), nil
		}
		if errors.Is(err, march.ErrMarchControl) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_MILITARY_INVALID_MARCH, "march cannot be sped up"), nil
		}
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "speedup unavailable"), nil
	}
	deadline := state.ArriveAt
	if state.Status == march.ControlReturning {
		deadline = state.ReturnAt
	}
	if err := s.military.ApplySpeedup(state.MarchID, deadline); err != nil {
		s.log.ErrorContext(ctx, "speedup hub mirror failed", "march_id", state.MarchID, "error", err)
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "speedup unavailable"), nil
	}
	order, troops := s.military.SnapshotMarch(state.MarchID)
	if order == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "march unavailable"), nil
	}
	data, err := marshal(&militaryv1.SpeedupMarchResponse{
		March: marchSummaryProto(state.OriginCityID, order, troops), ReducedSec: state.ReducedSec,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

// marchSpeedupSeconds reads the reviewed speedup metadata for march consumables.
func (s *Server) marchSpeedupSeconds(itemCfgID int32) (int64, bool) {
	bound := s.contentCatalog
	if bound == nil || bound.catalog == nil || bound.service != s.contentSvc {
		return 0, false
	}
	def, ok := bound.catalog.Items[itemCfgID]
	if !ok || def.Type != content.ItemTypeSpeedup {
		return 0, false
	}
	applies, ok := def.Meta["applies_to"].([]any)
	if !ok {
		return 0, false
	}
	hasMarch := false
	for _, target := range applies {
		if name, valid := target.(string); valid && name == "march" {
			hasMarch = true
		}
	}
	if !hasMarch {
		return 0, false
	}
	switch value := def.Meta["speedup_sec"].(type) {
	case float64:
		if value > 0 {
			return int64(value), true
		}
	case int:
		if value > 0 {
			return int64(value), true
		}
	}
	return 0, false
}

// marchLimitViolation enforces the R1 hero command cap and concurrent-march
// ceiling. An empty string means the request may proceed.
func (s *Server) marchLimitViolation(ctx context.Context, pc PlayerContext, cityID, heroID int64, troops []march.TroopStack) string {
	if s.heroSvc == nil || s.domestic == nil {
		return "march limits unavailable"
	}
	detail, err := s.heroSvc.GetHeroDetail(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, heroID)
	if err != nil {
		return "hero unavailable for march"
	}
	hall := int32(1)
	var city *domestic.CityState
	if snapshot, snapErr := s.domestic.SnapshotCity(cityID); snapErr == nil && snapshot != nil {
		city = snapshot
		if building := city.Buildings["hall"]; building != nil && building.Level > 0 {
			hall = building.Level
		}
	}
	var total int64
	for _, stack := range troops {
		total += int64(stack.Count)
	}
	command := detail.Hero.Command
	if command <= 0 {
		command = detail.ExpectedStats.Command
	}
	if command <= 0 {
		if template, ok := s.heroSvc.Catalog[detail.Hero.TemplateCfgID]; ok {
			command = template.Base.Command
		}
	}
	if city != nil {
		command += int32(domestic.TechnicBonus(city, "command_add"))
	}
	if cap := march.CommandCap(hall, command); total > cap {
		return "troop count exceeds the hero command cap"
	}
	store, err := s.controlStore(ctx)
	if err != nil {
		return "march limits unavailable"
	}
	active, err := store.ActiveCount(ctx, int64(pc.ServerID), pc.PlayerID)
	if err != nil {
		return "march limits unavailable"
	}
	if active >= int64(hall) {
		return "no free march slot at this government level"
	}
	return ""
}
