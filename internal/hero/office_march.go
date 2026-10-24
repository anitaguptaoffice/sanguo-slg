package hero

import "errors"

// ErrHeroBusy is returned when a hero cannot take or keep a city office role.
var ErrHeroBusy = errors.New("hero: hero not available for office")

// Office–march mutual exclusion (GAP L5 / legacy OfficeFunc + GroundFunc::StartTroop):
//   - SetCityChief requires StatusIdle (not marching, not already in another blocking role).
//   - StartMarch (military) must reject heroes with StatusCityChief until cleared; call
//     MustClearOfficeBeforeMarch when hero_id march is implemented (HERO-state / MIL-march-hero).
//
// Dismiss and march completion should clear office in legacy; those hooks are out of scope
// for HERO-office-001 except documenting the contract here.

// HeroMayTakeCityOffice reports whether the hero can be appointed city chief.
func HeroMayTakeCityOffice(h *Hero) error {
	if h == nil {
		return ErrHeroNotFound
	}
	switch h.Status {
	case StatusIdle:
		return nil
	case StatusCityChief:
		return nil
	default:
		return ErrHeroBusy
	}
}

// MustClearOfficeBeforeMarch is the guard military should use before marking StatusMarch.
func MustClearOfficeBeforeMarch(h *Hero) error {
	if h == nil {
		return ErrHeroNotFound
	}
	if h.Status == StatusCityChief {
		return ErrHeroBusy
	}
	return nil
}
