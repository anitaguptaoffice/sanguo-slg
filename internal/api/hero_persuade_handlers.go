package api

import (
	"context"
	"errors"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleListPersuadeTargets(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.ListPersuadeTargetsRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	rows, err := s.familyTargets(ctx, pc)
	if err != nil {
		return persuadeErr(pkt.GetTraceId(), err), nil
	}
	out := make([]*herov1.PersuadeTargetSummary, 0, len(rows))
	for _, v := range rows {
		var nextMS int64
		if !v.NextPersuadeAt.IsZero() {
			nextMS = v.NextPersuadeAt.UnixMilli()
		}
		out = append(out, &herov1.PersuadeTargetSummary{
			NpcCfgId: v.Target.NpcCfgID, TemplateCfgId: v.Target.TemplateCfgID,
			DisplayName: v.Target.DisplayName, Level: v.Target.Level,
			Friend: v.Friend, State: int32(v.State), HireFriendMin: v.HireFriendMin,
			NextPersuadeAtMs: nextMS,
		})
	}
	data, err := marshal(&herov1.ListPersuadeTargetsResponse{Targets: out})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handlePersuadeHero(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.PersuadeHeroRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetNpcCfgId() <= 0 || req.GetCityId() <= 0 || (req.GetServerId() != 0 && req.GetServerId() != pc.ServerID) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id and npc_cfg_id required"), nil
	}
	res, err := s.persuadeAtomic(ctx, pc, req.GetCityId(), req.GetNpcCfgId())
	if err != nil {
		return persuadeErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.PersuadeHeroResponse{
		NpcCfgId: res.NpcCfgID, Friend: res.Friend, FriendDelta: res.FriendDelta,
		NextPersuadeAtMs: res.NextPersuadeAt.UnixMilli(),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleLionizeHero(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.LionizeHeroRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetNpcCfgId() <= 0 || req.GetCityId() <= 0 || (req.GetServerId() != 0 && req.GetServerId() != pc.ServerID) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id and npc_cfg_id required"), nil
	}
	res, err := s.lionizeAtomic(ctx, pc, req.GetCityId(), req.GetNpcCfgId())
	if err != nil {
		return persuadeErr(pkt.GetTraceId(), err), nil
	}
	resp := &herov1.LionizeHeroResponse{
		NpcCfgId: res.NpcCfgID, Friend: res.Friend, State: int32(res.State),
		GoldSpent: res.GoldSpent, Befriended: res.Befriended, Recruited: res.Recruited,
	}
	if res.Hero != nil {
		resp.HeroId = res.Hero.HeroID
		resp.DisplayName = res.Hero.DisplayName
	}
	data, err := marshal(resp)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func persuadeErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, hero.ErrPersuadeUnknownNPC), errors.Is(err, hero.ErrPersuadeNotBefriended),
		errors.Is(err, hero.ErrInsufficientFriend), errors.Is(err, hero.ErrPersuadeCooldown),
		errors.Is(err, hero.ErrLionizeAlreadyDone), errors.Is(err, hero.ErrLionizeAlreadyFriend),
		errors.Is(err, hero.ErrPersuadeFriendSaturated),
		errors.Is(err, hero.ErrHotelCapacityFull), errors.Is(err, hero.ErrInsufficientItem),
		errors.Is(err, hero.ErrInsufficientGold), errors.Is(err, hero.ErrAlreadyOwned),
		errors.Is(err, hero.ErrInvalidRecruit):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	default:
		return familyErr(trace, err)
	}
}
