package hero

import (
	"context"
	"errors"
	"fmt"
)

// ComingRecord holds per-coming metadata (legacy state=6 queue row).
type ComingRecord struct {
	CityID int64
}

// ComingStore persists coming metadata separate from player_hero rows.
type ComingStore interface {
	PutComing(ctx context.Context, serverID int32, heroID int64, rec ComingRecord) error
	GetComing(ctx context.Context, serverID int32, heroID int64) (*ComingRecord, error)
	DeleteComing(ctx context.Context, serverID int32, heroID int64) error
}

// InjectComingInput seeds a coming hero (GM/tests; 赠送/转让 follow-up).
type InjectComingInput struct {
	CityID        int64
	TemplateCfgID int32
	DisplayName   string
	Level         int32
	Force         int32
	Intel         int32
	Politics      int32
	Command       int32
	Loyalty       int
}

// InjectComing creates a coming player_hero row plus metadata.
func (s *Service) InjectComing(ctx context.Context, p PlayerRef, in InjectComingInput) (*Hero, error) {
	if s.ComingStore == nil {
		return nil, errors.New("hero: coming store missing")
	}
	if in.CityID <= 0 {
		return nil, ErrInvalidRecruit
	}
	loyalty := in.Loyalty
	if loyalty <= 0 {
		loyalty = 70
	}
	now := s.now()
	h := &Hero{
		ServerID: p.ServerID, PlayerID: p.PlayerID,
		TemplateCfgID: in.TemplateCfgID, DisplayName: in.DisplayName,
		Level: in.Level, Loyalty: loyalty,
		Force: in.Force, Intel: in.Intel, Politics: in.Politics, Command: in.Command,
		Status: StatusComing, CreatedAt: now,
	}
	if h.Level < 1 {
		h.Level = 1
	}
	if err := s.Store.CreateHero(ctx, h); err != nil {
		return nil, err
	}
	if err := s.ComingStore.PutComing(ctx, p.ServerID, h.HeroID, ComingRecord{CityID: in.CityID}); err != nil {
		return nil, err
	}
	return h, nil
}

func (s *Service) loadComingHero(ctx context.Context, p PlayerRef, heroID int64) (*Hero, *ComingRecord, error) {
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return nil, nil, err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return nil, nil, ErrHeroNotFound
	}
	if h.Status != StatusComing {
		return nil, nil, ErrHeroNotComing
	}
	if s.ComingStore == nil {
		return nil, nil, errors.New("hero: coming store missing")
	}
	rec, err := s.ComingStore.GetComing(ctx, p.ServerID, heroID)
	if err != nil {
		return nil, nil, err
	}
	if rec == nil {
		return nil, nil, ErrHeroNotComing
	}
	return h, rec, nil
}

// ListComingHeroes returns all coming offers for a player.
func (s *Service) ListComingHeroes(ctx context.Context, p PlayerRef) ([]*Hero, map[int64]ComingRecord, error) {
	heroes, err := s.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return nil, nil, err
	}
	var coming []*Hero
	meta := map[int64]ComingRecord{}
	for _, h := range heroes {
		if h.Status != StatusComing {
			continue
		}
		coming = append(coming, h)
		if s.ComingStore != nil {
			rec, err := s.ComingStore.GetComing(ctx, p.ServerID, h.HeroID)
			if err != nil {
				return nil, nil, err
			}
			if rec != nil {
				meta[h.HeroID] = *rec
			}
		}
	}
	return coming, meta, nil
}

// TryAcceptComingResult is the precheck outcome for accepting a coming hero.
type TryAcceptComingResult struct {
	Hero    *Hero
	Summary string
}

// TryAcceptComing validates state and returns accept prompt (legacy tryAcceptHero).
func (s *Service) TryAcceptComing(ctx context.Context, p PlayerRef, cityID, heroID int64) (TryAcceptComingResult, error) {
	h, rec, err := s.loadComingHero(ctx, p, heroID)
	if err != nil {
		return TryAcceptComingResult{}, err
	}
	if cityID > 0 && rec.CityID != cityID {
		return TryAcceptComingResult{}, ErrComingCityMismatch
	}
	name := h.DisplayName
	if name == "" {
		name = fmt.Sprintf("将领#%d", h.HeroID)
	}
	summary := fmt.Sprintf("是否接受将领%s加入麾下？", name)
	return TryAcceptComingResult{Hero: h, Summary: summary}, nil
}

// SureAcceptComingResult is a successful accept from coming queue.
type SureAcceptComingResult struct {
	Hero *Hero
}

// SureAcceptComing converts coming hero to owned idle (legacy sureAcceptHero).
func (s *Service) SureAcceptComing(ctx context.Context, p PlayerRef, city CityRef, heroID int64, cityPort HotelCityPort) (SureAcceptComingResult, error) {
	if cityPort == nil {
		return SureAcceptComingResult{}, errors.New("hero: coming dependencies missing")
	}
	h, rec, err := s.loadComingHero(ctx, p, heroID)
	if err != nil {
		return SureAcceptComingResult{}, err
	}
	if city.CityID > 0 && rec.CityID != city.CityID {
		return SureAcceptComingResult{}, ErrComingCityMismatch
	}
	officeLevel, err := cityPort.OfficeLevel(ctx, p.ServerID, rec.CityID)
	if err != nil {
		return SureAcceptComingResult{}, err
	}
	heroes, err := s.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return SureAcceptComingResult{}, err
	}
	if !HasHeroCapacity(officeLevel, CountOwnedHeroes(heroes)) {
		return SureAcceptComingResult{}, ErrHotelCapacityFull
	}
	h.Status = StatusIdle
	if h.Loyalty <= 0 {
		h.Loyalty = 70
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return SureAcceptComingResult{}, err
	}
	if err := s.ComingStore.DeleteComing(ctx, p.ServerID, heroID); err != nil {
		return SureAcceptComingResult{}, err
	}
	return SureAcceptComingResult{Hero: h}, nil
}

// RejectComing declines a coming offer (legacy rejectHero).
func (s *Service) RejectComing(ctx context.Context, p PlayerRef, cityID, heroID int64) error {
	h, rec, err := s.loadComingHero(ctx, p, heroID)
	if err != nil {
		return err
	}
	if cityID > 0 && rec.CityID != cityID {
		return ErrComingCityMismatch
	}
	if err := s.ComingStore.DeleteComing(ctx, p.ServerID, heroID); err != nil {
		return err
	}
	return s.Store.DeleteHero(ctx, p.ServerID, h.HeroID)
}
