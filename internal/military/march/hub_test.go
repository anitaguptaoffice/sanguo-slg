package march

import (
	"testing"
	"time"
)

type stepClock struct {
	t time.Time
}

func (c *stepClock) Now() time.Time { return c.t }

func (c *stepClock) Advance(d time.Duration) { c.t = c.t.Add(d) }

func TestHubRecruitSchedulerIntegration(t *testing.T) {
	clk := &stepClock{t: time.Unix(0, 0)}
	h := NewHub(clk.Now)
	h.RegisterCity(&CityState{
		ID:     42,
		Wallet: Resources{Food: 50_000, Wood: 50_000},
	})
	res, err := h.Recruit(RecruitRequest{CityID: 42, UnitCfgID: 1, Count: 5})
	if err != nil {
		t.Fatal(err)
	}
	clk.Advance(res.FinishAt.Sub(clk.Now()))
	if h.Tick() != 1 {
		t.Fatal("recruit event")
	}
	city := h.City(42)
	if city.Troops[1] != 5 {
		t.Fatalf("got %d troops", city.Troops[1])
	}
}

func TestHubMarchArrivesOnSchedule(t *testing.T) {
	clk := &stepClock{t: time.Unix(0, 0)}
	h := NewHub(clk.Now)
	m, err := h.CreateMarch(StartMarchRequest{
		ArmyID: 7,
		FromX:  0, FromY: 0,
		ToX:    5, ToY: 5,
		Troops: []TroopStack{{UnitCfgID: 1, Count: 1}},
	})
	if err != nil {
		t.Fatal(err)
	}
	clk.Advance(m.ArriveAt.Sub(clk.Now()))
	h.Tick()
	got := h.March(m.ID)
	if got.Phase != PhaseArrived {
		t.Fatalf("phase %s", got.Phase)
	}
}
