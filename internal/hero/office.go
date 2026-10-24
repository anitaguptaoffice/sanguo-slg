package hero

import (
	"context"
	"errors"
	"time"
)

// ErrNotCityOwner is returned when the player does not own the target city.
var ErrNotCityOwner = errors.New("hero: city not owned by player")

// ErrNoCityChief is returned when clearing chief on a city with no appointment.
var ErrNoCityChief = errors.New("hero: no city chief assigned")

const (
	AssignTypeCity int16 = 1
)

// CityChiefView is the current chief appointment for a city.
type CityChiefView struct {
	CityID           int64
	HeroID           int64
	Loyalty          int
	ProductionBonus  float64
}

// CityOwnershipPort checks that a player owns a city (wired from domestic in API layer).
type CityOwnershipPort interface {
	PlayerOwnsCity(ctx context.Context, p PlayerRef, cityID int64) (bool, error)
}

// SetCityChief appoints one chief per city; replaces any previous chief on that city.
func (s *Service) SetCityChief(ctx context.Context, p PlayerRef, cityID, heroID int64, own CityOwnershipPort) (CityChiefView, error) {
	if cityID == 0 || heroID == 0 {
		return CityChiefView{}, ErrInvalidRecruit
	}
	if own != nil {
		ok, err := own.PlayerOwnsCity(ctx, p, cityID)
		if err != nil {
			return CityChiefView{}, err
		}
		if !ok {
			return CityChiefView{}, ErrNotCityOwner
		}
	}
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return CityChiefView{}, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return CityChiefView{}, ErrHeroNotFound
	}
	if err := HeroMayTakeCityOffice(h); err != nil {
		return CityChiefView{}, err
	}

	prev, err := s.Store.FindCityChief(ctx, p.ServerID, cityID)
	if err != nil {
		return CityChiefView{}, err
	}
	if prev != nil && prev.HeroID == heroID {
		return CityChiefView{
			CityID: cityID, HeroID: heroID, Loyalty: h.Loyalty,
			ProductionBonus: ChiefLoyaltyProductionBonus(h.Loyalty),
		}, nil
	}
	if prev != nil {
		if err := s.clearChiefHero(ctx, p.ServerID, prev.HeroID); err != nil {
			return CityChiefView{}, err
		}
	}
	other, err := s.Store.GetAssignmentByHero(ctx, p.ServerID, heroID)
	if err != nil {
		return CityChiefView{}, err
	}
	if other != nil && other.TargetID != cityID {
		if err := s.clearChiefHero(ctx, p.ServerID, heroID); err != nil {
			return CityChiefView{}, err
		}
	}

	h.Status = StatusCityChief
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return CityChiefView{}, err
	}
	a := &Assignment{
		ServerID: p.ServerID, HeroID: heroID, AssignType: AssignTypeCity,
		TargetID: cityID, AssignedAt: s.now(),
	}
	if err := s.Store.SaveAssignment(ctx, a); err != nil {
		return CityChiefView{}, err
	}
	return CityChiefView{
		CityID: cityID, HeroID: heroID, Loyalty: h.Loyalty,
		ProductionBonus: ChiefLoyaltyProductionBonus(h.Loyalty),
	}, nil
}

// ClearCityChief removes the chief from a city and returns the hero to idle.
func (s *Service) ClearCityChief(ctx context.Context, p PlayerRef, cityID int64, own CityOwnershipPort) error {
	if cityID == 0 {
		return ErrInvalidRecruit
	}
	if own != nil {
		ok, err := own.PlayerOwnsCity(ctx, p, cityID)
		if err != nil {
			return err
		}
		if !ok {
			return ErrNotCityOwner
		}
	}
	prev, err := s.Store.FindCityChief(ctx, p.ServerID, cityID)
	if err != nil {
		return err
	}
	if prev == nil {
		return ErrNoCityChief
	}
	h, err := s.Store.GetHero(ctx, p.ServerID, prev.HeroID)
	if err != nil {
		return err
	}
	if h != nil && h.PlayerID != p.PlayerID {
		return ErrNotCityOwner
	}
	return s.clearChiefHero(ctx, p.ServerID, prev.HeroID)
}

// GetCityChief returns the appointed chief for a city, or zero hero_id when unset.
func (s *Service) GetCityChief(ctx context.Context, p PlayerRef, cityID int64, own CityOwnershipPort) (CityChiefView, error) {
	if cityID == 0 {
		return CityChiefView{}, ErrInvalidRecruit
	}
	if own != nil {
		ok, err := own.PlayerOwnsCity(ctx, p, cityID)
		if err != nil {
			return CityChiefView{}, err
		}
		if !ok {
			return CityChiefView{}, ErrNotCityOwner
		}
	}
	prev, err := s.Store.FindCityChief(ctx, p.ServerID, cityID)
	if err != nil {
		return CityChiefView{}, err
	}
	if prev == nil {
		return CityChiefView{CityID: cityID}, nil
	}
	h, err := s.Store.GetHero(ctx, p.ServerID, prev.HeroID)
	if err != nil {
		return CityChiefView{}, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return CityChiefView{CityID: cityID}, nil
	}
	return CityChiefView{
		CityID: cityID, HeroID: h.HeroID, Loyalty: h.Loyalty,
		ProductionBonus: ChiefLoyaltyProductionBonus(h.Loyalty),
	}, nil
}

func (s *Service) clearChiefHero(ctx context.Context, serverID int32, heroID int64) error {
	h, err := s.Store.GetHero(ctx, serverID, heroID)
	if err != nil {
		return err
	}
	if h != nil && h.Status == StatusCityChief {
		h.Status = StatusIdle
		if err := s.Store.SaveHero(ctx, h); err != nil {
			return err
		}
	}
	return s.Store.DeleteAssignmentByHero(ctx, serverID, heroID)
}

// Assignment mirrors hero_assignment (city chief uses AssignTypeCity).
type Assignment struct {
	ServerID   int32
	HeroID     int64
	AssignType int16
	TargetID   int64
	AssignedAt time.Time
}
