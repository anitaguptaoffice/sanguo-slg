package hero

import "context"

// ClaimForMarch marks an owned idle hero as marching (status 出征).
func (s *Service) ClaimForMarch(ctx context.Context, p PlayerRef, heroID int64) error {
	if heroID <= 0 {
		return ErrHeroNotFound
	}
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return ErrHeroNotFound
	}
	if h.Status != StatusIdle {
		if err := MustClearOfficeBeforeMarch(h); err != nil {
			return err
		}
		return ErrHeroNotIdle
	}
	if err := MustClearOfficeBeforeMarch(h); err != nil {
		return err
	}
	if err := s.consumeMarchForceForMarch(ctx, p, h); err != nil {
		return err
	}
	h.Status = StatusMarch
	return s.Store.SaveHero(ctx, h)
}

// ReleaseFromMarch restores a hero to idle after march end or cancel.
func (s *Service) ReleaseFromMarch(ctx context.Context, p PlayerRef, heroID int64) error {
	if heroID <= 0 {
		return nil
	}
	h, err := s.Store.GetHero(ctx, p.ServerID, heroID)
	if err != nil {
		return err
	}
	if h == nil || h.PlayerID != p.PlayerID {
		return ErrHeroNotFound
	}
	if h.Status == StatusMarch {
		h.Status = StatusIdle
		return s.Store.SaveHero(ctx, h)
	}
	return nil
}
