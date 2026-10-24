// Package hero manages recruitment, attributes, loyalty, training, and city office roles.
// Service.UseStore persists player_hero and hero_assignment via PGStore.
//
// City chief (HERO-office-001): one chief per city via SetCityChief/ClearCityChief; march
// and chief are mutually exclusive — see office_march.go. Production bonus stub: ChiefLoyaltyProductionBonus.
package hero
