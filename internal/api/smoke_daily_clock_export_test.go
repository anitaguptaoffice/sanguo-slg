package api

import "time"

// SetSmokeQuestCalendarClockForTest is available only to API test binaries.
// Bind after WireM4Content and before serving requests; never reuse the mutable
// military/build clock for a same-day quest persistence scenario.
func (s *Server) SetSmokeQuestCalendarClockForTest(now func() time.Time) {
	if s.questSvc == nil || now == nil {
		panic("smoke quest calendar requires wired quests and a clock")
	}
	s.questSvc.SetClock(now)
}
