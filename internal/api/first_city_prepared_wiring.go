package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

// FirstCityPreparedCreationSource holds startup-composed fresh participants for the
// DOM PreparedCity effect path. Default-off; runtime wires this only when enabled.
type FirstCityPreparedCreationSource struct {
	Dom     *domestic.FreshCityParticipant
	World   *world.FreshCityParticipant
	Mil     *march.FreshCityParticipant
	Binding *recruittx.Binding
	Profile freshsource.Profile
}

// WireFirstCityPreparedCreation installs the prepared-city participant stack. Nil clears it.
func (s *Server) WireFirstCityPreparedCreation(src *FirstCityPreparedCreationSource) {
	s.firstCityPrepared = src
}

// FirstCityPreparedCreationEffect uses Prepare/LockWallet/Stage/Publish when wired.
func (s *Server) FirstCityPreparedCreationEffect() FirstCityV2Effect {
	return firstCityPreparedCreationEffect{srv: s}
}