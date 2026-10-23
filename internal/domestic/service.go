package domestic

import (
	"context"
	"errors"
	"math"
	"sort"
	"sync"
	"time"
)

var (
	ErrCityNotFound      = errors.New("domestic: city not found")
	ErrUnknownBuilding   = errors.New("domestic: unknown building_cfg_id")
	ErrInsufficientRes   = errors.New("domestic: insufficient resources")
	ErrJobNotFound       = errors.New("domestic: build job not found")
	ErrInvalidUpgrade    = errors.New("domestic: invalid upgrade target")
	ErrPrereqMainHall    = errors.New("domestic: building level exceeds main hall")
	ErrPrereqBarracks    = errors.New("domestic: barracks requires main hall level 2")
	ErrPrereqWall        = errors.New("domestic: wall requires main hall level 3")
	ErrPrereqMainHallLow = errors.New("domestic: main hall level below other buildings")
)

const (
	whCapBase, whCapPerLvl        = 50000, 25000
	prodBonus, costGrow, timeGrow = 0.05, 1.60, 1.50
	buildSlots                    = 1
	offlineCap                    = 24 * time.Hour
	mainHallID                    = 1
)

type QueueStatus int8

const (
	QueueWaiting QueueStatus = 0
	QueueActive  QueueStatus = 1
	QueueDone    QueueStatus = 2
)

type Resources struct{ Food, Wood, Stone, Iron int64 }

func (a *Resources) Sub(b Resources) bool {
	if a.Food < b.Food || a.Wood < b.Wood || a.Stone < b.Stone || a.Iron < b.Iron {
		return false
	}
	a.Food, a.Wood, a.Stone, a.Iron = a.Food-b.Food, a.Wood-b.Wood, a.Stone-b.Stone, a.Iron-b.Iron
	return true
}

type BuildingSpec struct {
	ID          int32
	BaseTimeSec int64
	BaseCost    Resources
	ProdPerHour int64
	ProdRes     int8 // ProdRes 0..3, ProdPerHour 0 = non-producer
}

func DefaultCatalog() map[int32]BuildingSpec {
	return map[int32]BuildingSpec{
		1: {1, 60, Resources{200, 200, 100, 50}, 0, 0},
		2: {2, 45, Resources{50, 150, 30, 0}, 120, 0},
		3: {3, 45, Resources{50, 100, 50, 0}, 100, 1},
		4: {4, 50, Resources{80, 80, 100, 0}, 80, 2},
		5: {5, 55, Resources{100, 80, 80, 50}, 60, 3},
		6: {6, 90, Resources{150, 200, 150, 100}, 0, 0},
		7: {7, 120, Resources{100, 100, 300, 150}, 0, 0},
	}
}

type BuildingInstance struct{ CfgID, Level int32 }
type BuildJob struct {
	ID            int64
	Slot          string
	CfgID, Target int32
	Status        QueueStatus
	FinishAt      time.Time
}
type CityState struct {
	ID           int64
	PlayerID     int64
	Wallet       Resources
	LastSettleAt time.Time
	Buildings    map[string]*BuildingInstance
	BuildJobs    []*BuildJob
	nextJobID    int64
}
type UpgradeResult struct {
	JobID      int64
	FinishAt   time.Time
	Wallet     Resources
	InProgress bool
}

func mainHallLvl(c *CityState) int32 {
	for _, b := range c.Buildings {
		if b.CfgID == mainHallID {
			return b.Level
		}
	}
	return 0
}

func settleProduction(c *CityState, cat map[int32]BuildingSpec, now time.Time) {
	if c.LastSettleAt.IsZero() {
		c.LastSettleAt = now
		return
	}
	el := now.Sub(c.LastSettleAt)
	if el > offlineCap {
		el = offlineCap
	}
	if el <= 0 {
		return
	}
	sec, mh := el.Seconds(), mainHallLvl(c)
	bonus := 1.0
	if mh > 1 {
		bonus = 1 + prodBonus*float64(mh-1)
	}
	cap := float64(whCapBase + whCapPerLvl*int64(mh))
	var d [4]float64
	for _, inst := range c.Buildings {
		sp, ok := cat[inst.CfgID]
		if !ok || sp.ProdPerHour < 1 || inst.Level < 1 {
			continue
		}
		oh := math.Floor(float64(sp.ProdPerHour) * float64(inst.Level) * bonus)
		d[sp.ProdRes] += oh / 3600 * sec
	}
	clamp := func(st int64, add float64) int64 {
		return int64(math.Floor(math.Min(cap, math.Max(0, float64(st)+add))))
	}
	w := c.Wallet
	w.Food, w.Wood, w.Stone, w.Iron = clamp(w.Food, d[0]), clamp(w.Wood, d[1]), clamp(w.Stone, d[2]), clamp(w.Iron, d[3])
	c.Wallet, c.LastSettleAt = w, now
}

func slotB(c *CityState, slot string) *BuildingInstance {
	if c.Buildings == nil {
		c.Buildings = make(map[string]*BuildingInstance)
	}
	return c.Buildings[slot]
}

func ValidateUpgrade(c *CityState, cat map[int32]BuildingSpec, slot string, cfgID, tgt int32) error {
	if _, ok := cat[cfgID]; !ok {
		return ErrUnknownBuilding
	}
	if tgt < 1 {
		return ErrInvalidUpgrade
	}
	inst := slotB(c, slot)
	cur := int32(0)
	if inst != nil {
		if inst.CfgID != cfgID {
			return ErrInvalidUpgrade
		}
		cur = inst.Level
	}
	if tgt != cur+1 {
		return ErrInvalidUpgrade
	}
	mh := mainHallLvl(c)
	if cfgID != mainHallID && tgt > mh {
		return ErrPrereqMainHall
	}
	if cfgID == 6 && tgt == 1 && mh < 2 {
		return ErrPrereqBarracks
	}
	if cfgID == 7 && tgt == 1 && mh < 3 {
		return ErrPrereqWall
	}
	if cfgID == mainHallID {
		for _, b := range c.Buildings {
			if b.CfgID != mainHallID && b.Level > tgt {
				return ErrPrereqMainHallLow
			}
		}
	}
	return nil
}

func upCost(sp BuildingSpec, lvl int32) Resources {
	e := math.Pow(costGrow, float64(lvl-1))
	s := func(v int64) int64 { return int64(math.Floor(float64(v) * e)) }
	c := sp.BaseCost
	return Resources{s(c.Food), s(c.Wood), s(c.Stone), s(c.Iron)}
}
func upDur(sp BuildingSpec, lvl int32) time.Duration {
	sec := int64(math.Floor(float64(sp.BaseTimeSec) * math.Pow(timeGrow, float64(lvl-1))))
	return time.Duration(sec) * time.Second
}

func startUpgrade(c *CityState, cat map[int32]BuildingSpec, now time.Time, slot string, cfgID int32) (UpgradeResult, *BuildJob, error) {
	sp, ok := cat[cfgID]
	if !ok {
		return UpgradeResult{}, nil, ErrUnknownBuilding
	}
	inst := slotB(c, slot)
	tgt := int32(1)
	if inst != nil {
		tgt = inst.Level + 1
	}
	if err := ValidateUpgrade(c, cat, slot, cfgID, tgt); err != nil {
		return UpgradeResult{}, nil, err
	}
	cost := upCost(sp, tgt)
	w := c.Wallet
	if !w.Sub(cost) {
		return UpgradeResult{}, nil, ErrInsufficientRes
	}
	c.Wallet = w
	c.nextJobID++
	job := &BuildJob{ID: c.nextJobID, Slot: slot, CfgID: cfgID, Target: tgt, Status: QueueWaiting}
	dur := upDur(sp, tgt)
	active, last := 0, time.Time{}
	for _, j := range c.BuildJobs {
		if j.Status == QueueActive {
			active++
		}
		if (j.Status == QueueWaiting || j.Status == QueueActive) && j.FinishAt.After(last) {
			last = j.FinishAt
		}
	}
	if active < buildSlots {
		job.Status = QueueActive
		job.FinishAt = now.Add(dur)
	} else {
		if last.Before(now) {
			last = now
		}
		job.FinishAt = last.Add(dur)
	}
	c.BuildJobs = append(c.BuildJobs, job)
	return UpgradeResult{job.ID, job.FinishAt, c.Wallet, job.Status == QueueActive}, job, nil
}

func completeBuild(c *CityState, cat map[int32]BuildingSpec, jobID int64, now time.Time) (*BuildJob, error) {
	var job *BuildJob
	for _, j := range c.BuildJobs {
		if j.ID == jobID {
			job = j
			break
		}
	}
	if job == nil {
		return nil, ErrJobNotFound
	}
	if job.Status != QueueActive {
		return nil, ErrInvalidUpgrade
	}
	job.Status = QueueDone
	inst := slotB(c, job.Slot)
	if inst == nil {
		inst = &BuildingInstance{job.CfgID, 0}
		c.Buildings[job.Slot] = inst
	}
	inst.Level = job.Target
	active := 0
	for _, j := range c.BuildJobs {
		if j.Status == QueueActive {
			active++
		}
	}
	if active >= buildSlots {
		return nil, nil
	}
	for _, j := range c.BuildJobs {
		if j.Status != QueueWaiting {
			continue
		}
		sp, ok := cat[j.CfgID]
		if !ok {
			continue
		}
		j.Status = QueueActive
		j.FinishAt = now.Add(upDur(sp, j.Target))
		return j, nil
	}
	return nil, nil
}

type schedEvent struct {
	due time.Time
	fn  func()
}
type scheduler struct {
	mu sync.Mutex
	q  []schedEvent
}

func (s *scheduler) add(due time.Time, fn func()) {
	s.mu.Lock()
	s.q = append(s.q, schedEvent{due, fn})
	sort.Slice(s.q, func(i, j int) bool { return s.q[i].due.Before(s.q[j].due) })
	s.mu.Unlock()
}
func (s *scheduler) poll(now time.Time) int {
	s.mu.Lock()
	var run []func()
	for len(s.q) > 0 && !s.q[0].due.After(now) {
		run = append(run, s.q[0].fn)
		s.q = s.q[1:]
	}
	s.mu.Unlock()
	for _, fn := range run {
		fn()
	}
	return len(run)
}

type Hub struct {
	mu         sync.Mutex
	sched      scheduler
	cat        map[int32]BuildingSpec
	cities     map[int64]*CityState
	now        func() time.Time
	store      *PGStore
	serverID   int32
	flushEvery time.Duration
	lastFlush  time.Time
}

func NewHub(now func() time.Time) *Hub {
	if now == nil {
		now = time.Now
	}
	return &Hub{cat: DefaultCatalog(), cities: make(map[int64]*CityState), now: now}
}

// UseStore enables PostgreSQL snapshots (optional). flushEvery<=0 defaults to 30s.
func (h *Hub) UseStore(store *PGStore, serverID int32, flushEvery time.Duration) {
	h.store = store
	h.serverID = serverID
	if flushEvery <= 0 {
		flushEvery = 30 * time.Second
	}
	h.flushEvery = flushEvery
}

func (h *Hub) RegisterCity(c *CityState) {
	h.mu.Lock()
	h.registerCityLocked(c)
	h.mu.Unlock()
	h.persistCity(c.ID)
}

func (h *Hub) registerCityLocked(c *CityState) {
	if c.Buildings == nil {
		c.Buildings = make(map[string]*BuildingInstance)
	}
	if c.LastSettleAt.IsZero() {
		c.LastSettleAt = h.now()
	}
	h.cities[c.ID] = c
	h.rescheduleJobsLocked(c.ID, c)
}

// LoadCity loads state from PG and registers the city (re-schedules active build jobs).
func (h *Hub) LoadCity(ctx context.Context, cityID, playerID int64) (*CityState, error) {
	if h.store == nil {
		return nil, errors.New("domestic: persistence not configured")
	}
	c, err := h.store.LoadCity(ctx, h.serverID, cityID, playerID)
	if err != nil {
		return nil, err
	}
	h.mu.Lock()
	h.registerCityLocked(c)
	h.mu.Unlock()
	return c, nil
}

func (h *Hub) rescheduleJobsLocked(cityID int64, c *CityState) {
	for _, j := range c.BuildJobs {
		if j.Status == QueueActive {
			h.sched.add(j.FinishAt, func() { h.onDone(cityID, j.ID) })
		}
	}
}

func (h *Hub) persistCity(cityID int64) {
	if h.store == nil {
		return
	}
	h.mu.Lock()
	c := h.cities[cityID]
	if c == nil || c.PlayerID == 0 {
		h.mu.Unlock()
		return
	}
	now := h.now()
	settleProduction(c, h.cat, now)
	h.mu.Unlock()
	_ = h.store.SaveCity(context.Background(), h.serverID, c, h.cat, now)
}

func (h *Hub) maybeFlushAll() {
	if h.store == nil || h.flushEvery <= 0 {
		return
	}
	now := h.now()
	if !h.lastFlush.IsZero() && now.Sub(h.lastFlush) < h.flushEvery {
		return
	}
	h.lastFlush = now
	h.mu.Lock()
	ids := make([]int64, 0, len(h.cities))
	for id, c := range h.cities {
		if c.PlayerID != 0 {
			ids = append(ids, id)
		}
	}
	h.mu.Unlock()
	for _, id := range ids {
		h.persistCity(id)
	}
}
func (h *Hub) onDone(cityID, jobID int64) {
	h.mu.Lock()
	city := h.cities[cityID]
	if city == nil {
		h.mu.Unlock()
		return
	}
	now := h.now()
	settleProduction(city, h.cat, now)
	next, _ := completeBuild(city, h.cat, jobID, now)
	h.mu.Unlock()
	if next != nil {
		h.sched.add(next.FinishAt, func() { h.onDone(cityID, next.ID) })
	}
	h.persistCity(cityID)
}
func (h *Hub) StartBuildingUpgrade(cityID int64, slot string, cfgID int32) (UpgradeResult, error) {
	h.mu.Lock()
	city := h.cities[cityID]
	if city == nil {
		h.mu.Unlock()
		return UpgradeResult{}, ErrCityNotFound
	}
	now := h.now()
	settleProduction(city, h.cat, now)
	res, job, err := startUpgrade(city, h.cat, now, slot, cfgID)
	h.mu.Unlock()
	if err != nil {
		return UpgradeResult{}, err
	}
	if job.Status == QueueActive {
		h.sched.add(job.FinishAt, func() { h.onDone(cityID, job.ID) })
	}
	return res, nil
}
func (h *Hub) Tick() int {
	n := h.sched.poll(h.now())
	h.maybeFlushAll()
	return n
}
