package content

import (
	"context"
	"time"
)

// Poll the existing mutex rather than leaving a goroutine that can acquire it
// after the request returns. Other Service operations keep their current locks.
func (s *Service) lockGrantContext(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if ctx.Done() == nil {
		s.mu.Lock()
		return nil
	}
	tick := time.NewTicker(time.Millisecond)
	defer tick.Stop()
	for {
		if s.mu.TryLock() {
			if err := ctx.Err(); err != nil {
				s.mu.Unlock()
				return err
			}
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-tick.C:
		}
	}
}
