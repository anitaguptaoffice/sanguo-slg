package rank

import (
	"context"
	"sync"
	"time"
)

// Scheduler periodically refreshes configured leaderboard types per server_id.
type Scheduler struct {
	svc      *Service
	interval time.Duration
	now      func() time.Time

	mu        sync.Mutex
	serverIDs []int32
	types     []RankType
}

// NewScheduler builds a refresher; interval defaults to DefaultRefreshInterval.
func NewScheduler(svc *Service, interval time.Duration) *Scheduler {
	if interval <= 0 {
		interval = DefaultRefreshInterval
	}
	return &Scheduler{
		svc:      svc,
		interval: interval,
		now:      time.Now,
	}
}

// Configure sets which servers and rank types to refresh on each tick.
func (sch *Scheduler) Configure(serverIDs []int32, types []RankType) {
	sch.mu.Lock()
	sch.serverIDs = append([]int32(nil), serverIDs...)
	sch.types = append([]RankType(nil), types...)
	sch.mu.Unlock()
}

// Tick runs one refresh pass (for tests and manual triggers).
func (sch *Scheduler) Tick(ctx context.Context) error {
	sch.mu.Lock()
	servers := append([]int32(nil), sch.serverIDs...)
	types := append([]RankType(nil), sch.types...)
	sch.mu.Unlock()
	var firstErr error
	for _, sid := range servers {
		for _, rt := range types {
			if _, err := sch.svc.Refresh(ctx, sid, rt); err != nil && firstErr == nil {
				firstErr = err
			}
		}
	}
	return firstErr
}

// Run loops until ctx is cancelled, refreshing every interval.
func (sch *Scheduler) Run(ctx context.Context) {
	ticker := time.NewTicker(sch.interval)
	defer ticker.Stop()
	for {
		_ = sch.Tick(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
