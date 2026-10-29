package march

import (
	"context"
	"sync"
	"time"
)

// Hub coordinates recruit queues, march orders, and the scheduler for one game shard.
type Hub struct {
	mu         sync.Mutex
	scheduler  *Scheduler
	catalog    map[int32]UnitSpec
	cities     map[int64]*CityState
	marches    map[int64]*MarchOrder
	marchCtx   map[int64]marchRuntime
	nextMarch  int64
	onArrive   MarchArrivalHandler
	onFinished MarchFinishedHandler
	restored   bool    // one durable installation per Hub, including an empty snapshot
	restoreEv  []Event // validated restore events staged until ActivateRestore
	now        func() time.Time
}

// MarchFinishedHandler runs after a march ends (arrival without return, or return complete).
type MarchFinishedHandler func(marchID int64)

type marchRuntime struct {
	OriginCityID int64
	PlayerID     int64
	HeroID       int64
	Troops       []TroopStack
}

// NewHub wires a military queue coordinator.
func NewHub(now func() time.Time) *Hub {
	if now == nil {
		now = time.Now
	}
	return &Hub{
		scheduler: NewScheduler(now),
		catalog:   DefaultUnitCatalog(),
		cities:    make(map[int64]*CityState),
		marches:   make(map[int64]*MarchOrder),
		marchCtx:  make(map[int64]marchRuntime),
		now:       now,
	}
}

// SetMarchArrivalHandler enables EventMarchArrive battle resolution and report persistence.
func (h *Hub) SetMarchArrivalHandler(fn MarchArrivalHandler) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onArrive = fn
}

// SetMarchFinishedHandler notifies when a march lifecycle completes (troops home or stranded at target).
func (h *Hub) SetMarchFinishedHandler(fn MarchFinishedHandler) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onFinished = fn
}

// Scheduler exposes the underlying scheduler (tests).
func (h *Hub) Scheduler() *Scheduler { return h.scheduler }

// RegisterCity adds or replaces city state.
func (h *Hub) RegisterCity(c *CityState) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.Troops == nil {
		c.Troops = make(map[int32]int32)
	}
	h.cities[c.ID] = c
}

// City returns city state (read-only use; mutations go through Hub methods).
func (h *Hub) City(id int64) *CityState {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.cities[id]
}

func (h *Hub) scheduleRecruitComplete(cityID int64, job *RecruitJob) {
	h.scheduler.Schedule(Event{
		Kind:   EventRecruitComplete,
		DueAt:  job.FinishAt,
		RefID:  job.ID,
		CityID: cityID,
		Handler: func(ev Event) {
			h.onRecruitComplete(ev)
		},
	})
}

// Recruit deducts resources, enqueues training, and schedules completion.
func (h *Hub) Recruit(req RecruitRequest) (RecruitResult, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	city := h.cities[req.CityID]
	if city == nil {
		return RecruitResult{}, ErrCityNotFound
	}
	now := h.now()
	res, job, err := StartRecruit(city, h.catalog, now, req)
	if err != nil {
		return RecruitResult{}, err
	}
	if job.Status == QueueActive {
		h.scheduleRecruitComplete(req.CityID, job)
	}
	return res, nil
}

func (h *Hub) onRecruitComplete(ev Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	city := h.cities[ev.CityID]
	if city == nil {
		return
	}
	promoted, err := CompleteRecruit(city, h.catalog, ev.RefID, h.now())
	if err != nil {
		return
	}
	if promoted != nil {
		h.scheduleRecruitComplete(ev.CityID, promoted)
	}
}

// CreateMarch validates and plans before deducting ready troops and scheduling arrival.
func (h *Hub) CreateMarch(req StartMarchRequest) (*MarchOrder, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	troops, err := NormalizeMarchTroops(h.catalog, req.Troops)
	if err != nil {
		return nil, err
	}
	req.Troops = troops
	order, err := BeginMarch(h.catalog, h.now(), req)
	if err != nil {
		return nil, err
	}
	if req.OriginCityID != 0 {
		city := h.cities[req.OriginCityID]
		if city == nil {
			return nil, ErrCityNotFound
		}
		for _, st := range req.Troops {
			if city.Troops[st.UnitCfgID] < st.Count {
				return nil, ErrInsufficientTroops
			}
		}
		for _, st := range req.Troops {
			city.Troops[st.UnitCfgID] -= st.Count
		}
	}
	h.nextMarch++
	order.ID = h.nextMarch
	h.marches[order.ID] = order
	h.marchCtx[order.ID] = marchRuntime{
		OriginCityID: req.OriginCityID,
		PlayerID:     req.PlayerID,
		HeroID:       req.HeroID,
		Troops:       cloneStacks(req.Troops),
	}

	h.scheduler.Schedule(Event{
		Kind:  EventMarchArrive,
		DueAt: order.ArriveAt,
		RefID: order.ID,
		Handler: func(ev Event) {
			h.onMarchArrive(ev)
		},
	})
	return cloneMarch(order), nil
}

func (h *Hub) onMarchArrive(ev Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	o := h.marches[ev.RefID]
	if o == nil {
		return
	}
	if err := MarkArrived(o); err != nil {
		return
	}
	ctx := h.marchCtx[ev.RefID]
	scheduledReturn := false
	if h.onArrive != nil && ctx.PlayerID != 0 {
		res, err := h.onArrive(context.Background(), MarchArrivalEvent{
			MarchID:  ev.RefID,
			PlayerID: ctx.PlayerID,
			Troops:   ctx.Troops,
			Order:    *o,
		})
		if err == nil && res.BattleRan {
			o.LastReportID = res.ReportID
			ctx.Troops = cloneStacks(res.RemainingTroops)
			h.marchCtx[ev.RefID] = ctx
			if troopStackTotal(ctx.Troops) > 0 {
				now := h.now()
				if err := BeginReturn(o, now); err == nil {
					scheduledReturn = true
					h.scheduler.Schedule(Event{
						Kind:  EventMarchReturnDone,
						DueAt: o.ReturnFinishAt,
						RefID: o.ID,
						Handler: func(ev Event) {
							h.onMarchReturn(ev)
						},
					})
				}
			}
		}
	}
	if !scheduledReturn {
		h.emitMarchFinished(ev.RefID)
	}
}

// Recall starts return march (arrived → returning).
func (h *Hub) Recall(marchID int64) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	o := h.marches[marchID]
	if o == nil {
		return ErrMarchNotFound
	}
	now := h.now()
	if err := BeginReturn(o, now); err != nil {
		return err
	}
	h.scheduler.Schedule(Event{
		Kind:  EventMarchReturnDone,
		DueAt: o.ReturnFinishAt,
		RefID: o.ID,
		Handler: func(ev Event) {
			h.onMarchReturn(ev)
		},
	})
	return nil
}

func (h *Hub) onMarchReturn(ev Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	o := h.marches[ev.RefID]
	if o == nil || o.Phase != PhaseReturning {
		return
	}
	rt, ok := h.marchCtx[ev.RefID]
	if !ok || rt.OriginCityID == 0 {
		return
	}
	city := h.cities[rt.OriginCityID]
	if city == nil || city.Troops == nil {
		return
	}
	// Validate the entire credit before changing any balance or publishing returned.
	balances, ok := planReturnCredit(h.catalog, city.Troops, rt.Troops)
	if !ok {
		return
	}
	// The phase check, survivor credit and terminal publication share this lock.
	// Retain runtime troops as history; they are not additional ready troops.
	for id, count := range balances {
		city.Troops[id] = int32(count)
	}
	_ = MarkReturnComplete(o) // Returning was checked before any credit.
	h.emitMarchFinished(ev.RefID)
}

func (h *Hub) emitMarchFinished(marchID int64) {
	fn := h.onFinished
	if fn == nil {
		return
	}
	fn(marchID)
}

// March returns a copy of the march order.
func (h *Hub) March(id int64) *MarchOrder {
	h.mu.Lock()
	defer h.mu.Unlock()
	o := h.marches[id]
	if o == nil {
		return nil
	}
	return cloneMarch(o)
}

func cloneMarch(o *MarchOrder) *MarchOrder {
	if o == nil {
		return nil
	}
	c := *o
	return &c
}

func cloneStacks(in []TroopStack) []TroopStack {
	if len(in) == 0 {
		return nil
	}
	return append([]TroopStack(nil), in...)
}

func troopStackTotal(stacks []TroopStack) int32 {
	var n int32
	for _, st := range stacks {
		n += st.Count
	}
	return n
}

// RunScheduler starts background due-event processing until ctx is cancelled.
func (h *Hub) RunScheduler(ctx context.Context) {
	h.scheduler.Run(ctx, DefaultTickInterval)
}

// Tick processes due events at the current clock (for deterministic tests).
func (h *Hub) Tick() int {
	return h.scheduler.PollDue(h.now())
}
