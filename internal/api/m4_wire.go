package api

import (
	"context"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content/mail"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/assembly"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
)

// WireM4Content attaches quest, shop, shared content grant, and GM to the gateway (INTG-004).
func (s *Server) WireM4Content(ctx context.Context) error {
	if s.m4 == nil {
		s.m4 = assembly.NewM4()
	}
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		return err
	}
	contentSvc := content.NewService(cat)
	if s.players.Pool != nil {
		contentSvc.UseStore(content.NewPGStore(s.players.Pool))
	}

	questCat := devQuestCatalog()
	if mem, err := quest.MemCatalogFromPG(ctx, s.players.Pool); err == nil && len(mem.All()) > 0 {
		questCat = mem
	}
	questStore := quest.NewPGStore(s.players.Pool)
	s.questSvc = quest.NewService(questStore, questCat, quest.NewContentGranter(contentSvc), nil)
	s.questChainIDs = questChainIDsFromCatalog(questCat)

	s.shopSvc = shop.NewService(devShopCatalog(), nil, shop.NewPayments(contentSvc, s.newShopWalletStore()), s.players.Pool)
	s.contentSvc = contentSvc
	var mailStore mail.Store = mail.NewMemStore()
	if s.players.Pool != nil {
		mailStore = mail.NewPGStore(s.players.Pool)
	}
	s.mailSvc = mail.NewService(mailStore, contentSvc, s.log)
	s.gm = NewGmService(s.log, s.players.Pool, s.sessions, contentSvc)
	s.wireHeroService(s.players.Pool)

	s.m4.Register(RouteListPlayerQuests, s.handleListPlayerQuests)
	s.m4.Register(RouteAcceptQuest, s.handleAcceptQuest)
	s.m4.Register(RouteReportQuestProgress, s.handleReportQuestProgress)
	s.m4.Register(RouteClaimQuestReward, s.handleClaimQuestReward)
	s.m4.Register(RouteGetQuestChainStatus, s.handleGetQuestChainStatus)
	s.m4.Register(RouteListShopShelf, s.handleListShopShelf)
	s.m4.Register(RoutePurchaseShopOffer, s.handlePurchaseShopOffer)
	s.m4.Register(RouteListPlayerBag, s.handleListPlayerBag)
	s.m4.Register(RouteUseConsumable, s.handleUseConsumable)
	s.m4.Register(RouteListPlayerMail, s.handleListPlayerMail)
	s.m4.Register(RouteMarkPlayerMailRead, s.handleMarkPlayerMailRead)
	s.m4.Register(RouteClaimPlayerMailAttachments, s.handleClaimPlayerMailAttachments)
	for route, h := range heroGatewayHandlers(s) {
		s.m4.Register(route, h)
	}
	return nil
}

// ContentService exposes the shared bag/wallet grant service (smoke tests).
func (s *Server) ContentService() *content.Service {
	return s.contentSvc
}
