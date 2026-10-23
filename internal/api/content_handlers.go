package api

import (
	"context"
	"errors"
	"fmt"

	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
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
	return okResp(pkt.GetTraceId(), data), nil
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
	return okResp(pkt.GetTraceId(), data), nil
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
		return fmt.Sprintf("加速 %d 秒（占位）", sec), sec
	}
	if res.Recruit != nil {
		return fmt.Sprintf("招募池 %s ×%d（占位）", res.Recruit.HeroPool, res.Recruit.Draws), 0
	}
	if res.Train != nil {
		return fmt.Sprintf("训练 %s ×%d（占位）", res.Train.UnitCode, res.Train.Count), 0
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
