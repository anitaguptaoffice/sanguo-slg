package march

import (
	"testing"
	"time"
)

func TestCommandCap(t *testing.T) {
	if got := CommandCap(1, 55); got != 200+55*100 {
		t.Fatalf("cap level1 command55 = %d", got)
	}
	if got := CommandCap(0, -3); got != 200 {
		t.Fatalf("cap floor = %d", got)
	}
	if got := CommandCap(5, 80); got != 1000+8000 {
		t.Fatalf("cap level5 command80 = %d", got)
	}
}

func TestSchedulerCancel(t *testing.T) {
	s := NewScheduler(func() time.Time { return time.Unix(0, 0) })
	now := time.Unix(0, 0)
	s.Schedule(Event{Kind: EventMarchArrive, DueAt: now.Add(time.Minute), RefID: 7})
	s.Schedule(Event{Kind: EventMarchReturnDone, DueAt: now.Add(2 * time.Minute), RefID: 7})
	if removed := s.Cancel(EventMarchArrive, 7); removed != 1 {
		t.Fatalf("cancel removed %d", removed)
	}
	if due := s.NextDue(); !due.Equal(now.Add(2 * time.Minute)) {
		t.Fatalf("next due %v", due)
	}
	if s.PollDue(now.Add(3*time.Minute)) != 1 {
		t.Fatal("return event lost")
	}
}
