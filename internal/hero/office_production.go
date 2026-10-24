package hero

// ChiefLoyaltyProductionBonus is a stub hook for domestic hourly production (legacy
// OfficeFunc::setCityChief loyalty → city resource add). Domestic may multiply rates by
// 1 + ChiefLoyaltyProductionBonus(chief.Loyalty) once wired; M1 returns a small linear
// fraction capped at 5% when loyalty is 100.
func ChiefLoyaltyProductionBonus(loyalty int) float64 {
	if loyalty <= 0 {
		return 0
	}
	b := float64(ClampLoyalty(loyalty)) / 100.0 * 0.05
	if b > 0.05 {
		return 0.05
	}
	return b
}
