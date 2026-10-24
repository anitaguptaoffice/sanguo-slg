package api

import (
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
)

// SmokeSyncClock is a mutable clock shared by Server and march.Hub in gateway smoke tests.
type SmokeSyncClock struct {
	T time.Time
}

// Now returns the current smoke clock time.
func (c *SmokeSyncClock) Now() time.Time {
	if c == nil {
		return time.Now()
	}
	return c.T
}

// BindSmokeSyncClock attaches a shared clock for INTG gateway time advance (api_test).
func (s *Server) BindSmokeSyncClock(c *SmokeSyncClock) {
	if s == nil {
		return
	}
	s.smokeSyncClock = c
}

// AdvanceSmokeTimeTo moves the shared smoke clock (no-op when unbound).
func (s *Server) AdvanceSmokeTimeTo(t time.Time) {
	if s == nil || s.smokeSyncClock == nil {
		return
	}
	s.smokeSyncClock.T = t
}

// TickMilitaryForTest processes due march events at the smoke clock.
func (s *Server) TickMilitaryForTest() {
	if s != nil && s.military != nil {
		s.military.Tick()
	}
}

// MilitaryMarchForTest returns a march order snapshot for smoke assertions.
func (s *Server) MilitaryMarchForTest(marchID int64) *march.MarchOrder {
	if s == nil || s.military == nil {
		return nil
	}
	return s.military.March(marchID)
}
