package hero

import (
	"context"
	"errors"
	"math/rand"
	"time"
)

// Legacy ID_BUILDING_HOTEL=10 → M1 cfg id (see spec/rules/legacy_alignment.md).
const BuildingCfgHotel = 8

// Legacy ID_BUILDING_OFFICE=11 招贤馆 → M1 官府容量闸。
const BuildingCfgHeroOffice = 1

// TemplateCfgIDHotelRandom marks客栈池招募实例（非 DATA-002 模板）。
const TemplateCfgIDHotelRandom = 0

// HotelRefreshItemCfgID is M1 stand-in for legacy 招贤令 (gid 141).
const HotelRefreshItemCfgID = 2004

const hotelLoyaltyDefault = 70

var (
	ErrHotelNotBuilt       = errors.New("hero: hotel not built")
	ErrHotelCandidateMissing = errors.New("hero: hotel candidate not found")
	ErrHotelCapacityFull   = errors.New("hero: hero capacity full (office level)")
	ErrInsufficientGold    = errors.New("hero: insufficient gold")
)

// HotelCandidate is one row in the per-city recruit pool.
type HotelCandidate struct {
	CandidateID int64
	CityID      int64
	DisplayName string
	Sex         int16
	FaceID      int32
	Level       int32
	Force       int32
	Intel       int32
	Politics    int32
	Command     int32
	Loyalty     int
	GoldCost    int64
	GeneratedAt time.Time
}

// HotelCityPort reads building levels and commits gold/item spends for hotel flows.
type HotelCityPort interface {
	HotelLevel(ctx context.Context, serverID int32, cityID int64) (int32, error)
	OfficeLevel(ctx context.Context, serverID int32, cityID int64) (int32, error)
	SpendGold(ctx context.Context, p PlayerRef, amount int64) error
	SpendItem(ctx context.Context, p PlayerRef, itemCfgID int32, qty int32) error
}

// HotelStore persists pool rows and schedule ticks.
type HotelStore interface {
	ListCandidates(ctx context.Context, serverID int32, cityID int64) ([]*HotelCandidate, error)
	ReplaceCandidates(ctx context.Context, serverID int32, cityID int64, rows []*HotelCandidate) error
	DeleteCandidate(ctx context.Context, serverID int32, cityID int64, candidateID int64) error
	LastPoolTick(ctx context.Context, serverID int32, cityID int64) (time.Time, error)
	SetLastPoolTick(ctx context.Context, serverID int32, cityID int64, at time.Time) error
	NextCandidateID(ctx context.Context, serverID int32, cityID int64) (int64, error)
}

// HasHeroCapacity implements legacy cityHasHeroPosition (office level > owned hero count).
func HasHeroCapacity(officeLevel int32, ownedHeroes int) bool {
	if officeLevel <= 0 {
		return false
	}
	return officeLevel > int32(ownedHeroes)
}

func hotelMaxLevel(hotelLevel int32) int32 {
	if hotelLevel < 1 {
		return 0
	}
	cap := hotelLevel * 5
	if cap > MaxLevelM1 {
		cap = MaxLevelM1
	}
	return cap
}

func rollHotelHeroLevel(rng *rand.Rand, hotelLevel int32) int32 {
	maxL := hotelMaxLevel(hotelLevel)
	if maxL < 1 {
		return 1
	}
	if hotelLevel < 11 {
		return int32(rng.Intn(int(maxL)) + 1)
	}
	if rng.Intn(2) == 0 {
		high := int32(rng.Intn(11) + 40) // 40-50
		if high > MaxLevelM1 {
			high = MaxLevelM1
		}
		return high
	}
	return int32(rng.Intn(39) + 1)
}

func goldNeedForHotelHero(level int32, force, intel, politics int32) int64 {
	over := func(sum int32) int64 {
		if sum <= 90 {
			return 0
		}
		return int64(sum-90)
	}
	bonus := over(force) + over(intel) + over(politics)
	return int64(level)*20*50 + bonus*50*50
}

var hotelFamilyNames = []string{"赵", "钱", "孙", "李", "周", "吴", "郑", "王", "冯", "陈", "褚", "卫", "蒋", "沈", "韩", "杨"}
var hotelGivenNames = []string{"武", "文", "德", "义", "忠", "信", "平", "安", "成", "远", "亮", "雄", "勇", "谋", "策", "云"}

func randomHotelName(rng *rand.Rand, sex int16) string {
	f := hotelFamilyNames[rng.Intn(len(hotelFamilyNames))]
	g := hotelGivenNames[rng.Intn(len(hotelGivenNames))]
	if sex == 0 {
		return f + "氏"
	}
	return f + g
}

// GenerateHotelCandidate rolls one recruit row (legacy generateRecruitHero subset).
func GenerateHotelCandidate(rng *rand.Rand, cityID int64, hotelLevel int32, candidateID int64, now time.Time) *HotelCandidate {
	sex := int16(1)
	if rng.Intn(10) == 0 {
		sex = 0
	}
	face := int32(1001 + rng.Intn(70))
	if sex == 0 {
		face = int32(100 + rng.Intn(46))
	}
	hlevel := rollHotelHeroLevel(rng, hotelLevel)
	affR := int32(rng.Intn(601) + 300)
	braR := int32(rng.Intn(601) + 300)
	wisR := int32(rng.Intn(601) + 300)
	allR := affR + braR + wisR
	allBase := int32(rng.Intn(121) + 50)
	politicsBase := allBase * affR / allR
	forceBase := allBase * braR / allR
	intelBase := allBase - politicsBase - forceBase
	politicsAdd := hlevel * affR / allR
	forceAdd := hlevel * braR / allR
	intelAdd := hlevel - politicsAdd - forceAdd
	force := forceBase + forceAdd
	intel := intelBase + intelAdd
	politics := politicsBase + politicsAdd
	return &HotelCandidate{
		CandidateID: candidateID, CityID: cityID,
		DisplayName: randomHotelName(rng, sex), Sex: sex, FaceID: face, Level: hlevel,
		Force: force, Intel: intel, Politics: politics, Command: 0,
		Loyalty: hotelLoyaltyDefault,
		GoldCost: goldNeedForHotelHero(hlevel, force, intel, politics),
		GeneratedAt: now,
	}
}

func poolBlockSeconds(hotelLevel int32) int64 {
	if hotelLevel <= 0 {
		return 3600
	}
	// legacy: (10800/GAME_SPEED_RATE)/level ; M1 GAME_SPEED_RATE=1
	return 10800 / int64(hotelLevel)
}

// ListHotelCandidates syncs the pool then returns rows.
func (s *Service) ListHotelCandidates(ctx context.Context, p PlayerRef, city CityRef, hs HotelStore, cityPort HotelCityPort) ([]*HotelCandidate, error) {
	if hs == nil || cityPort == nil {
		return nil, errors.New("hero: hotel dependencies missing")
	}
	hotelLevel, err := cityPort.HotelLevel(ctx, p.ServerID, city.CityID)
	if err != nil {
		return nil, err
	}
	if hotelLevel <= 0 {
		return nil, ErrHotelNotBuilt
	}
	rng := s.RNG
	if rng == nil {
		rng = rand.New(rand.NewSource(1))
	}
	if err := SyncHotelPool(ctx, hs, rng, p.ServerID, city.CityID, hotelLevel, s.now()); err != nil {
		return nil, err
	}
	return hs.ListCandidates(ctx, p.ServerID, city.CityID)
}

// RefreshHotelPoolPaid spends refresh item then regenerates pool.
func (s *Service) RefreshHotelPoolPaid(ctx context.Context, p PlayerRef, city CityRef, hs HotelStore, cityPort HotelCityPort) error {
	if hs == nil || cityPort == nil {
		return errors.New("hero: hotel dependencies missing")
	}
	hotelLevel, err := cityPort.HotelLevel(ctx, p.ServerID, city.CityID)
	if err != nil {
		return err
	}
	if hotelLevel <= 0 {
		return ErrHotelNotBuilt
	}
	if err := cityPort.SpendItem(ctx, p, HotelRefreshItemCfgID, 1); err != nil {
		return err
	}
	rng := s.RNG
	if rng == nil {
		rng = rand.New(rand.NewSource(1))
	}
	return RefreshHotelPool(ctx, hs, rng, p.ServerID, city.CityID, hotelLevel, s.now())
}

// SyncHotelPool applies timed eviction and fills pool to hotel level.
func SyncHotelPool(ctx context.Context, hs HotelStore, rng *rand.Rand, serverID int32, cityID int64, hotelLevel int32, now time.Time) error {
	if hotelLevel <= 0 {
		return ErrHotelNotBuilt
	}
	rows, err := hs.ListCandidates(ctx, serverID, cityID)
	if err != nil {
		return err
	}
	last, err := hs.LastPoolTick(ctx, serverID, cityID)
	if err != nil {
		return err
	}
	block := poolBlockSeconds(hotelLevel)
	lastBlock := (last.Unix() + 8*3600) / block
	currBlock := (now.Unix() + 8*3600) / block
	delta := currBlock - lastBlock
	if delta > 0 {
		remove := int(delta)
		if remove > len(rows) {
			remove = len(rows)
		}
		rows = rows[remove:]
		for len(rows) < int(hotelLevel) {
			id, err := hs.NextCandidateID(ctx, serverID, cityID)
			if err != nil {
				return err
			}
			rows = append(rows, GenerateHotelCandidate(rng, cityID, hotelLevel, id, now))
		}
		if err := hs.ReplaceCandidates(ctx, serverID, cityID, rows); err != nil {
			return err
		}
		if err := hs.SetLastPoolTick(ctx, serverID, cityID, now); err != nil {
			return err
		}
		return nil
	}
	if len(rows) < int(hotelLevel) {
		for len(rows) < int(hotelLevel) {
			id, err := hs.NextCandidateID(ctx, serverID, cityID)
			if err != nil {
				return err
			}
			rows = append(rows, GenerateHotelCandidate(rng, cityID, hotelLevel, id, now))
		}
		return hs.ReplaceCandidates(ctx, serverID, cityID, rows)
	}
	return nil
}

// RefreshHotelPool wipes and regenerates pool (legacy resetRecruitHero / regenerateRecruitHero).
func RefreshHotelPool(ctx context.Context, hs HotelStore, rng *rand.Rand, serverID int32, cityID int64, hotelLevel int32, now time.Time) error {
	if hotelLevel <= 0 {
		return ErrHotelNotBuilt
	}
	rows := make([]*HotelCandidate, 0, hotelLevel)
	for i := 0; i < int(hotelLevel); i++ {
		id, err := hs.NextCandidateID(ctx, serverID, cityID)
		if err != nil {
			return err
		}
		rows = append(rows, GenerateHotelCandidate(rng, cityID, hotelLevel, id, now))
	}
	if err := hs.ReplaceCandidates(ctx, serverID, cityID, rows); err != nil {
		return err
	}
	return hs.SetLastPoolTick(ctx, serverID, cityID, now)
}

type RecruitHotelResult struct {
	Hero *Hero
}

// RecruitHotelCandidate pays gold and copies candidate into player_hero.
func (s *Service) RecruitHotelCandidate(ctx context.Context, p PlayerRef, city CityRef, hs HotelStore, cityPort HotelCityPort, candidateID int64) (RecruitHotelResult, error) {
	if hs == nil || cityPort == nil {
		return RecruitHotelResult{}, errors.New("hero: hotel dependencies missing")
	}
	hotelLevel, err := cityPort.HotelLevel(ctx, p.ServerID, city.CityID)
	if err != nil {
		return RecruitHotelResult{}, err
	}
	if hotelLevel <= 0 {
		return RecruitHotelResult{}, ErrHotelNotBuilt
	}
	officeLevel, err := cityPort.OfficeLevel(ctx, p.ServerID, city.CityID)
	if err != nil {
		return RecruitHotelResult{}, err
	}
	heroes, err := s.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return RecruitHotelResult{}, err
	}
	if !HasHeroCapacity(officeLevel, len(heroes)) {
		return RecruitHotelResult{}, ErrHotelCapacityFull
	}
	rows, err := hs.ListCandidates(ctx, p.ServerID, city.CityID)
	if err != nil {
		return RecruitHotelResult{}, err
	}
	var cand *HotelCandidate
	for _, r := range rows {
		if r.CandidateID == candidateID {
			cand = r
			break
		}
	}
	if cand == nil {
		return RecruitHotelResult{}, ErrHotelCandidateMissing
	}
	if err := cityPort.SpendGold(ctx, p, cand.GoldCost); err != nil {
		if errors.Is(err, ErrInsufficientGold) {
			return RecruitHotelResult{}, ErrInsufficientGold
		}
		return RecruitHotelResult{}, err
	}
	maxID, err := s.Store.MaxHeroID(ctx, p.ServerID)
	if err != nil {
		return RecruitHotelResult{}, err
	}
	now := s.now()
	h := &Hero{
		ServerID: p.ServerID, HeroID: maxID + 1, PlayerID: p.PlayerID,
		TemplateCfgID: TemplateCfgIDHotelRandom, DisplayName: cand.DisplayName,
		Level: cand.Level, Loyalty: cand.Loyalty,
		Force: cand.Force, Intel: cand.Intel, Politics: cand.Politics, Command: cand.Command,
		Status: StatusIdle, CreatedAt: now,
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return RecruitHotelResult{}, err
	}
	if err := hs.DeleteCandidate(ctx, p.ServerID, city.CityID, candidateID); err != nil {
		return RecruitHotelResult{}, err
	}
	return RecruitHotelResult{Hero: h}, nil
}

// CityRef identifies a city on a shard.
type CityRef struct {
	CityID int64
}
