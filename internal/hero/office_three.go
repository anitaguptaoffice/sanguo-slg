package hero

import (
	"context"
	"errors"
)

// City office kinds.
const (
	OfficeSteward    int16 = 1
	OfficeStrategist int16 = 2
	OfficeGeneral    int16 = 3
)

var (
	ErrInvalidOffice = errors.New("hero: invalid city office")
	ErrOfficeBusy    = errors.New("hero: hero already holds a city office")
)

// CityOffice is one appointment row.
type CityOffice struct {
	CityID     int64
	Office     int16
	HeroID     int64
	PlayerID   int64
	Level      int32
	Name       string
	Loyalty    int
	Politics   int32
	Intel      int32
	Command    int32
	Force      int32
	Salary     int64
	Production int64
	BuildSpeed int64
	Research   int64
	Defense    int64
	Attack     int64
}

// OfficeStore keeps city office rows.
type OfficeStore interface {
	SaveCityOffice(ctx context.Context, serverID int32, cityID int64, office int16, heroID int64) error
	DeleteCityOffice(ctx context.Context, serverID int32, cityID int64, office int16) error
	CityOffices(ctx context.Context, serverID int32, cityID int64) ([]CityOffice, error)
	FindCityOfficeByHero(ctx context.Context, serverID int32, heroID int64) (*CityOffice, error)
}

func officeStore(s *Service) (OfficeStore, error) {
	store, ok := s.Store.(OfficeStore)
	if !ok {
		return nil, ErrNotCityOwner
	}
	return store, nil
}

func officeSalary(level int32) int64 { return 50 + int64(level)*10 }

func officeBonuses(o *CityOffice) {
	o.Salary = officeSalary(o.Level)
	switch o.Office {
	case OfficeSteward:
		o.Production = int64(o.Politics) / 5
		o.BuildSpeed = int64(o.Politics) / 10
	case OfficeStrategist:
		o.Research = int64(o.Intel) / 5
		o.Defense = int64(o.Intel) / 10
	case OfficeGeneral:
		o.Defense = int64(o.Command) / 5
		o.Attack = int64(o.Force) / 10
	}
}

// SetCityOffice appoints one hero to a city office, replacing the prior holder.
func (s *Service) SetCityOffice(ctx context.Context, p PlayerRef, cityID int64, office int16, heroID int64, own CityOwnershipPort) ([]CityOffice, error) {
	if cityID <= 0 || heroID <= 0 || office < OfficeSteward || office > OfficeGeneral {
		return nil, ErrInvalidOffice
	}
	if own != nil {
		ok, err := own.PlayerOwnsCity(ctx, p, cityID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrNotCityOwner
		}
	}
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return nil, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return nil, ErrHeroNotFound
	}
	if err := HeroMayTakeCityOffice(h); err != nil {
		return nil, err
	}
	store, err := officeStore(s)
	if err != nil {
		return nil, err
	}
	other, err := store.FindCityOfficeByHero(ctx, p.ServerID, heroID)
	if err != nil {
		return nil, err
	}
	if other != nil && (other.CityID != cityID || other.Office != office) {
		if err := store.DeleteCityOffice(ctx, p.ServerID, other.CityID, other.Office); err != nil {
			return nil, err
		}
	}
	if err := store.SaveCityOffice(ctx, p.ServerID, cityID, office, heroID); err != nil {
		return nil, err
	}
	h.Status = StatusCityOffice
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return nil, err
	}
	return s.CityOffices(ctx, p.ServerID, cityID)
}

// ClearCityOffice removes one office holder and returns the hero to idle.
func (s *Service) ClearCityOffice(ctx context.Context, p PlayerRef, cityID int64, office int16, own CityOwnershipPort) ([]CityOffice, error) {
	if cityID <= 0 || office < OfficeSteward || office > OfficeGeneral {
		return nil, ErrInvalidOffice
	}
	if own != nil {
		ok, err := own.PlayerOwnsCity(ctx, p, cityID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrNotCityOwner
		}
	}
	store, err := officeStore(s)
	if err != nil {
		return nil, err
	}
	rows, err := store.CityOffices(ctx, p.ServerID, cityID)
	if err != nil {
		return nil, err
	}
	var heroID int64
	for _, row := range rows {
		if row.Office == office {
			heroID = row.HeroID
		}
	}
	if heroID == 0 {
		return s.CityOffices(ctx, p.ServerID, cityID)
	}
	if err := store.DeleteCityOffice(ctx, p.ServerID, cityID, office); err != nil {
		return nil, err
	}
	if h, err := s.Store.GetHero(ctx, p.ServerID, heroID); err == nil && h != nil {
		h.Status = StatusIdle
		_ = s.Store.SaveHero(ctx, h)
	}
	return s.CityOffices(ctx, p.ServerID, cityID)
}

// CityOffices returns the three office views with bonuses.
func (s *Service) CityOffices(ctx context.Context, serverID int32, cityID int64) ([]CityOffice, error) {
	store, err := officeStore(s)
	if err != nil {
		return nil, err
	}
	rows, err := store.CityOffices(ctx, serverID, cityID)
	if err != nil {
		return nil, err
	}
	for i := range rows {
		officeBonuses(&rows[i])
	}
	return rows, nil
}

// OfficeBonuses sums the city office bonuses for production/build/research/defense/attack.
func (s *Service) OfficeBonuses(ctx context.Context, serverID int32, cityID int64) (production, buildSpeed, research, defense, attack int64) {
	rows, err := s.CityOffices(ctx, serverID, cityID)
	if err != nil {
		return 0, 0, 0, 0, 0
	}
	for _, row := range rows {
		production += row.Production
		buildSpeed += row.BuildSpeed
		research += row.Research
		defense += row.Defense
		attack += row.Attack
	}
	return
}

// ApplyOfficeSalary pays or misses one salary cycle.
func (s *Service) ApplyOfficeSalary(ctx context.Context, p PlayerRef, cityID int64, paid bool) ([]CityOffice, error) {
	store, err := officeStore(s)
	if err != nil {
		return nil, err
	}
	rows, err := store.CityOffices(ctx, p.ServerID, cityID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		h, err := s.Store.GetHero(ctx, p.ServerID, row.HeroID)
		if err != nil || h == nil {
			continue
		}
		if paid {
			h.Loyalty += 1
		} else {
			h.Loyalty -= 3
		}
		if h.Loyalty > 100 {
			h.Loyalty = 100
		}
		if h.Loyalty < 0 {
			h.Loyalty = 0
		}
		_ = s.Store.SaveHero(ctx, h)
	}
	return s.CityOffices(ctx, p.ServerID, cityID)
}

// RewardOfficeHero raises one office hero's loyalty for gold (gold spent by API).
func (s *Service) RewardOfficeHero(ctx context.Context, p PlayerRef, heroID int64, loyalty int) (int, error) {
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil || h == nil || h.PlayerID != p.PlayerID {
		return 0, ErrHeroNotFound
	}
	h.Loyalty += loyalty
	if h.Loyalty > 100 {
		h.Loyalty = 100
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return 0, err
	}
	return h.Loyalty, nil
}

// TotalOfficeSalary returns the gold required for one salary cycle.
func TotalOfficeSalary(rows []CityOffice) int64 {
	var total int64
	for _, row := range rows {
		total += officeSalary(row.Level)
	}
	return total
}
