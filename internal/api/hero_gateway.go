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
	RouteAddHeroPoint               = "hero.v1.AddHeroPoint"
	RouteClearHeroPoint             = "hero.v1.ClearHeroPoint"
	RouteListHotelRecruitCandidates = "hero.v1.ListHotelRecruitCandidates"
	RouteRefreshHotelRecruitPool    = "hero.v1.RefreshHotelRecruitPool"
	RouteRecruitHotelCandidate      = "hero.v1.RecruitHotelCandidate"
	RouteSetCityChief               = "hero.v1.SetCityChief"
	RouteClearCityChief             = "hero.v1.ClearCityChief"
	RouteGetCityChief               = "hero.v1.GetCityChief"
	RouteLargessHero                = "hero.v1.LargessHero"
	RouteListCaptiveHeroes          = "hero.v1.ListCaptiveHeroes"
	RouteTrySummonCaptive           = "hero.v1.TrySummonCaptive"
	RouteSureSummonCaptive          = "hero.v1.SureSummonCaptive"
	RouteReleaseCaptive             = "hero.v1.ReleaseCaptive"
	RouteListComingHeroes           = "hero.v1.ListComingHeroes"
	RouteTryAcceptComing            = "hero.v1.TryAcceptComing"
	RouteSureAcceptComing           = "hero.v1.SureAcceptComing"
	RouteRejectComing               = "hero.v1.RejectComing"
	RouteListPersuadeTargets        = "hero.v1.ListPersuadeTargets"
	RoutePersuadeHero               = "hero.v1.PersuadeHero"
	RouteLionizeHero                = "hero.v1.LionizeHero"
)

func heroGatewayHandlers(s *Server) map[string]gateway.RouteHandler {
	return map[string]gateway.RouteHandler{
		RouteListPlayerHeroes:           s.handleListPlayerHeroes,
		RouteGetHeroDetail:              s.handleGetHeroDetail,
		RouteRecruitHero:                s.handleRecruitHero,
		RouteListRecruitTemplates:       s.handleListRecruitTemplates,
		RouteUpgradeHero:                s.handleUpgradeHero,
		RouteAddHeroPoint:               s.handleAddHeroPoint,
		RouteClearHeroPoint:             s.handleClearHeroPoint,
		RouteListHotelRecruitCandidates: s.handleListHotelRecruitCandidates,
		RouteRefreshHotelRecruitPool:    s.handleRefreshHotelRecruitPool,
		RouteRecruitHotelCandidate:      s.handleRecruitHotelCandidate,
		RouteSetCityChief:               s.handleSetCityChief,
		RouteClearCityChief:             s.handleClearCityChief,
		RouteGetCityChief:               s.handleGetCityChief,
		RouteLargessHero:                s.handleLargessHero,
		RouteListCaptiveHeroes:          s.handleListCaptiveHeroes,
		RouteTrySummonCaptive:           s.handleTrySummonCaptive,
		RouteSureSummonCaptive:          s.handleSureSummonCaptive,
		RouteReleaseCaptive:             s.handleReleaseCaptive,
		RouteListComingHeroes:           s.handleListComingHeroes,
		RouteTryAcceptComing:            s.handleTryAcceptComing,
		RouteSureAcceptComing:           s.handleSureAcceptComing,
		RouteRejectComing:               s.handleRejectComing,
		RouteListPersuadeTargets:        s.handleListPersuadeTargets,
		RoutePersuadeHero:               s.handlePersuadeHero,
		RouteLionizeHero:                s.handleLionizeHero,
	}
}
