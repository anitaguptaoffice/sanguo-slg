package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
)

const (
	RouteListPlayerHeroes           = "hero.v1.ListPlayerHeroes"
	RouteGetHeroDetail              = "hero.v1.GetHeroDetail"
	RouteRecruitHero                = "hero.v1.RecruitHero"
	RouteListRecruitTemplates       = "hero.v1.ListRecruitTemplates"
	RouteUpgradeHero                = "hero.v1.UpgradeHero"
	RouteListHotelRecruitCandidates = "hero.v1.ListHotelRecruitCandidates"
	RouteRefreshHotelRecruitPool    = "hero.v1.RefreshHotelRecruitPool"
	RouteRecruitHotelCandidate      = "hero.v1.RecruitHotelCandidate"
	RouteSetCityChief               = "hero.v1.SetCityChief"
	RouteClearCityChief             = "hero.v1.ClearCityChief"
	RouteGetCityChief               = "hero.v1.GetCityChief"
	RouteLargessHero                = "hero.v1.LargessHero"
)

func heroGatewayHandlers(s *Server) map[string]gateway.RouteHandler {
	return map[string]gateway.RouteHandler{
		RouteListPlayerHeroes:           s.handleListPlayerHeroes,
		RouteGetHeroDetail:              s.handleGetHeroDetail,
		RouteRecruitHero:                s.handleRecruitHero,
		RouteListRecruitTemplates:       s.handleListRecruitTemplates,
		RouteUpgradeHero:                s.handleUpgradeHero,
		RouteListHotelRecruitCandidates: s.handleListHotelRecruitCandidates,
		RouteRefreshHotelRecruitPool:    s.handleRefreshHotelRecruitPool,
		RouteRecruitHotelCandidate:      s.handleRecruitHotelCandidate,
		RouteSetCityChief:               s.handleSetCityChief,
		RouteClearCityChief:             s.handleClearCityChief,
		RouteGetCityChief:               s.handleGetCityChief,
		RouteLargessHero:                s.handleLargessHero,
	}
}
