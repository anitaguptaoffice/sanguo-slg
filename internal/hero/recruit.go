package hero

import (
	"context"
	"math/rand"
	"time"
)

type RecruitRequest struct {
	TemplateCfgID int32
	ItemCfgID     int32
	Pool          string
}

type RecruitResult struct {
	Hero   *Hero
	Wallet Resources
	Items  map[int32]int32
}

type Service struct {
	Catalog      map[int32]Template
	Items        map[int32]RecruitItemSpec
	Store        Store
	CaptiveStore CaptiveStore
	HotelStore   HotelStore
	levels       *LevelTable
	RNG          *rand.Rand
	clock        func() time.Time
}

func NewService() *Service {
	levels, _ := DefaultLevelTable()
	return &Service{
		Catalog: DefaultCatalog(), Items: DefaultRecruitItems(),
		Store: NewMemStore(), CaptiveStore: NewMemCaptiveStore(), levels: levels,
		RNG: rand.New(rand.NewSource(1)), clock: time.Now,
	}
}

// UseLevelTable overrides the embedded cfg_hero_level table (tests).
func (s *Service) UseLevelTable(t *LevelTable) {
	s.levels = t
}

func (s *Service) now() time.Time {
	if s.clock != nil {
		return s.clock()
	}
	return time.Now()
}

// SetClock overrides time for tests.
func (s *Service) SetClock(fn func() time.Time) {
	if fn != nil {
		s.clock = fn
	}
}

// UseStore switches persistence to PostgreSQL (MemStore when nil).
func (s *Service) UseStore(store Store) {
	if store != nil {
		s.Store = store
	}
}

func (s *Service) RecruitAndPersist(ctx context.Context, ps *PlayerState, req RecruitRequest) (RecruitResult, error) {
	res, err := Recruit(ps, s.Catalog, s.Items, s.RNG, time.Now(), req)
	if err != nil {
		return RecruitResult{}, err
	}
	return res, s.Store.SaveHero(ctx, res.Hero)
}

func (s *Service) SetHeroLoyalty(ctx context.Context, h *Hero, v int) error {
	h.SetLoyalty(v)
	return s.Store.SaveHero(ctx, h)
}

func ownsTemplate(ps *PlayerState, id int32) bool {
	for _, h := range ps.Heroes {
		if h.TemplateCfgID == id {
			return true
		}
	}
	return false
}

func deductItem(ps *PlayerState, id, qty int32) error {
	if qty <= 0 {
		return ErrInvalidRecruit
	}
	if ps.Items[id] < qty {
		return ErrInsufficientItem
	}
	ps.Items[id] -= qty
	return nil
}

func spawnHero(ps *PlayerState, t Template, now time.Time) *Hero {
	ps.nextHeroID++
	st := StatsAtLevel(t, 1)
	h := &Hero{
		ServerID: ps.ServerID, HeroID: ps.nextHeroID, PlayerID: ps.PlayerID,
		TemplateCfgID: t.TemplateCfgID, Level: 1, Loyalty: LoyaltyDefault,
		Force: st.Force, Intel: st.Intel, Politics: st.Politics, Command: st.Command,
		Status: StatusIdle, CreatedAt: now,
	}
	ps.Heroes = append(ps.Heroes, h)
	return h
}

func Recruit(ps *PlayerState, cat map[int32]Template, items map[int32]RecruitItemSpec, rng *rand.Rand, now time.Time, req RecruitRequest) (RecruitResult, error) {
	if ps.Items == nil {
		ps.Items = map[int32]int32{}
	}
	if req.TemplateCfgID > 0 {
		t, ok := cat[req.TemplateCfgID]
		if !ok {
			return RecruitResult{}, ErrUnknownTemplate
		}
		if ownsTemplate(ps, t.TemplateCfgID) {
			return RecruitResult{}, ErrAlreadyOwned
		}
		w := ps.Wallet
		if !w.Sub(t.RecruitCost) {
			return RecruitResult{}, ErrInsufficientRes
		}
		if err := deductItem(ps, t.RecruitItem.ItemCfgID, t.RecruitItem.Quantity); err != nil {
			ps.Wallet = w
			return RecruitResult{}, err
		}
		ps.Wallet = w
		h := spawnHero(ps, t, now)
		return RecruitResult{h, ps.Wallet, ps.Items}, nil
	}
	itemID := req.ItemCfgID
	if itemID == 0 {
		itemID = RecruitScrollID
	}
	spec, ok := items[itemID]
	if !ok || spec.ItemType != 3 {
		return RecruitResult{}, ErrRecruitItemType
	}
	pool := req.Pool
	if pool == "" {
		pool = spec.HeroPool
	}
	var cands []int32
	for id, t := range cat {
		if t.Pool == pool && !ownsTemplate(ps, id) {
			cands = append(cands, id)
		}
	}
	if len(cands) == 0 {
		return RecruitResult{}, ErrEmptyPool
	}
	t := cat[cands[rng.Intn(len(cands))]]
	if ps.Items[itemID] < 1 {
		return RecruitResult{}, ErrInsufficientItem
	}
	if !ps.Wallet.Sub(t.RecruitCost) {
		return RecruitResult{}, ErrInsufficientRes
	}
	if err := deductItem(ps, itemID, 1); err != nil {
		return RecruitResult{}, err
	}
	h := spawnHero(ps, t, now)
	return RecruitResult{h, ps.Wallet, ps.Items}, nil
}
