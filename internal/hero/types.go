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
	ErrHeroNotIdle      = errors.New("hero: hero is not idle")
	ErrInvalidRecruit   = errors.New("hero: invalid recruit request")
	ErrRecruitItemType       = errors.New("hero: item is not a recruit scroll")
	ErrInsufficientExp       = errors.New("hero: insufficient exp")
	ErrMaxLevel              = errors.New("hero: max level reached")
	ErrHeroNotInCity         = errors.New("hero: not idle in city")
	ErrLevelTableMissing     = errors.New("hero: level table missing")
	ErrLargessCooldown       = errors.New("hero: largess on cooldown")
	ErrLargessInvalidGift    = errors.New("hero: invalid largess gift")
	ErrLargessUnknownItem    = errors.New("hero: item cannot be used for largess")
	ErrGoldLargessNotNeeded = errors.New("hero: gold largess not effective")
	ErrLoyaltyMax           = errors.New("hero: loyalty already at maximum")
	ErrHeroNotCaptive       = errors.New("hero: hero is not captive")
	ErrCaptiveCityMismatch  = errors.New("hero: captive not held in this city")
	ErrHeroNotComing        = errors.New("hero: hero is not coming")
	ErrComingCityMismatch    = errors.New("hero: coming offer not for this city")
	ErrInsufficientPotential = errors.New("hero: insufficient potential points")
	ErrInvalidPointTargets   = errors.New("hero: invalid point targets")
	ErrHeroNotExpr           = errors.New("hero: hero is not in training")
	ErrExprNotFound          = errors.New("hero: expr session not found")
	ErrExprNotComplete       = errors.New("hero: expr not finished yet")
	ErrInvalidExprHours      = errors.New("hero: invalid expr hours")
)

const (
	StatusIdle      int16 = 1 // 空闲（可任职城主）
	StatusGarrison  int16 = 2 // 驻守
	StatusMarch     int16 = 3 // 出征（与城主互斥，见 office_march.go）
	StatusExpr      int16 = 4 // 历练
	StatusCityChief int16 = 5 // 城主（一城一职；legacy state=1）
	StatusCaptive   int16 = 6 // 俘虏（legacy state=5；招降前不计入招贤馆容量）
	StatusComing    int16 = 7 // 来投待接受（legacy state=6；接受前不计入招贤馆容量）
	RecruitScrollID int32 = 2004
	LoyaltyMin        = 0
	LoyaltyMax        = 100
	LoyaltyDefault    = 100
	MaxLevelM1        = 20
	LargessCooldown   = 15 * 60 // seconds; legacy mem_hero_schedule.last_largess
)

type Resources struct {
	Food, Wood, Stone, Iron, Gold int64
}

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
	DisplayName                    string
	Loyalty                        int
	Force, Intel, Politics, Command int32
	ForceAdd, IntelAdd, PoliticsAdd int32
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
