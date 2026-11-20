package march

import (
	"errors"
	"testing"
	"time"
)

func stagedReturningHub(t *testing.T, now func() time.Time) (*Hub, time.Time) {
	t.Helper()
	in := restoreSample()
	_, items, stacks, err := validateRestore(1, DefaultUnitCatalog(), in.orders[1:], in.troops, in.heroes, 0)
	baseOK(t, err)
	h := NewHub(now)
	baseOK(t, installRestore(h, items, stacks))
	h.EnsureCity(&CityState{ID: 101, PlayerID: 8, Troops: map[int32]int32{2: 11}})
	return h, *items[0].ReturnAt
}

func durableReturnObservation(ev DurableMarchReturnEvent, kind ReturnDisposition) ReturnObservation {
	return ReturnObservation{Candidate: ReturnCandidate{1, ev.PlayerID, ev.CityID, ev.MarchID, ev.ArmyID},
		Disposition: kind, ReturnAt: ev.ReturnAt}
}

func awaitReturnEvent(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		t.Fatal("return event did not advance")
	}
}

func TestDurableHubReturnPublishesOutsideLock(t *testing.T) {
	h, due := stagedReturningHub(t, nil)
	entered, release := make(chan struct{}), make(chan struct{})
	defer close(release)
	baseOK(t, h.SetDurableMarchReturnHandler(func(ev DurableMarchReturnEvent) (ReturnObservation, error) {
		// Reentry demonstrates that neither database work nor notification holds the Hub lock.
		if h.March(ev.MarchID).Phase != PhaseReturning || ev != (DurableMarchReturnEvent{30, 40, 101, 8, due}) {
			t.Error("incorrect immutable return candidate", ev)
		}
		close(entered)
		<-release
		return durableReturnObservation(ev, ReturnApplied), nil
	}))
	finished := make(chan struct{})
	h.SetMarchFinishedHandler(func(id int64) {
		if o := h.March(id); o.Phase != PhaseReturned || !o.ReturnFinishAt.IsZero() {
			t.Error("terminal notification raced publication", o)
		}
		close(finished)
	})
	baseOK(t, h.ActivateRestore())
	mustErr(t, h.SetDurableMarchReturnHandler(nil), ErrReturnUnavailable)
	if h.Scheduler().PollDue(due.Add(-time.Nanosecond)) != 0 {
		t.Fatal("ran before deadline")
	}
	polled := make(chan struct{})
	go func() { h.Scheduler().PollDue(due); close(polled) }()
	awaitReturnEvent(t, entered)
	duplicate := make(chan struct{})
	go func() { h.onMarchReturn(Event{RefID: 30, DueAt: due}); close(duplicate) }()
	awaitReturnEvent(t, duplicate)
	if h.March(30).Phase != PhaseReturning {
		t.Fatal("published prior to confirmed callback")
	}
	// Continue the first callback without waiting for business time.
	release <- struct{}{}
	awaitReturnEvent(t, finished)
	awaitReturnEvent(t, polled)
	h.onMarchReturn(Event{RefID: 30, DueAt: due})
	if h.SnapshotCity(101).Troops[2] != 11 {
		t.Fatal("durable return credited volatile stock")
	}
}

func TestDurableHubReturnEarlyAndQuarantined(t *testing.T) {
	var now time.Time
	h, due := stagedReturningHub(t, func() time.Time { return now })
	now = due
	calls := 0
	baseOK(t, h.SetDurableMarchReturnHandler(func(ev DurableMarchReturnEvent) (ReturnObservation, error) {
		calls++
		if calls == 1 {
			return durableReturnObservation(ev, ReturnEarly), nil
		}
		return durableReturnObservation(ev, ReturnCreditedTerminal), nil
	}))
	baseOK(t, h.ActivateRestore())
	if h.Scheduler().PollDue(now) != 1 || h.Scheduler().PollDue(now) != 0 || !h.March(30).ReturnFinishAt.Equal(due) {
		t.Fatal("early polling changed the deadline or retried immediately")
	}
	now = now.Add(DefaultTickInterval)
	if h.Scheduler().PollDue(now) != 1 || calls != 2 || h.March(30).Phase != PhaseReturned {
		t.Fatal("early return did not reach confirmed terminal")
	}

	for _, fail := range []bool{false, true} {
		h, due := stagedReturningHub(t, nil)
		invocations := 0
		fault := errors.New("commit not confirmed")
		want := ErrReturnUnavailable
		if fail {
			want = fault
		}
		baseOK(t, h.SetDurableMarchReturnHandler(func(ev DurableMarchReturnEvent) (ReturnObservation, error) {
			invocations++
			if fail {
				return ReturnObservation{}, fault
			}
			out := durableReturnObservation(ev, ReturnApplied)
			out.Candidate.ArmyID++
			return out, nil
		}))
		baseOK(t, h.ActivateRestore())
		h.Scheduler().PollDue(due)
		h.onMarchReturn(Event{RefID: 30, DueAt: due})
		if !errors.Is(h.MarchReturnError(30), want) || invocations != 1 ||
			h.March(30).Phase != PhaseReturning || h.SnapshotCity(101).Troops[2] != 11 {
			t.Fatal("uncertain or mismatched callback changed state or retried")
		}
	}
}

func TestMatchesDurableReturnAcceptsPostgresPrecision(t *testing.T) {
	at := time.Date(2026, 11, 19, 14, 52, 35, 548385123, time.UTC)
	ev := DurableMarchReturnEvent{MarchID: 30, ArmyID: 40, CityID: 101, PlayerID: 8, ReturnAt: at}
	obs := durableReturnObservation(ev, ReturnApplied)
	obs.ReturnAt = at.Truncate(time.Microsecond)
	if !matchesDurableReturn(ev, obs) {
		t.Fatal("microsecond deadline rejected")
	}
	obs.ReturnAt = at.Add(-time.Second)
	if matchesDurableReturn(ev, obs) {
		t.Fatal("stale deadline accepted")
	}
}
