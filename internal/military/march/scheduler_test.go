package march

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestSchedulerPollDueOrder(t *testing.T) {
	s := NewScheduler(nil)
	var fired int
	due := time.Unix(100, 0)
	s.Schedule(Event{Kind: EventRecruitComplete, DueAt: due, Handler: func(Event) { fired++ }})
	if s.PollDue(due.Add(-time.Second)) != 0 {
		t.Fatal("not yet")
	}
	if s.PollDue(due) != 1 {
		t.Fatal("should fire")
	}
	if fired != 1 {
		t.Fatal(fired)
	}
}

func TestSchedulerRunFiresWithinOneSecond(t *testing.T) {
	var (
		mu      sync.Mutex
		firedAt time.Time
	)
	due := time.Now().Add(150 * time.Millisecond)
	s := NewScheduler(time.Now)
	s.Schedule(Event{
		Kind:  EventMarchArrive,
		DueAt: due,
		Handler: func(Event) {
			mu.Lock()
			firedAt = time.Now()
			mu.Unlock()
		},
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go s.Run(ctx, DefaultTickInterval)
	deadline := time.After(3 * time.Second)
	for {
		mu.Lock()
		done := !firedAt.IsZero()
		mu.Unlock()
		if done {
			break
		}
		if time.Now().After(due.Add(2 * time.Second)) {
			t.Fatal("timeout waiting for event")
		}
		select {
		case <-deadline:
			t.Fatal("deadline")
		default:
			time.Sleep(10 * time.Millisecond)
		}
	}
	mu.Lock()
	lag := firedAt.Sub(due)
	mu.Unlock()
	if lag < 0 || lag >= time.Second {
		t.Fatalf("scheduler lag %v, want < 1s", lag)
	}
	cancel()
}
