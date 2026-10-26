package hero

import "time"

// HotelPoolPlan is disposable and not a reservation. Positive CandidateIDs are
// retained persisted rows; zero IDs are generated drafts requiring allocation
// in the caller's transaction. Do not reuse drafts after rollback/unknown commit.
type HotelPoolPlan struct {
	Candidates []*HotelCandidate
	Replace    bool
	SaveTick   bool
	Tick       time.Time
	ItemDebit  ItemCost // Refresh only; never a client-supplied price.
}

// PlanHotelSync reads no stores and does not mutate the supplied snapshot. The
// coordinator supplies authenticated scope and persisted levels/rows/tick after
// locking wallet/city/candidates; the server clock is captured once here.
func (s *Service) PlanHotelSync(serverID int32, city CityRef, hotelLevel int32, rows []*HotelCandidate, last time.Time) (HotelPoolPlan, error) {
	if err := validateHotelPlanning(s, serverID, city, hotelLevel); err != nil {
		return HotelPoolPlan{}, err
	}
	copy, err := copyHotelSnapshot(serverID, city.CityID, rows)
	if err != nil {
		return HotelPoolPlan{}, err
	}
	now := s.now()
	block := poolBlockSeconds(hotelLevel)
	delta := (now.Unix()+8*3600)/block - (last.Unix()+8*3600)/block
	plan := HotelPoolPlan{Candidates: copy}
	if delta > 0 {
		remove := len(copy)
		if delta < int64(remove) {
			remove = int(delta)
		}
		plan.Candidates = copy[remove:]
		plan.Replace, plan.SaveTick, plan.Tick = true, true, now
	}
	if len(plan.Candidates) < int(hotelLevel) {
		plan.Replace = true
		plan.Candidates = s.fillHotelDrafts(plan.Candidates, serverID, city.CityID, hotelLevel, now)
	}
	return plan, nil
}

// PlanHotelRefresh preserves the existing refresh item and generator formulas.
// Debit occurs through CONTENT in the caller tx before candidate locks/writes.
func (s *Service) PlanHotelRefresh(serverID int32, city CityRef, hotelLevel int32) (HotelPoolPlan, error) {
	if err := validateHotelPlanning(s, serverID, city, hotelLevel); err != nil {
		return HotelPoolPlan{}, err
	}
	now := s.now()
	return HotelPoolPlan{
		Candidates: s.fillHotelDrafts(nil, serverID, city.CityID, hotelLevel, now),
		Replace:    true, SaveTick: true, Tick: now,
		ItemDebit: ItemCost{ItemCfgID: HotelRefreshItemCfgID, Quantity: 1},
	}, nil
}

func validateHotelPlanning(s *Service, serverID int32, city CityRef, level int32) error {
	if s == nil || serverID <= 0 || city.CityID <= 0 {
		return ErrInvalidHotelState
	}
	if level <= 0 {
		return ErrHotelNotBuilt
	}
	if poolBlockSeconds(level) <= 0 {
		return ErrInvalidHotelState
	}
	return nil
}

func copyHotelSnapshot(serverID int32, cityID int64, rows []*HotelCandidate) ([]*HotelCandidate, error) {
	copy := make([]*HotelCandidate, len(rows))
	seen := make(map[int64]bool, len(rows))
	for i, c := range rows {
		if c == nil || c.ServerID != serverID || c.CityID != cityID || c.CandidateID <= 0 || c.GoldCost < 0 || seen[c.CandidateID] {
			return nil, ErrInvalidHotelState
		}
		seen[c.CandidateID] = true
		value := *c
		copy[i] = &value
	}
	sortHotelCandidates(copy)
	return copy, nil
}

func (s *Service) fillHotelDrafts(rows []*HotelCandidate, serverID int32, cityID int64, level int32, now time.Time) []*HotelCandidate {
	for len(rows) < int(level) {
		c := GenerateHotelCandidate(s.random(), cityID, level, 0, now)
		c.ServerID = serverID
		rows = append(rows, c)
	}
	return rows
}

// HotelRecruitPlan contains the exact persisted price and a zero-ID hero draft.
// The caller must conditionally debit gold, consume the candidate exactly once,
// CreateHeroInTx and commit together. No wallet or candidate is mutated here.
type HotelRecruitPlan struct {
	Hero        *Hero
	CandidateID int64
	GoldDebit   int64
}

// PlanHotelRecruit deliberately does not sync, expire, refill or change a tick.
// Owned rows are the player's cross-city tx snapshot, not a client count.
func (s *Service) PlanHotelRecruit(p PlayerRef, city CityRef, hotelLevel, officeLevel int32, owned []*Hero, candidateID int64, candidate *HotelCandidate) (HotelRecruitPlan, error) {
	if err := validateHotelPlanning(s, p.ServerID, city, hotelLevel); err != nil {
		return HotelRecruitPlan{}, err
	}
	if p.PlayerID <= 0 || candidateID <= 0 {
		return HotelRecruitPlan{}, ErrInvalidHotelState
	}
	for _, h := range owned {
		if h == nil || h.ServerID != p.ServerID || h.PlayerID != p.PlayerID {
			return HotelRecruitPlan{}, ErrInvalidHotelState
		}
	}
	if !HasHeroCapacity(officeLevel, CountOwnedHeroes(owned)) {
		return HotelRecruitPlan{}, ErrHotelCapacityFull
	}
	if candidate == nil {
		return HotelRecruitPlan{}, ErrHotelCandidateMissing
	}
	if candidate.ServerID != p.ServerID || candidate.CityID != city.CityID || candidate.CandidateID != candidateID || candidate.GoldCost < 0 {
		return HotelRecruitPlan{}, ErrInvalidHotelState
	}
	return HotelRecruitPlan{
		CandidateID: candidateID, GoldDebit: candidate.GoldCost,
		Hero: &Hero{
			ServerID: p.ServerID, PlayerID: p.PlayerID,
			TemplateCfgID: TemplateCfgIDHotelRandom, DisplayName: candidate.DisplayName,
			Level: candidate.Level, Loyalty: candidate.Loyalty,
			Force: candidate.Force, Intel: candidate.Intel, Politics: candidate.Politics, Command: candidate.Command,
			Status: StatusIdle, CreatedAt: s.now(),
		},
	}, nil
}
