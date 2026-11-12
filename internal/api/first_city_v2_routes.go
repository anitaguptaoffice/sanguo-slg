package api

const (
	RouteDiscoverFirstCityIntent = "world.v2.DiscoverFirstCityIntent"
	RouteSubmitFirstCity         = "world.v2.SubmitFirstCity"
)

// FirstCityV2Realm resolves the enrolled realm_id for an authenticated actor.
// A nil resolver or false result yields COMMON_UNAVAILABLE, not legacy fallback.
type FirstCityV2Realm func(PlayerContext) (realmID string, ok bool)

// EnableFirstCityV2Routes registers dormant world.v2 first-city handlers on the
// gateway table. Production wiring must not call this until activation gates pass.
func (s *Server) EnableFirstCityV2Routes(realm FirstCityV2Realm) {
	s.firstCityV2Routes = true
	s.firstCityV2Realm = realm
}
