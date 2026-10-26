package hero

import "time"

type PersuadePlan struct {
	Record    LionizeRecord
	ItemDebit ItemCost
	Result    PersuadeHeroResult
}

// PlanPersuade captures server time once; it neither draws RNG nor touches stores.
// Caller must recheck authoritative progress under wallet/metadata serialization.
func (s *Service) PlanPersuade(p PlayerRef, city CityRef, npcCfgID int32, existing *LionizeRecord) (PersuadePlan, error) {
	target, ok := findPersuadeTarget(npcCfgID)
	if !ok {
		return PersuadePlan{}, ErrPersuadeUnknownNPC
	}
	if s == nil || p.ServerID <= 0 || p.PlayerID <= 0 {
		return PersuadePlan{}, ErrInvalidFamilyState
	}
	rec := mergeLionizeRec(existing)
	if rec.State == LionizeStateRecruited {
		return PersuadePlan{}, ErrLionizeAlreadyDone
	}
	if rec.State != LionizeStateBefriended {
		return PersuadePlan{}, ErrPersuadeNotBefriended
	}
	if rec.Friend >= LionizeHireFriendMin {
		return PersuadePlan{}, ErrPersuadeFriendSaturated
	}
	now := s.now()
	if !rec.LastPersuadeAt.IsZero() && now.Before(rec.LastPersuadeAt.Add(time.Duration(PersuadeCooldownSeconds)*time.Second)) {
		return PersuadePlan{}, ErrPersuadeCooldown
	}
	if city.CityID <= 0 {
		return PersuadePlan{}, ErrInvalidRecruit
	}
	delta := int32(PersuadeFriendDelta)
	rec.Friend += delta
	if rec.Friend > LionizeHireFriendMin {
		rec.Friend = LionizeHireFriendMin
	}
	rec.LastPersuadeAt = now
	return PersuadePlan{Record: rec, ItemDebit: ItemCost{ItemCfgID: PersuadeItemCfgID, Quantity: PersuadeItemQty},
		Result: PersuadeHeroResult{NpcCfgID: target.NpcCfgID, Friend: rec.Friend, FriendDelta: delta,
			NextPersuadeAt: now.Add(time.Duration(PersuadeCooldownSeconds) * time.Second)}}, nil
}

type LionizePlan struct {
	Record    LionizeRecord
	GoldDebit int64
	Result    LionizeHeroResult
}

// PlanLionize preserves both befriending and hire branches. The hero draft has
// ID zero until CreateHeroInTx, and cannot be published before confirmed commit.
func (s *Service) PlanLionize(p PlayerRef, city CityRef, npcCfgID int32, existing *LionizeRecord, officeLevel int32, owned []*Hero) (LionizePlan, error) {
	target, ok := findPersuadeTarget(npcCfgID)
	if !ok {
		return LionizePlan{}, ErrPersuadeUnknownNPC
	}
	if s == nil || p.ServerID <= 0 || p.PlayerID <= 0 {
		return LionizePlan{}, ErrInvalidFamilyState
	}
	if city.CityID <= 0 {
		return LionizePlan{}, ErrInvalidRecruit
	}
	rec := mergeLionizeRec(existing)
	if rec.State == LionizeStateRecruited {
		return LionizePlan{}, ErrLionizeAlreadyDone
	}
	for _, h := range owned {
		if h == nil || h.ServerID != p.ServerID || h.PlayerID != p.PlayerID {
			return LionizePlan{}, ErrInvalidFamilyState
		}
	}
	if playerOwnsTemplate(owned, target.TemplateCfgID) {
		return LionizePlan{}, ErrAlreadyOwned
	}
	if rec.State == LionizeStateBefriended && rec.Friend >= LionizeHireFriendMin {
		if err := familyCapacity(p, officeLevel, owned); err != nil {
			return LionizePlan{}, err
		}
		tpl, ok := s.Catalog[target.TemplateCfgID]
		if !ok {
			return LionizePlan{}, ErrUnknownTemplate
		}
		st := StatsAtLevel(tpl, 1)
		h := &Hero{ServerID: p.ServerID, PlayerID: p.PlayerID, TemplateCfgID: tpl.TemplateCfgID,
			DisplayName: tpl.Name, Level: 1, Loyalty: LoyaltyDefault,
			Force: st.Force, Intel: st.Intel, Politics: st.Politics, Command: st.Command,
			Status: StatusIdle, CreatedAt: s.now()}
		rec.State = LionizeStateRecruited
		return LionizePlan{Record: rec, Result: LionizeHeroResult{NpcCfgID: npcCfgID,
			Friend: rec.Friend, State: rec.State, Hero: h, Recruited: true}}, nil
	}
	if rec.State == LionizeStateBefriended {
		return LionizePlan{}, ErrInsufficientFriend
	}
	if rec.State != LionizeStateNone {
		return LionizePlan{}, ErrLionizeAlreadyFriend
	}
	gold := lionizeGoldCost(target.Level)
	rec.State, rec.Friend = LionizeStateBefriended, LionizeInitialFriend
	return LionizePlan{Record: rec, GoldDebit: gold, Result: LionizeHeroResult{NpcCfgID: npcCfgID,
		Friend: rec.Friend, State: rec.State, GoldSpent: gold, Befriended: true}}, nil
}
