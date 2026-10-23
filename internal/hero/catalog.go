package hero

func DefaultRecruitItems() map[int32]RecruitItemSpec {
	return map[int32]RecruitItemSpec{
		RecruitScrollID: {RecruitScrollID, 3, 1, "standard"},
	}
}
