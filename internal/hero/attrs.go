package hero

func growthPct(rarity int16) int32 {
	if rarity >= 5 {
		return 6
	}
	return 5
}

func GrowthPerStat(base int32, rarity int16) int32 {
	g := base * growthPct(rarity) / 100
	if g < 1 {
		return 1
	}
	return g
}

func StatAtLevel(base, level, growth int32) int32 {
	if level < 1 {
		level = 1
	}
	if level > MaxLevelM1 {
		level = MaxLevelM1
	}
	return base + growth*(level-1)
}

func StatsAtLevel(t Template, level int32) BaseStats {
	return BaseStats{
		Force:    StatAtLevel(t.Base.Force, level, GrowthPerStat(t.Base.Force, t.Rarity)),
		Intel:    StatAtLevel(t.Base.Intel, level, GrowthPerStat(t.Base.Intel, t.Rarity)),
		Politics: StatAtLevel(t.Base.Politics, level, GrowthPerStat(t.Base.Politics, t.Rarity)),
		Command:  StatAtLevel(t.Base.Command, level, GrowthPerStat(t.Base.Command, t.Rarity)),
	}
}
