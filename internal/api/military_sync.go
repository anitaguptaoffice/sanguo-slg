package api

import (
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

type cityCoord struct {
	x, y int
}

func domWalletToMarch(w domestic.Resources) march.Resources {
	return march.Resources{Food: w.Food, Wood: w.Wood, Iron: w.Iron, Stone: w.Stone}
}

func marchWalletToDom(w march.Resources) domestic.Resources {
	return domestic.Resources{Food: w.Food, Wood: w.Wood, Stone: w.Stone, Iron: w.Iron}
}

// ensureMilitaryCity registers a military city once. Wallet mutations belong to
// RecruitWithWallet, never to an unlocked cache-snapshot assignment.
func (s *Server) ensureMilitaryCity(dom *domestic.CityState) *march.CityState {
	if dom == nil || s.military == nil {
		return nil
	}
	return s.military.EnsureCity(&march.CityState{
		ID: dom.ID, PlayerID: dom.PlayerID, Troops: make(map[int32]int32),
	})
}
