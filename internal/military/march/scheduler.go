package march

import (
	"container/heap"
	"context"
	"sync"
	"time"
)

// EventKind identifies scheduled military queue callbacks.
type EventKind int

const (
	EventRecruitComplete EventKind = 1
	EventMarchArrive     EventKind = 2
	EventMarchReturnDone EventKind = 3
)

// Event is a due callback payload.
type Event struct {
	ID      int64
	Kind    EventKind
	DueAt   time.Time
	RefID   int64 // recruit job id or march id
	CityID  int64
	Handler func(Event)
}

// DefaultTickInterval matches spec/rules params domestic.queue.tick_interval_sec.
const DefaultTickInterval = time.Second

// Scheduler fires due events with at most one tick interval of delay (< 1s by default).
type Scheduler struct {
	mu     sync.Mutex
	events eventHeap
	seq    int64
	now    func() time.Time
}

// NewScheduler builds a scheduler; now defaults to time.Now.
func NewScheduler(now func() time.Time) *Scheduler {
	if now == nil {
		now = time.Now
	}
	return &Scheduler{now: now}
}

// Schedule registers an event at dueAt (or immediately if dueAt is in the past).
func (s *Scheduler) Schedule(ev Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seq++
	ev.ID = s.seq
	heap.Push(&s.events, evItem{ev: ev})
}

// PollDue runs all handlers for events with DueAt <= now.
func (s *Scheduler) PollDue(now time.Time) int {
	s.mu.Lock()
	var due []Event
	for s.events.Len() > 0 {
		top := s.events[0]
		if top.ev.DueAt.After(now) {
			break
		}
		item := heap.Pop(&s.events).(evItem)
		due = append(due, item.ev)
	}
	s.mu.Unlock()
	for _, ev := range due {
		if ev.Handler != nil {
			ev.Handler(ev)
		}
	}
	return len(due)
}

// NextDue returns the earliest pending due time, or zero if empty.
func (s *Scheduler) NextDue() time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.events.Len() == 0 {
		return time.Time{}
	}
	return s.events[0].ev.DueAt
}

// Run loops until ctx is cancelled, waking at most every tick or when the next event is due.
func (s *Scheduler) Run(ctx context.Context, tick time.Duration) {
	if tick <= 0 {
		tick = DefaultTickInterval
	}
	for {
		if ctx.Err() != nil {
			return
		}
		now := s.now()
		s.PollDue(now)
		next := s.NextDue()
		wait := tick
		if !next.IsZero() {
			d := next.Sub(now)
			if d < wait {
				wait = d
			}
			if wait < 0 {
				wait = 0
			}
		}
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}

type evItem struct {
	ev Event
}

type eventHeap []evItem

func (h eventHeap) Len() int { return len(h) }

func (h eventHeap) Less(i, j int) bool {
	return h[i].ev.DueAt.Before(h[j].ev.DueAt)
}

func (h eventHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h *eventHeap) Push(x interface{}) {
	*h = append(*h, x.(evItem))
}

func (h *eventHeap) Pop() interface{} {
	old := *h
	n := len(old)
	item := old[n-1]
	*h = old[:n-1]
	return item
}
