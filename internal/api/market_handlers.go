package api

import (
	"context"
	"errors"
	"time"

	domesticv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/domestic/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func (s *Server) marketService() *domestic.Market {
	now := s.now
	if now == nil {
		now = time.Now
	}
	return domestic.NewMarket(s.PlayersPool(), now)
}

func (s *Server) refreshMarketWallet(ctx context.Context, cityID int64) {
	if s.domestic != nil {
		_, _ = s.domestic.RefreshWallet(ctx, cityID)
	}
}

func marketOfferProto(v domestic.MarketOfferView) *domesticv1.MarketOfferView {
	return &domesticv1.MarketOfferView{
		OfferId: v.OfferID, SellerCityId: v.SellerCityID, SellerName: v.SellerName,
		ResourceType: v.ResourceType, Amount: v.Amount, PriceMilli: v.PriceMilli,
		GoldTotal: v.GoldTotal, Distance: v.Distance, DeliverSeconds: v.DeliverSeconds, Own: v.Own,
	}
}

func (s *Server) handleGetStorehouse(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.GetStorehouseRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	s.refreshMarketWallet(ctx, req.GetCityId())
	view, err := s.domestic.Storehouse(ctx, req.GetCityId())
	if err != nil {
		return nil, err
	}
	data, err := marshal(&domesticv1.GetStorehouseResponse{Storehouse: &domesticv1.StorehouseView{
		Level: view.Level, CapacityBonus: view.CapacityBonus, ProtectionPercent: view.ProtectionPercent,
		ProtectedAmount: walletProto(view.Protected), Wallet: walletProto(view.Wallet),
	}})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleGetMarket(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.GetMarketRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	view, err := s.marketService().Snapshot(ctx, pc.ServerID, pc.PlayerID, req.GetCityId())
	if err != nil {
		return nil, err
	}
	s.refreshMarketWallet(ctx, req.GetCityId())
	out := &domesticv1.GetMarketResponse{
		MarketLevel: view.MarketLevel, ListingCapacity: view.ListingCapacity, CaravanCapacity: view.CaravanCapacity,
		MaxListingAmount: view.MaxListingAmount, Gold: view.Gold, Wallet: walletProto(view.Wallet),
		ResourcePricesMilli: view.PricesMilli[:],
	}
	for _, offer := range view.Offers {
		out.Offers = append(out.Offers, marketOfferProto(offer))
	}
	for _, offer := range view.OwnOffers {
		out.OwnOffers = append(out.OwnOffers, marketOfferProto(offer))
	}
	for _, d := range view.Deliveries {
		out.Deliveries = append(out.Deliveries, &domesticv1.MarketDeliveryView{
			OfferId: d.OfferID, SellerCityId: d.SellerCityID, ResourceType: d.ResourceType,
			Amount: d.Amount, GoldTotal: d.GoldTotal, DeliverAtMs: d.DeliverAt.UnixMilli(),
		})
	}
	data, err := marshal(out)
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleBuyFromMerchant(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.BuyFromMerchantRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	res, err := s.marketService().BuyFromMerchant(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetResourceType(), req.GetAmount())
	if err != nil {
		return s.marketError(pkt, err), nil
	}
	s.refreshMarketWallet(ctx, req.GetCityId())
	data, err := marshal(&domesticv1.BuyFromMerchantResponse{
		Gold: res.Gold, GoldPaid: -res.GoldDiff, Wallet: walletProto(res.Wallet),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleSellToMerchant(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.SellToMerchantRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	res, err := s.marketService().SellToMerchant(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetResourceType(), req.GetAmount())
	if err != nil {
		return s.marketError(pkt, err), nil
	}
	s.refreshMarketWallet(ctx, req.GetCityId())
	data, err := marshal(&domesticv1.SellToMerchantResponse{
		Gold: res.Gold, GoldGained: res.GoldDiff, Wallet: walletProto(res.Wallet),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleCreateMarketOffer(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.CreateMarketOfferRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	res, err := s.marketService().CreateOffer(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(),
		req.GetResourceType(), req.GetAmount(), req.GetPriceMilli(), req.GetHours())
	if err != nil {
		return s.marketError(pkt, err), nil
	}
	s.refreshMarketWallet(ctx, req.GetCityId())
	data, err := marshal(&domesticv1.CreateMarketOfferResponse{
		Offer: marketOfferProto(res.Offer), Gold: res.Gold, Wallet: walletProto(res.Wallet),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleCancelMarketOffer(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.CancelMarketOfferRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	res, err := s.marketService().CancelOffer(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetOfferId())
	if err != nil {
		return s.marketError(pkt, err), nil
	}
	s.refreshMarketWallet(ctx, req.GetCityId())
	data, err := marshal(&domesticv1.CancelMarketOfferResponse{
		Gold: res.Gold, Wallet: walletProto(res.Wallet),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleBuyMarketOffer(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	var req domesticv1.BuyMarketOfferRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if !s.officeCity(ctx, pc, req.GetCityId()) {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found"), nil
	}
	res, err := s.marketService().BuyOffer(ctx, pc.ServerID, pc.PlayerID, req.GetCityId(), req.GetOfferId())
	if err != nil {
		return s.marketError(pkt, err), nil
	}
	s.refreshMarketWallet(ctx, req.GetCityId())
	data, err := marshal(&domesticv1.BuyMarketOfferResponse{
		OfferId: res.OfferID, DeliverAtMs: res.DeliverAt.UnixMilli(), Gold: res.Gold, Wallet: walletProto(res.Wallet),
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) marketError(pkt *commonv1.ClientPacket, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, domestic.ErrMarketGold), errors.Is(err, domestic.ErrMarketResource):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INSUFFICIENT_RESOURCE, "insufficient gold or resource")
	case errors.Is(err, domestic.ErrMarketLevel):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_INVALID_BUILDING, "market not built")
	case errors.Is(err, domestic.ErrMarketCapacity):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_DOMESTIC_BUILDING_BUSY, "market capacity exhausted")
	case errors.Is(err, domestic.ErrMarketAmount), errors.Is(err, domestic.ErrMarketPrice),
		errors.Is(err, domestic.ErrMarketDistance), errors.Is(err, domestic.ErrMarketOffer),
		errors.Is(err, domestic.ErrMarketSelf):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid market request")
	case errors.Is(err, domestic.ErrCityNotFound):
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_WORLD_CITY_NOT_FOUND, "city not found")
	}
	return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INTERNAL, "market unavailable")
}
