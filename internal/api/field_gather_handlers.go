package api

import (
	"context"
	"errors"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

const (
	// RouteStartFieldGather starts a one-hour gather on an owned wild tile.
	RouteStartFieldGather = "world.v1.StartFieldGather"
	// RouteListFieldGathers lists the player's gathers.
	RouteListFieldGathers = "world.v1.ListFieldGathers"
	// RouteClaimFieldGather claims a finished gather.
	RouteClaimFieldGather = "world.v1.ClaimFieldGather"

	fieldGatherFoodCost = 500
)

func fieldGatherName(g world.FieldGather) string {
	return world.TerrainName(g.Terrain) + " Lv" + strconvItoa(int(g.Level))
}

func strconvItoa(v int) string {
	if v == 0 {
		return "0"
	}
	negative := v < 0
	if negative {
		v = -v
	}
	var digits [8]byte
	i := len(digits)
	for v > 0 {
		i--
		digits[i] = byte('0' + v%10)
		v /= 10
	}
	if negative {
		i--
		digits[i] = '-'
	}
	return string(digits[i:])
}

func gatherRewardProto(r world.GatherReward) *worldv1.FieldGatherReward {
	out := &worldv1.FieldGatherReward{Food: r.Food, Wood: r.Wood, Stone: r.Stone, Iron: r.Iron, Gold: r.Gold}
	for _, item := range r.Items {
		out.Items = append(out.Items, &worldv1.FieldGatherItem{ItemCfgId: item.ItemCfgID, Count: item.Count})
	}
	return out
}

func gatherViewProto(g world.FieldGather) *worldv1.FieldGatherView {
	return &worldv1.FieldGatherView{
		GatherId:   g.GatherID,
		X:          int32(g.X),
		Y:          int32(g.Y),
		Name:       fieldGatherName(g),
		FinishAtMs: g.FinishAt.UnixMilli(),
		Status:     int32(g.Status),
		Reward:     gatherRewardProto(g.Reward),
	}
}

func (s *Server) pickIdleHero(ctx context.Context, pc PlayerContext) (int64, error) {
	if s.heroSvc == nil {
		return 0, hero.ErrHeroNotFound
	}
	res, err := s.heroSvc.ListPlayerHeroes(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, hero.ListQuery{})
	if err != nil {
		return 0, err
	}
	for _, h := range res.Heroes {
		if h != nil && h.Status == hero.StatusIdle {
			return h.HeroID, nil
		}
	}
	return 0, hero.ErrHeroNotFound
}

func (s *Server) handleStartFieldGather(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.StartFieldGatherRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	owned, err := s.ownCity(ctx, pc, req.GetCityId())
	if err != nil {
		return nil, err
	}
	if !owned {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	if s.world == nil || s.world.Gathers == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "field gather unavailable"), nil
	}
	heroID := req.GetHeroId()
	if heroID <= 0 {
		heroID, err = s.pickIdleHero(ctx, pc)
		if err != nil {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "no idle hero"), nil
		}
	}
	if err = s.claimMarchHero(ctx, pc, heroID); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not idle"), nil
	}
	cost := int64(fieldGatherFoodCost)
	_, err = s.domestic.WithWallet(ctx, req.GetCityId(), func(have domestic.Resources) (domestic.Resources, error) {
		if have.Food < cost {
			return have, domestic.ErrInsufficientRes
		}
		have.Food -= cost
		return have, nil
	})
	if err != nil {
		_ = s.heroSvc.ReleaseFromMarch(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, heroID)
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient food"), nil
	}
	gather, err := s.world.Gathers.Start(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), heroID, int(req.GetX()), int(req.GetY()))
	if err != nil {
		_, _ = s.domestic.WithWallet(ctx, req.GetCityId(), func(have domestic.Resources) (domestic.Resources, error) {
			have.Food += cost
			return have, nil
		})
		_ = s.heroSvc.ReleaseFromMarch(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, heroID)
		msg := "field gather unavailable"
		switch {
		case errors.Is(err, world.ErrFieldNotOwned):
			msg = "field not owned by city"
		case errors.Is(err, world.ErrGatherBusy):
			msg = "field or hero already gathering"
		}
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, msg), nil
	}
	data, err := marshal(&worldv1.StartFieldGatherResponse{Gather: gatherViewProto(*gather), FoodCost: cost})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleListFieldGathers(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.ListFieldGathersRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if s.world == nil || s.world.Gathers == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "field gather unavailable"), nil
	}
	gathers, err := s.world.Gathers.List(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), 20)
	if err != nil {
		return nil, err
	}
	out := &worldv1.ListFieldGathersResponse{Gathers: make([]*worldv1.FieldGatherView, 0, len(gathers))}
	for _, gather := range gathers {
		out.Gathers = append(out.Gathers, gatherViewProto(gather))
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleClaimFieldGather(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req worldv1.ClaimFieldGatherRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if s.world == nil || s.world.Gathers == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "field gather unavailable"), nil
	}
	gather, err := s.world.Gathers.Claim(ctx, pc.ServerID, pc.PlayerID, req.GetGatherId())
	if err != nil {
		msg := "field gather unavailable"
		switch {
		case errors.Is(err, world.ErrGatherNotFound):
			msg = "gather not found"
		case errors.Is(err, world.ErrGatherNotClaimed):
			msg = "gather still running"
		case errors.Is(err, world.ErrGatherClaimed):
			msg = "gather already claimed"
		}
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, msg), nil
	}
	if s.heroSvc != nil && gather.HeroID > 0 {
		_ = s.heroSvc.ReleaseFromMarch(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, gather.HeroID)
	}
	_, _ = s.domestic.RefreshWallet(ctx, gather.CityID)
	data, err := marshal(&worldv1.ClaimFieldGatherResponse{Reward: gatherRewardProto(gather.Reward)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}
