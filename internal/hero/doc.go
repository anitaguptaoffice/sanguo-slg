// Package hero manages recruitment, attributes, loyalty, training, and city office roles.
// Service.UseStore persists player_hero and hero_assignment via PGStore.
//
// Identity rollout: CreateHero allocates insert-only identities; CreateHeroInTx
// participates in a caller transaction without committing. Creation accepts zero
// allocated points only; existing point updates still require legacy schema setup.
// SaveHero is update-only; all creators use CreateHero and never MAX/UPSERT.
// This identity-only stage is not a releaseable natural-recruit writer set.
// Legacy natural recruitment is memory-only; PG fails closed until the API
// coordinator composes PlanRecruit, tx debits and CreateHeroInTx.
//
// City chief (HERO-office-001): one chief per city via SetCityChief/ClearCityChief; march
// and chief are mutually exclusive — see office_march.go. Production bonus stub: ChiefLoyaltyProductionBonus.
package hero
