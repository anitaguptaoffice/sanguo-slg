package api

import (
	"context"
	"errors"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) handleListPlayerHeroes(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.ListPlayerHeroesRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	res, err := s.heroSvc.ListPlayerHeroes(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, hero.ListQuery{
		Limit: int(req.GetPageSize()), Offset: int(req.GetPageOffset()),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*herov1.PlayerHeroSummary, 0, len(res.Heroes))
	for _, h := range res.Heroes {
		out = append(out, &herov1.PlayerHeroSummary{
			HeroId: h.HeroID, TemplateCfgId: h.TemplateCfgID, Level: h.Level, Loyalty: int32(h.Loyalty),
		})
	}
	data, err := marshal(&herov1.ListPlayerHeroesResponse{Heroes: out, TotalCount: int32(res.Total)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleGetHeroDetail(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.GetHeroDetailRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	detail, err := s.heroSvc.GetHeroDetail(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetHeroId())
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	h := detail.Hero
	data, err := marshal(&herov1.GetHeroDetailResponse{
		HeroId: h.HeroID, TemplateCfgId: h.TemplateCfgID, TemplateName: detail.TemplateName,
		TemplateCode: detail.TemplateCode, Rarity: int32(detail.Rarity), Level: h.Level, Loyalty: int32(h.Loyalty),
		LoyaltyMin: detail.LoyaltyMin, LoyaltyMax: detail.LoyaltyMax,
		Exp: h.Exp, ExpTowardNext: detail.ExpTowardNext, UpgradeExpRequired: detail.UpgradeExpRequired,
		MarchForce: detail.MarchForce, MarchForceMax: detail.MarchForceMax,
		Attributes: &herov1.HeroAttributes{
			Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command,
		},
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleListRecruitTemplates(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.ListRecruitTemplatesRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	res, err := s.heroSvc.ListRecruitTemplates(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, hero.ListRecruitTemplatesQuery{
		Pool: req.GetPool(), Limit: int(req.GetPageSize()), Offset: int(req.GetPageOffset()),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*herov1.RecruitTemplatePreview, 0, len(res.Templates))
	for _, row := range res.Templates {
		t := row.Template
		cost := t.RecruitCost
		out = append(out, &herov1.RecruitTemplatePreview{
			TemplateCfgId: t.TemplateCfgID, TemplateName: t.Name, TemplateCode: t.Code,
			Pool: t.Pool, Rarity: int32(t.Rarity), AlreadyOwned: row.AlreadyOwned,
			RecruitCost: &apicommon.ResourceWallet{
				Food: cost.Food, Wood: cost.Wood, Iron: cost.Iron, Stone: cost.Stone,
			},
			RecruitItem: &apicommon.RewardItem{
				ItemCfgId: t.RecruitItem.ItemCfgID, Quantity: t.RecruitItem.Quantity,
			},
		})
	}
	data, err := marshal(&herov1.ListRecruitTemplatesResponse{Templates: out, TotalCount: int32(res.Total)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleRecruitHero(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.RecruitHeroRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	recruitReq := hero.RecruitRequest{
		TemplateCfgID: req.GetTemplateCfgId(),
		ItemCfgID:     req.GetItemCfgId(),
		Pool:          req.GetPool(),
	}
	res, err := s.heroSvc.RecruitPlayer(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, s.heroInventoryPort(), recruitReq)
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	s.questAfterRecruitHero(ctx, pc.ServerID, pc.PlayerID)
	data, err := marshal(&herov1.RecruitHeroResponse{
		HeroId: res.Hero.HeroID, TemplateCfgId: res.Hero.TemplateCfgID,
		Level: res.Hero.Level, Loyalty: int32(res.Hero.Loyalty),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleUpgradeHero(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.UpgradeHeroRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	res, err := s.heroSvc.UpgradePlayer(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, req.GetHeroId())
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	h := res.Hero
	detail, err := s.heroSvc.GetHeroDetail(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, h.HeroID)
	if err != nil {
		return nil, err
	}
	data, err := marshal(&herov1.UpgradeHeroResponse{
		HeroId: h.HeroID, Level: h.Level, Exp: h.Exp, PreviousLevel: res.PreviousLevel,
		ExpTowardNext: detail.ExpTowardNext, UpgradeExpRequired: detail.UpgradeExpRequired,
		Attributes: &herov1.HeroAttributes{
			Force: h.Force, Intel: h.Intel, Politics: h.Politics, Command: h.Command,
		},
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSetCityChief(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.SetCityChiefRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetCityId() == 0 || req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id and hero_id required"), nil
	}
	ref := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	view, err := s.heroSvc.SetCityChief(ctx, ref, req.GetCityId(), req.GetHeroId(), s.heroCityOwnership(ctx, pc))
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.SetCityChiefResponse{
		CityId: view.CityID, HeroId: view.HeroID, Loyalty: int32(view.Loyalty),
		ProductionBonus: view.ProductionBonus,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleClearCityChief(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.ClearCityChiefRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetCityId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id required"), nil
	}
	ref := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	if err := s.heroSvc.ClearCityChief(ctx, ref, req.GetCityId(), s.heroCityOwnership(ctx, pc)); err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.ClearCityChiefResponse{CityId: req.GetCityId()})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleGetCityChief(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.GetCityChiefRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetCityId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "city_id required"), nil
	}
	ref := hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	view, err := s.heroSvc.GetCityChief(ctx, ref, req.GetCityId(), s.heroCityOwnership(ctx, pc))
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.GetCityChiefResponse{
		CityId: view.CityID, HeroId: view.HeroID, Loyalty: int32(view.Loyalty),
		ProductionBonus: view.ProductionBonus,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleLargessHero(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.heroSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "hero not wired"), nil
	}
	var req herov1.LargessHeroRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	if req.GetHeroId() == 0 {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "hero_id required"), nil
	}
	var kind hero.LargessGiftKind
	switch req.GetGiftKind() {
	case herov1.LargessGiftKind_LARGESS_GIFT_GOLD:
		kind = hero.LargessGiftGold
	case herov1.LargessGiftKind_LARGESS_GIFT_ITEM:
		kind = hero.LargessGiftItem
		if req.GetItemCfgId() == 0 {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "item_cfg_id required"), nil
		}
	default:
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "gift_kind required"), nil
	}
	res, err := s.heroSvc.LargessPlayer(ctx, hero.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, s.heroInventoryPort(), hero.LargessRequest{
		HeroID: req.GetHeroId(), Kind: kind, ItemCfgID: req.GetItemCfgId(),
	})
	if err != nil {
		return heroErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&herov1.LargessHeroResponse{
		HeroId: res.Hero.HeroID, Loyalty: int32(res.Hero.Loyalty), LoyaltyDelta: res.LoyaltyDelta,
		GoldSpent: res.GoldSpent, ItemCfgId: res.ItemCfgID, NextLargessAtMs: res.NextLargessAtMS,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func heroErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, hero.ErrHeroNotFound):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrUnknownTemplate), errors.Is(err, hero.ErrInvalidRecruit), errors.Is(err, hero.ErrRecruitItemType):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrAlreadyOwned):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrInsufficientRes), errors.Is(err, hero.ErrInsufficientItem), errors.Is(err, hero.ErrInsufficientExp):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrMaxLevel), errors.Is(err, hero.ErrHeroNotInCity):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrInsufficientGold):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrLargessCooldown),
		errors.Is(err, hero.ErrLargessInvalidGift), errors.Is(err, hero.ErrLargessUnknownItem),
		errors.Is(err, hero.ErrGoldLargessNotNeeded), errors.Is(err, hero.ErrLoyaltyMax):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrEmptyPool):
		return errResp(trace, commonv1.ErrorCode_COMMON_UNAVAILABLE, err.Error())
	case errors.Is(err, hero.ErrHeroBusy), errors.Is(err, hero.ErrNoCityChief),
		errors.Is(err, hero.ErrHeroNotCaptive), errors.Is(err, hero.ErrCaptiveCityMismatch):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrInsufficientPotential), errors.Is(err, hero.ErrInvalidPointTargets):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrHeroNotIdle), errors.Is(err, hero.ErrHeroNotExpr),
		errors.Is(err, hero.ErrExprNotFound), errors.Is(err, hero.ErrExprNotComplete),
		errors.Is(err, hero.ErrInvalidExprHours), errors.Is(err, hero.ErrInsufficientMarchForce):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrHotelCapacityFull):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, hero.ErrNotCityOwner):
		return errResp(trace, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, err.Error())
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}
