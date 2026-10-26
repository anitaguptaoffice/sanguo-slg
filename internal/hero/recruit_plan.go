package hero

// RecruitPlan is a disposable, uncommitted draft. Debits come from the server
// catalog, not caller previews. WalletAfter/ItemsAfter are explanatory snapshots,
// never cache updates or substitutes for conditional persistent debits.
type RecruitPlan struct {
	Hero          *Hero
	ResourceDebit Resources
	ItemDebits    []ItemCost
	WalletAfter   Resources
	ItemsAfter    map[int32]int32
}

// PlanRecruit applies existing natural recruit rules without store/cache access
// or input mutation. The API supplies authenticated state freshly read in its
// wallet-locked transaction. It must debit resources/items and CreateHeroInTx in
// that same transaction, publishing the assigned identity only after Commit.
// A plan adds no capacity rule and is neither an asset reservation nor a commit.
func (s *Service) PlanRecruit(snapshot *PlayerState, req RecruitRequest) (RecruitPlan, error) {
	if snapshot == nil || snapshot.ServerID <= 0 || snapshot.PlayerID <= 0 {
		return RecruitPlan{}, ErrInvalidRecruit
	}
	ps := *snapshot
	ps.Items = cloneItems(snapshot.Items)
	ps.Heroes = make([]*Hero, len(snapshot.Heroes))
	for i, h := range snapshot.Heroes {
		if h == nil || h.ServerID != ps.ServerID || h.PlayerID != ps.PlayerID {
			return RecruitPlan{}, ErrInvalidRecruit
		}
		copy := *h
		ps.Heroes[i] = &copy
	}
	res, err := Recruit(&ps, s.Catalog, s.Items, s.random(), s.now(), req)
	if err != nil {
		return RecruitPlan{}, err
	}
	t := s.Catalog[res.Hero.TemplateCfgID]
	cost := t.RecruitItem
	if req.TemplateCfgID == 0 {
		id := req.ItemCfgID
		if id == 0 {
			id = RecruitScrollID
		}
		cost = ItemCost{ItemCfgID: id, Quantity: 1}
	}
	return RecruitPlan{
		Hero: res.Hero, ResourceDebit: t.RecruitCost, ItemDebits: []ItemCost{cost},
		WalletAfter: res.Wallet, ItemsAfter: res.Items,
	}, nil
}

func validateRecruitCost(t Template, id int32) error {
	c := t.RecruitCost
	// Natural recruitment charges four resources only. Unsupported gold cost or
	// negative/wrapped configuration must fail rather than become a free reward.
	if id <= 0 || t.TemplateCfgID != id || c.Food < 0 || c.Wood < 0 || c.Stone < 0 || c.Iron < 0 || c.Gold != 0 {
		return ErrInvalidRecruit
	}
	// Nonnegative int64 costs checked against balances before subtraction cannot
	// overflow, even at MaxInt64. No cost summing/multiplication is performed.
	return nil
}

func validRecruitItem(items map[int32]RecruitItemSpec, id int32) bool {
	spec, ok := items[id]
	return id > 0 && ok && spec.ItemCfgID == id && spec.ItemType == 3
}
