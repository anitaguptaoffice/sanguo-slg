package domestic

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// Civic decree identifiers (R2-S2).
const (
	DecreeSetTax      int32 = 1
	DecreeSetWorkRate int32 = 2
	DecreePacify      int32 = 3
	DecreeLevy        int32 = 4
	DecreeRename      int32 = 5
)

var (
	ErrCivicInvalid     = errors.New("domestic: invalid civic decree")
	ErrInsufficientGold = errors.New("domestic: insufficient gold")
)

// CivicState is the persisted population/tax snapshot of one city.
type CivicState struct {
	Population   int64
	Morale       int32
	TaxRate      int32
	WorkRate     int32
	LastCivicAt  time.Time
	popRemainder int64
	taxRemainder int64
}

// CivicView is the wire-facing civic snapshot.
type CivicView struct {
	Name           string
	Population     int64
	PopulationCap  int64
	Morale         int32
	TaxRate        int32
	WorkRate       int32
	EffectiveWork  int32
	IdlePopulation int64
	Troops         int64
	FoodUpkeepHour int64
	GoldPerHour    int64
	Gold           int64
}

const civicBasePopulation = 1000
const civicHousePopulation = 500
const civicWorkerPerLevel = 50
const civicPacifyGold = 100

func ensureCivic(c *CityState, now time.Time) {
	if c.Civic.Population <= 0 {
		c.Civic.Population = 500
	}
	if c.Civic.Morale <= 0 {
		c.Civic.Morale = 80
	}
	if c.Civic.TaxRate < 0 {
		c.Civic.TaxRate = 10
	}
	if c.Civic.WorkRate <= 0 {
		c.Civic.WorkRate = 100
	}
	if c.Civic.LastCivicAt.IsZero() {
		c.Civic.LastCivicAt = now
	}
	cap := PopulationCap(c)
	if c.Civic.Population > cap {
		c.Civic.Population = cap
	}
}

// PopulationCap is the housing capacity from the main hall and houses.
func PopulationCap(c *CityState) int64 {
	cap := int64(civicBasePopulation)
	for _, inst := range c.Buildings {
		if inst != nil && inst.CfgID == 20 {
			cap += int64(inst.Level) * civicHousePopulation
		}
	}
	return cap
}

func workersNeeded(c *CityState) int64 {
	var need int64
	for _, inst := range c.Buildings {
		if inst != nil && inst.CfgID >= 2 && inst.CfgID <= 5 {
			need += int64(inst.Level) * civicWorkerPerLevel
		}
	}
	return need
}

// EffectiveWorkRate is the configured rate limited by available population.
func EffectiveWorkRate(c *CityState) int32 {
	rate := c.Civic.WorkRate
	if rate <= 0 {
		rate = 100
	}
	if c.Civic.Population <= 0 {
		// Legacy fixtures without civic state keep the pre-R2-S2 rate.
		return rate
	}
	need := workersNeeded(c)
	if need <= 0 {
		return clampInt32(rate, 0, 100)
	}
	allowed := c.Civic.Population * 100 / need
	if allowed > 100 {
		allowed = 100
	}
	if int64(rate) > allowed {
		return int32(allowed)
	}
	return clampInt32(rate, 0, 100)
}

func clampInt32(v, lo, hi int32) int32 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func civicTargetMorale(taxRate int32) int32 {
	target := 100 - taxRate*2
	if target < 10 {
		target = 10
	}
	return target
}

// settleCivic advances population, morale, tax gold and troop upkeep.
func settleCivic(c *CityState, now time.Time, troops int64) {
	ensureCivic(c, now)
	if !now.After(c.Civic.LastCivicAt) {
		return
	}
	elapsed := now.Sub(c.Civic.LastCivicAt)
	if elapsed > offlineCap {
		elapsed = offlineCap
	}
	secs := int64(elapsed / time.Second)
	if secs <= 0 {
		c.Civic.LastCivicAt = now
		return
	}
	cap := PopulationCap(c)
	target := civicTargetMorale(c.Civic.TaxRate)
	if c.Civic.Morale < target {
		step := int32(secs / 600)
		if step < 1 {
			step = 1
		}
		c.Civic.Morale += step
		if c.Civic.Morale > target {
			c.Civic.Morale = target
		}
	} else if c.Civic.Morale > target {
		step := int32(secs / 600)
		if step < 1 {
			step = 1
		}
		c.Civic.Morale -= step
		if c.Civic.Morale < target {
			c.Civic.Morale = target
		}
	}

	if c.Civic.Population < cap {
		numerator := cap * int64(c.Civic.Morale) * secs
		numerator += c.Civic.popRemainder
		const denominator = int64(100 * 10 * 3600)
		grown := numerator / denominator
		c.Civic.popRemainder = numerator % denominator
		c.Civic.Population += grown
		if c.Civic.Population > cap {
			c.Civic.Population = cap
		}
	} else if c.Civic.Population > cap {
		loss := c.Civic.Population * secs / (3600 * 20)
		if loss < 1 && secs >= 3600 {
			loss = 1
		}
		c.Civic.Population -= loss
		if c.Civic.Population < cap {
			c.Civic.Population = cap
		}
	}

	if c.Civic.TaxRate > 0 {
		numerator := c.Civic.Population * int64(c.Civic.TaxRate) * secs
		numerator += c.Civic.taxRemainder
		const denominator = int64(1000 * 3600)
		gold := numerator / denominator
		c.Civic.taxRemainder = numerator % denominator
		c.Gold += gold
	}

	upkeep := troops / 10
	if troops > 0 && upkeep < 1 {
		upkeep = 1
	}
	cost := upkeep * secs / 3600
	if cost > 0 {
		if c.Wallet.Food >= cost {
			c.Wallet.Food -= cost
		} else {
			c.Wallet.Food = 0
			if c.Civic.Morale > 0 {
				c.Civic.Morale--
			}
		}
	}
	c.Civic.LastCivicAt = now
}

// Civic returns the current view and settles pending time.
func (h *Hub) Civic(ctx context.Context, cityID int64) (CivicView, error) {
	var view CivicView
	h.mu.Lock()
	defer h.mu.Unlock()
	city := h.cities[cityID]
	if city == nil {
		return CivicView{}, ErrCityNotFound
	}
	troops := int64(0)
	if h.troops != nil {
		troops = h.troops(cityID)
	}
	if err := h.updateCityLocked(ctx, cityID, func(c *CityState) error {
		settleCivic(c, h.now(), troops)
		view = civicView(c, troops)
		return nil
	}); err != nil {
		return CivicView{}, err
	}
	return view, nil
}

func civicView(c *CityState, troops int64) CivicView {
	need := workersNeeded(c)
	idle := c.Civic.Population - need
	if idle < 0 {
		idle = 0
	}
	upkeep := troops / 10
	if troops > 0 && upkeep < 1 {
		upkeep = 1
	}
	view := CivicView{
		Name:           c.Name,
		Population:     c.Civic.Population,
		PopulationCap:  PopulationCap(c),
		Morale:         c.Civic.Morale,
		TaxRate:        c.Civic.TaxRate,
		WorkRate:       c.Civic.WorkRate,
		EffectiveWork:  EffectiveWorkRate(c),
		IdlePopulation: idle,
		Troops:         troops,
		FoodUpkeepHour: upkeep,
		GoldPerHour:    c.Civic.Population * int64(c.Civic.TaxRate) / 1000,
		Gold:           c.Gold,
	}
	return view
}

// ApplyCivicDecree applies one of the five main-hall decrees atomically.
func (h *Hub) ApplyCivicDecree(ctx context.Context, cityID int64, decree, value int32, name string) (CivicView, error) {
	var view CivicView
	h.mu.Lock()
	defer h.mu.Unlock()
	city := h.cities[cityID]
	if city == nil {
		return CivicView{}, ErrCityNotFound
	}
	troops := int64(0)
	if h.troops != nil {
		troops = h.troops(cityID)
	}
	if decree == DecreeRename && h.store != nil && city.PlayerID != 0 {
		newName := strings.TrimSpace(name)
		if utf8.RuneCountInString(newName) < 1 || utf8.RuneCountInString(newName) > 16 {
			return CivicView{}, ErrCivicInvalid
		}
		// The city row is outside the wallet/build transaction; renaming inside
		// saveCityInTx would wait on the same row from another connection.
		if err := h.store.renameCity(ctx, h.serverID, cityID, city.PlayerID, newName); err != nil {
			return CivicView{}, err
		}
	}
	err := h.updateCityLocked(ctx, cityID, func(c *CityState) error {
		settleCivic(c, h.now(), troops)
		switch decree {
		case DecreeSetTax:
			if value < 0 || value > 30 {
				return ErrCivicInvalid
			}
			c.Civic.TaxRate = value
		case DecreeSetWorkRate:
			if value < 20 || value > 100 {
				return ErrCivicInvalid
			}
			c.Civic.WorkRate = value
		case DecreePacify:
			if c.Gold < civicPacifyGold {
				return ErrInsufficientGold
			}
			c.Gold -= civicPacifyGold
			c.Civic.Morale += 15
			if c.Civic.Morale > 100 {
				c.Civic.Morale = 100
			}
		case DecreeLevy:
			gain := c.Civic.Population / 2
			c.Wallet.Food += gain
			c.Wallet.Wood += gain
			c.Civic.Morale -= 10
			if c.Civic.Morale < 0 {
				c.Civic.Morale = 0
			}
		case DecreeRename:
			newName := strings.TrimSpace(name)
			if utf8.RuneCountInString(newName) < 1 || utf8.RuneCountInString(newName) > 16 {
				return ErrCivicInvalid
			}
			c.Name = newName
		default:
			return ErrCivicInvalid
		}
		view = civicView(c, troops)
		return nil
	})
	if err != nil {
		return CivicView{}, err
	}
	return view, nil
}
