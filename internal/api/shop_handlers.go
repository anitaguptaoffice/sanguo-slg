package api

import (
	"context"
	"errors"

	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

const (
	RouteListShopShelf      = "shop.v1.ListShopShelf"
	RoutePurchaseShopOffer  = "shop.v1.PurchaseShopOffer"
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
	offers, ver, err := s.shopSvc.ListShopShelf(pc.ServerID, req.GetShelfId(), pc.PlayerID)
	if err != nil {
		return nil, err
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
	count := req.GetPurchaseCount()
	if count <= 0 {
		count = 1
	}
	offer, granted, wallet, err := s.shopSvc.Purchase(pc.ServerID, pc.PlayerID, req.GetOfferId(), count)
	if err != nil {
		return shopErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&shopv1.PurchaseShopOfferResponse{
		Offer:         shopOfferToProto(offer),
		GrantedItems:  grantedItemsToProto(granted),
		WalletAfter:   resourceWalletToProto(wallet),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func shopErr(trace string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, shop.ErrOfferNotFound):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, "offer not found")
	case errors.Is(err, shop.ErrInsufficientBalance), errors.Is(err, shop.ErrInsufficientItems):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, shop.ErrPurchaseLimitExceeded), errors.Is(err, shop.ErrSoldOut):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, shop.ErrInvalidPurchaseCount):
		return errResp(trace, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	default:
		return errResp(trace, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}
