package api

import (
	"context"
	"errors"
	"fmt"

	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

const (
	RouteListPlayerBag = "content.v1.ListPlayerBag"
	RouteUseConsumable = "content.v1.UseConsumable"
)

func (s *Server) handleListPlayerBag(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.contentSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "content not wired"), nil
	}
	var req contentv1.ListPlayerBagRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	p := content.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	notice := s.starterScrollNotice(ctx, pc)
	if err := s.contentSvc.LoadPlayer(ctx, p); err != nil {
		return nil, err
	}
	stacks := s.contentSvc.List(p)
	items := make([]*contentv1.PlayerItemStack, 0, len(stacks))
	for _, st := range stacks {
		items = append(items, &contentv1.PlayerItemStack{ItemCfgId: st.ItemCfgID, Quantity: st.Quantity})
	}
	data, err := marshal(&contentv1.ListPlayerBagResponse{Items: items})
	if err != nil {
		return nil, err
	}
	resp := okResp(pkt.GetTraceId(), data)
	resp.Msg = notice
	return resp, nil
}

func (s *Server) handleUseConsumable(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.contentSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "content not wired"), nil
	}
	var req contentv1.UseConsumableRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	// Classify from the exact service catalog before hydration or any debit.
	// Memory fixtures must bind explicitly too; a default catalog is not proof.
	bound := s.contentCatalog
	if bound == nil || bound.catalog == nil || bound.service != s.contentSvc {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "道具配置不可用，未扣除道具"), nil
	}
	def, ok := bound.catalog.Items[req.GetItemCfgId()]
	if !ok {
		return contentErr(pkt.GetTraceId(), content.ErrUnknownItem), nil
	}
	switch def.Type {
	case content.ItemTypeRecruit:
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "招募道具不支持直接使用，未扣除道具；请使用将领招募入口"), nil
	case content.ItemTypeTrainTroop:
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "练兵道具暂不支持直接使用，未扣除道具"), nil
	case content.ItemTypeSpeedup:
		if !buildSpeedupDefinition(def) {
			return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "此加速道具没有可用的建造效果，未扣除道具"), nil
		}
	case content.ItemTypeResourcePack:
		// Resource grants are applied atomically by content.Use.
	default:
		return contentErr(pkt.GetTraceId(), content.ErrNotConsumable), nil
	}
	if !s.buildSpeedupScopeAvailable(pc.ServerID, req.GetItemCfgId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "city scope unavailable"), nil
	}
	count := req.GetCount()
	if count <= 0 {
		count = 1
	}
	p := content.PlayerRef{ServerID: pc.ServerID, PlayerID: pc.PlayerID}
	if err := s.contentSvc.LoadPlayer(ctx, p); err != nil {
		return nil, err
	}
	res, err := s.contentSvc.Use(p, req.GetItemCfgId(), count)
	if err != nil {
		return contentErr(pkt.GetTraceId(), err), nil
	}
	if res.Speedup != nil && speedupAppliesToBuild(res.Speedup.AppliesTo) {
		s.applyDomesticBuildSpeedup(pc.ServerID, pc.PlayerID, res.Speedup.Seconds)
	}
	summary, speedup := consumableEffectSummary(res)
	data, err := marshal(&contentv1.UseConsumableResponse{
		ItemCfgId:      res.ItemCfgID,
		Remaining:      res.Remaining,
		WalletAfter:    resourceWalletToProto(s.contentSvc.Wallet(p)),
		SpeedupSeconds: speedup,
		EffectSummary:  summary,
	})
	if err != nil {
		return nil, err
	}
	if code := itemCodeByCfgID(res.ItemCfgID); code != "" {
		s.questAfterUseItem(ctx, pc.ServerID, pc.PlayerID, code, count)
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func speedupAppliesToBuild(appliesTo []string) bool {
	for _, a := range appliesTo {
		if a == "build" {
			return true
		}
	}
	return false
}

func (s *Server) applyDomesticBuildSpeedup(serverID int32, playerID int64, sec int64) {
	if !s.domesticCityScope(serverID) || sec <= 0 {
		return
	}
	var fallback int64
	for _, cityID := range s.cachedCityIDs() {
		city := s.citySnapshot(cityID)
		if city == nil || city.PlayerID != playerID {
			continue
		}
		if fallback == 0 {
			fallback = cityID
		}
		if domestic.HasPendingBuildJob(city) {
			s.domestic.ApplyBuildSpeedup(cityID, sec)
			return
		}
	}
	if fallback != 0 {
		s.domestic.ApplyBuildSpeedup(fallback, sec)
	}
}

func consumableEffectSummary(res content.UseResult) (string, int64) {
	if res.Grants != nil {
		g := res.Grants
		var parts []string
		if g.Food > 0 {
			parts = append(parts, fmt.Sprintf("获得粮食 %d", g.Food))
		}
		if g.Wood > 0 {
			parts = append(parts, fmt.Sprintf("获得木材 %d", g.Wood))
		}
		if g.Iron > 0 {
			parts = append(parts, fmt.Sprintf("获得铁矿 %d", g.Iron))
		}
		if g.Stone > 0 {
			parts = append(parts, fmt.Sprintf("获得石料 %d", g.Stone))
		}
		if len(parts) == 0 {
			return "已消耗道具", 0
		}
		return parts[0], 0
	}
	if res.Speedup != nil {
		sec := res.Speedup.Seconds
		return fmt.Sprintf("加速 %d 秒", sec), sec
	}
	return "已消耗道具", 0
}

func contentErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, content.ErrUnknownItem):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "unknown item")
	case errors.Is(err, content.ErrInsufficientItems):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "道具不足")
	case errors.Is(err, content.ErrNotConsumable), errors.Is(err, content.ErrUnsupportedUse):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, content.ErrInvalidQuantity):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid count")
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}

// WireM4Content binds the exact catalog used by this service. Alternate service
// wiring cannot substitute an unapplied effect or bypass build scope checks.
type contentCatalogBinding struct {
	service *content.Service
	catalog *content.Catalog
}

func (s *Server) buildSpeedupScopeAvailable(serverID int32, itemID int32) bool {
	if s.players == nil || s.players.Pool == nil || s.domesticCityScope(serverID) {
		return true // Explicit local fixtures, or the configured persistent Hub.
	}
	bound := s.contentCatalog
	if bound == nil || bound.catalog == nil || bound.service != s.contentSvc {
		return false
	}
	return !buildSpeedupDefinition(bound.catalog.Items[itemID])
}

func buildSpeedupDefinition(def content.ItemDef) bool {
	if def.Type != content.ItemTypeSpeedup {
		return false
	}
	applies, _ := def.Meta["applies_to"].([]any)
	hasBuild := false
	for _, target := range applies {
		name, valid := target.(string)
		if !valid {
			return false // CONTENT rejects mixed metadata; reject before hydration too.
		}
		hasBuild = hasBuild || name == "build"
	}
	return hasBuild
}
