package march

import (
	"context"
	"sync"
	"time"
)

// Hub coordinates recruit queues, march orders, and the scheduler for one game shard.
type Hub struct {
	mu        sync.Mutex
	scheduler *Scheduler
	catalog   map[int32]UnitSpec
	cities    map[int64]*CityState
	marches   map[int64]*MarchOrder
	marchCtx  map[int64]marchRuntime
	nextMarch int64
	onArrive  MarchArrivalHandler
	now       func() time.Time
}

type marchRuntime struct {
	OriginCityID int64
	PlayerID     int64
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

// CreateMarch runs pending → marching and schedules arrival.
func (h *Hub) CreateMarch(req StartMarchRequest) (*MarchOrder, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
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
	now := h.now()
	order, err := BeginMarch(h.catalog, now, req)
	if err != nil {
		return nil, err
	}
	h.nextMarch++
	order.ID = h.nextMarch
	h.marches[order.ID] = order
	h.marchCtx[order.ID] = marchRuntime{
		OriginCityID: req.OriginCityID,
		PlayerID:     req.PlayerID,
		Troops:       cloneStacks(req.Troops),
	}

	h.scheduler.Schedule(Event{
		Kind:   EventMarchArrive,
		DueAt:  order.ArriveAt,
		RefID:  order.ID,
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
	_ = MarkArrived(o)
	ctx := h.marchCtx[ev.RefID]
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
					h.scheduler.Schedule(Event{
						Kind:   EventMarchReturnDone,
						DueAt:  o.ReturnFinishAt,
						RefID:  o.ID,
						Handler: func(ev Event) {
							h.onMarchReturn(ev)
						},
					})
				}
			}
		}
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
		Kind:   EventMarchReturnDone,
		DueAt:  o.ReturnFinishAt,
		RefID:  o.ID,
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
	if o == nil {
		return
	}
	rt := h.marchCtx[ev.RefID]
	if rt.OriginCityID != 0 {
		city := h.cities[rt.OriginCityID]
		if city != nil {
			for _, st := range rt.Troops {
				if st.Count > 0 {
					city.Troops[st.UnitCfgID] += st.Count
				}
			}
		}
	}
	_ = MarkReturnComplete(o)
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
