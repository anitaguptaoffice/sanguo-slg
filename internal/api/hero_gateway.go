package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
)

const (
	RouteListPlayerHeroes     = "hero.v1.ListPlayerHeroes"
	RouteGetHeroDetail        = "hero.v1.GetHeroDetail"
	RouteRecruitHero          = "hero.v1.RecruitHero"
	RouteListRecruitTemplates = "hero.v1.ListRecruitTemplates"
	RouteUpgradeHero          = "hero.v1.UpgradeHero"
)

func heroGatewayHandlers(s *Server) map[string]gateway.RouteHandler {
	return map[string]gateway.RouteHandler{
		RouteListPlayerHeroes:     s.handleListPlayerHeroes,
		RouteGetHeroDetail:        s.handleGetHeroDetail,
		RouteRecruitHero:          s.handleRecruitHero,
		RouteListRecruitTemplates: s.handleListRecruitTemplates,
		RouteUpgradeHero:          s.handleUpgradeHero,
	}
}
