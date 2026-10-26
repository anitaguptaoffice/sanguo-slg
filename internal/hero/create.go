package hero

import "errors"

// ErrHeroIdentity means an explicit ID, collision, or exhausted allocator prevented creation.
var ErrHeroIdentity = errors.New("hero: invalid creation identity")

// ErrHeroCreatePoints rejects preallocated points: create at zero, then update.
var ErrHeroCreatePoints = errors.New("hero: allocated points require an existing hero")

func validateHeroCreation(h *Hero) error {
	if h == nil || h.HeroID != 0 {
		return ErrHeroIdentity
	}
	if h.ForceAdd != 0 || h.IntelAdd != 0 || h.PoliticsAdd != 0 {
		return ErrHeroCreatePoints
	}
	return nil
}

// ErrRecruitTransactionRequired rejects durable recruitment from external snapshots.
var ErrRecruitTransactionRequired = errors.New("hero: recruit transaction coordinator required")
