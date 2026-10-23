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

// ensureMilitaryCity registers march city state and mirrors wallet from domestic (source of truth).
func (s *Server) ensureMilitaryCity(dom *domestic.CityState) *march.CityState {
	mc := s.military.City(dom.ID)
	if mc == nil {
		mc = &march.CityState{
			ID:       dom.ID,
			PlayerID: dom.PlayerID,
			Troops:   make(map[int32]int32),
		}
		s.military.RegisterCity(mc)
	}
	mc.PlayerID = dom.PlayerID
	mc.Wallet = domWalletToMarch(dom.Wallet)
	return mc
}

func (s *Server) syncDomesticWalletFromMarch(dom *domestic.CityState, w march.Resources) {
	dom.Wallet = marchWalletToDom(w)
}
