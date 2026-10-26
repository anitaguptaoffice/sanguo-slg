package api

import (
	"context"
	"errors"

	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/obs"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
)

const (
	RouteListShopShelf     = "shop.v1.ListShopShelf"
	RoutePurchaseShopOffer = "shop.v1.PurchaseShopOffer"
)

func (s *Server) handleListShopShelf(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.shopSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "shop not wired"), nil
	}
	var req shopv1.ListShopShelfRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "server mismatch"), nil
	}
	if s.shopPurchaseDependencies() == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "shop state unavailable"), nil
	}
	offers, ver, err := s.shopSvc.ListShopShelfContext(ctx, pc.ServerID, req.GetShelfId(), pc.PlayerID)
	if err != nil {
		s.recruitLog().Warn("shop shelf read failed", "error", err)
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "shop state unavailable"), nil
	}
	pbOffers := make([]*shopv1.ShopOffer, 0, len(offers))
	for _, o := range offers {
		pbOffers = append(pbOffers, shopOfferToProto(o))
	}
	data, err := marshal(&shopv1.ListShopShelfResponse{Offers: pbOffers, CatalogVersion: ver})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handlePurchaseShopOffer(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req shopv1.PurchaseShopOfferRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "server mismatch"), nil
	}
	count := req.GetPurchaseCount()
	if count <= 0 {
		count = 1
	}
	out, err := s.purchaseShopAtomic(ctx, pc, req.GetOfferId(), count)
	if err != nil {
		return shopErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&shopv1.PurchaseShopOfferResponse{
		Offer:        shopOfferToProto(out.offer),
		GrantedItems: grantedItemsToProto(out.granted),
		WalletAfter:  resourceWalletToProto(out.wallet),
	})
	if err != nil {
		return nil, err
	}
	obs.EmitGameplayEvent(s.log, pkt.GetTraceId(), obs.EventShopPurchase, obs.PlayerRef{
		ServerID: pc.ServerID,
		PlayerID: pc.PlayerID,
	})
	return okResp(pkt.GetTraceId(), data), nil
}

// Only known precommit rejections get safe validation messages. Unexpected or
// commit failures remain unknown; callers must never automatically replay.
func shopErr(trace string, err error) *commonv1.ServerPacket {
	code := commonv1.ErrorCode_COMMON_INVALID_PACKET
	message := ""
	switch {
	case errors.Is(err, errRecruitActor):
		code, message = commonv1.ErrorCode_COMMON_UNAUTHORIZED, "player unavailable"
	case errors.Is(err, errShopBinding), errors.Is(err, errShopWallet), errors.Is(err, shop.ErrPurchaseTransactionRequired):
		code, message = commonv1.ErrorCode_COMMON_UNAVAILABLE, "atomic shop unavailable"
	case errors.Is(err, shop.ErrOfferNotFound):
		message = "offer not found"
	case errors.Is(err, shop.ErrInsufficientBalance):
		message = "shop: insufficient resources"
	case errors.Is(err, shop.ErrInsufficientItems), errors.Is(err, content.ErrInsufficientItems):
		message = "shop: insufficient item currency"
	case errors.Is(err, shop.ErrPurchaseLimitExceeded):
		message = "shop: purchase limit exceeded"
	case errors.Is(err, shop.ErrSoldOut):
		message = "shop: offer sold out"
	case errors.Is(err, shop.ErrInvalidPurchaseCount):
		message = "shop: purchase_count must be positive"
	case errors.Is(err, shop.ErrInvalidPurchase), errors.Is(err, shop.ErrPurchaseOverflow), errors.Is(err, content.ErrUnknownItem), errors.Is(err, content.ErrInvalidReward), errors.Is(err, content.ErrInvalidQuantity):
		message = "shop: invalid offer or quantity"
	case errors.Is(err, content.ErrBagFull):
		message = "bag is full"
	case errors.Is(err, content.ErrStackLimit):
		message = "item stack limit exceeded"
	default:
		code, message = commonv1.ErrorCode_COMMON_INTERNAL, "purchase outcome unavailable; refresh inventory and wallet state"
	}
	return errResp(trace, code, message)
}
