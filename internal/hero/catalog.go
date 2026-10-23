package hero

func DefaultCatalog() map[int32]Template {
	scroll := ItemCost{RecruitScrollID, 1}
	cost5 := Resources{5000, 5000, 3000, 2000}
	cost4 := Resources{3000, 3000, 2000, 1000}
	raw := []Template{
		{1001, "liu_bei", "刘备", "standard", 5, BaseStats{72, 75, 88, 78}, cost5, scroll},
		{1002, "guan_yu", "关羽", "standard", 5, BaseStats{95, 62, 55, 82}, cost5, scroll},
		{1003, "zhang_fei", "张飞", "standard", 4, BaseStats{92, 45, 40, 75}, cost4, scroll},
		{1004, "zhao_yun", "赵云", "standard", 4, BaseStats{88, 70, 58, 85}, cost4, scroll},
		{1005, "huang_zhong", "黄忠", "standard", 4, BaseStats{90, 68, 52, 80}, cost4, scroll},
		{1006, "ma_chao", "马超", "standard", 4, BaseStats{91, 55, 48, 79}, cost4, scroll},
	}
	out := make(map[int32]Template, len(raw))
	for _, t := range raw {
		out[t.TemplateCfgID] = t
	}
	return out
}

func DefaultRecruitItems() map[int32]RecruitItemSpec {
	return map[int32]RecruitItemSpec{
		RecruitScrollID: {RecruitScrollID, 3, 1, "standard"},
	}
}
