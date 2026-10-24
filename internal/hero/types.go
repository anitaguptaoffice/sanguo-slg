package hero

import (
	"errors"
	"time"
)

var (
	ErrUnknownTemplate  = errors.New("hero: unknown template_cfg_id")
	ErrAlreadyOwned     = errors.New("hero: template already recruited")
	ErrInsufficientRes  = errors.New("hero: insufficient resources")
	ErrInsufficientItem = errors.New("hero: insufficient item")
	ErrEmptyPool        = errors.New("hero: no heroes available in pool")
	ErrHeroNotFound     = errors.New("hero: hero not found")
	ErrInvalidRecruit   = errors.New("hero: invalid recruit request")
	ErrRecruitItemType  = errors.New("hero: item is not a recruit scroll")
	ErrInsufficientExp  = errors.New("hero: insufficient exp")
	ErrMaxLevel         = errors.New("hero: max level reached")
	ErrHeroNotInCity    = errors.New("hero: not idle in city")
	ErrLevelTableMissing = errors.New("hero: level table missing")
)

const (
	StatusIdle        int16 = 1
	RecruitScrollID   int32 = 2004
	LoyaltyMin        = 0
	LoyaltyMax        = 100
	LoyaltyDefault    = 100
	MaxLevelM1        = 20
)

type Resources struct{ Food, Wood, Stone, Iron int64 }

func (a *Resources) Sub(b Resources) bool {
	if a.Food < b.Food || a.Wood < b.Wood || a.Stone < b.Stone || a.Iron < b.Iron {
		return false
	}
	a.Food, a.Wood, a.Stone, a.Iron = a.Food-b.Food, a.Wood-b.Wood, a.Stone-b.Stone, a.Iron-b.Iron
	return true
}

type BaseStats struct{ Force, Intel, Politics, Command int32 }

type ItemCost struct{ ItemCfgID, Quantity int32 }

type Template struct {
	TemplateCfgID       int32
	Code, Name, Pool    string
	Rarity              int16
	Base                BaseStats
	RecruitCost         Resources
	RecruitItem         ItemCost
}

type Hero struct {
	ServerID, TemplateCfgID, Level int32
	HeroID, PlayerID, Exp          int64
	Loyalty                        int
	Force, Intel, Politics, Command int32
	Status                         int16
	CreatedAt                      time.Time
}

func ClampLoyalty(v int) int {
	if v < LoyaltyMin {
		return LoyaltyMin
	}
	if v > LoyaltyMax {
		return LoyaltyMax
	}
	return v
}

func (h *Hero) SetLoyalty(v int) { h.Loyalty = ClampLoyalty(v) }

type PlayerState struct {
	ServerID   int32
	PlayerID   int64
	Wallet     Resources
	Items      map[int32]int32
	Heroes     []*Hero
	nextHeroID int64
}

type RecruitItemSpec struct {
	ItemCfgID int32
	ItemType  int16
	Draws     int32
	HeroPool  string
}
