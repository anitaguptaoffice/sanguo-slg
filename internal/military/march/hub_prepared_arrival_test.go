package march

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"
)

func stagedPreparedArrival(t *testing.T) (*Hub, time.Time) {
	t.Helper()
	in := restoreSample()
	_, items, troops, err := validateRestore(1, DefaultUnitCatalog(), in.orders[:1], in.troops, in.heroes, 0)
	baseOK(t, err)
	h := NewHub(nil)
	baseOK(t, installRestore(h, items, troops))
	baseOK(t, h.SetDurableMarchReturnHandler(func(ev DurableMarchReturnEvent) (ReturnObservation, error) {
		return durableReturnObservation(ev, ReturnApplied), nil
	}))
	return h, items[0].ArriveAt
}

func TestPreparedHubArrivalRunsOutsideLock(t *testing.T) {
	for _, terminal := range []bool{false, true} {
		name := "return"
		if terminal {
			name = "terminal"
		}
		t.Run(name, func(t *testing.T) {
			h, due := stagedPreparedArrival(t)
			entered, release := make(chan struct{}), make(chan struct{})
			finished := make(chan struct{}, 1)
			t.Cleanup(func() { close(release) })
			baseOK(t, h.SetPreparedMarchArrivalHandler(func(_ context.Context, ev MarchArrivalEvent) (MarchArrivalOutcome, error) {
				if h.March(10).Phase != PhaseMarching || ev.Order.Phase != PhaseArrived ||
					ev.MarchID != 10 || ev.Order.ArmyID != 20 || ev.PlayerID != 7 || !ev.Order.ArriveAt.Equal(due) {
					t.Error("incorrect arrival candidate", ev)
				}
				close(entered)
				<-release
				if terminal {
					ev.Troops[0].Count = 0
					return MarchArrivalOutcome{Durable: true, BattleRan: true, ReportID: 51}, nil
				}
				return MarchArrivalOutcome{Durable: true, RemainingTroops: ev.Troops}, nil
			}))
			h.SetMarchFinishedHandler(func(id int64) {
				if order := h.March(id); order.Phase != PhaseReturned {
					t.Error("terminal arrival notified before publication", order)
				}
				finished <- struct{}{}
			})
			if _, err := h.CreateMarch(StartMarchRequest{Troops: []TroopStack{{1, 1}}}); !errors.Is(err, ErrInvalidMarch) {
				t.Fatal("prepared Hub accepted legacy departure", err)
			}
			baseOK(t, h.ActivateRestore())
			h.onMarchArrive(Event{RefID: 10, DueAt: due.Add(-time.Second)})
			if h.Scheduler().PollDue(due.Add(-time.Nanosecond)) != 0 {
				t.Fatal("arrival ran before its frozen deadline")
			}
			polled := make(chan struct{})
			go func() { h.Scheduler().PollDue(due.Add(time.Hour)); close(polled) }()
			awaitReturnEvent(t, entered)
			duplicate := make(chan struct{})
			go func() { h.onMarchArrive(Event{RefID: 10, DueAt: due}); close(duplicate) }()
			awaitReturnEvent(t, duplicate)
			if o, stacks := h.SnapshotMarch(10); o.Phase != PhaseMarching || !slices.Equal(stacks, []TroopStack{{1, 5}}) {
				t.Fatal("unconfirmed arrival changed the order or troops", o, stacks)
			}
			release <- struct{}{}
			awaitReturnEvent(t, polled)
			h.onMarchArrive(Event{RefID: 10, DueAt: due})
			if terminal {
				awaitReturnEvent(t, finished)
				if o, stacks := h.SnapshotMarch(10); o.LastReportID != 51 || len(stacks) != 0 || !h.Scheduler().NextDue().IsZero() {
					t.Fatal("annihilated arrival retained survivors or scheduled return", o, stacks)
				}
				return
			}
			want := h.March(10)
			want.Phase = PhaseArrived
			baseOK(t, BeginReturn(want, due))
			if got := h.Scheduler().NextDue(); !got.Equal(want.ReturnFinishAt) || h.March(10).Phase != PhaseReturning {
				t.Fatal("late arrival changed the durable return deadline", got, want.ReturnFinishAt)
			}
			if n := h.Scheduler().PollDue(want.ReturnFinishAt); n != 1 {
				t.Fatal("wrong number of return events", n)
			}
			awaitReturnEvent(t, finished)
		})
	}
}

func TestPreparedHubArrivalQuarantinesUnconfirmedResult(t *testing.T) {
	fault := errors.New("arrival commit unconfirmed")
	for _, tc := range []struct {
		name string
		out  MarchArrivalOutcome
		err  error
		want error
	}{
		{name: "callback failure", err: fault, want: fault},
		{name: "volatile success", out: MarchArrivalOutcome{RemainingTroops: []TroopStack{{1, 5}}}, want: ErrMarchTransition},
		{name: "dropped troops without battle", out: MarchArrivalOutcome{Durable: true}, want: ErrMarchTransition},
		{name: "battle without report", out: MarchArrivalOutcome{Durable: true, BattleRan: true}, want: ErrMarchTransition},
		{name: "invalid battle survivors", out: MarchArrivalOutcome{Durable: true, BattleRan: true, ReportID: 1, RemainingTroops: []TroopStack{{1, -1}}}, want: ErrMarchTransition},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h, due := stagedPreparedArrival(t)
			calls := 0
			resolve := func(_ context.Context, ev MarchArrivalEvent) (MarchArrivalOutcome, error) {
				calls++
				ev.Troops[0].Count = 99
				return tc.out, tc.err
			}
			mustErr(t, NewHub(nil).SetPreparedMarchArrivalHandler(resolve), ErrMarchTransition)
			baseOK(t, h.SetPreparedMarchArrivalHandler(resolve))
			mustErr(t, h.SetPreparedMarchArrivalHandler(resolve), ErrMarchTransition)
			baseOK(t, h.ActivateRestore())
			h.Scheduler().PollDue(due)
			h.onMarchArrive(Event{RefID: 10, DueAt: due})
			order, stacks := h.SnapshotMarch(10)
			if calls != 1 || !errors.Is(h.MarchArrivalError(10), tc.want) ||
				order.Phase != PhaseMarching || !slices.Equal(stacks, []TroopStack{{1, 5}}) || !h.Scheduler().NextDue().IsZero() {
				t.Fatal("unconfirmed arrival was published or retried", calls, order, stacks, h.MarchArrivalError(10))
			}
		})
	}
}
