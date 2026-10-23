package combat_test

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/combat"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
)

type stepClock struct {
	t time.Time
}

func (c *stepClock) Now() time.Time { return c.t }

func (c *stepClock) Advance(d time.Duration) { c.t = c.t.Add(d) }

func TestHubMarchArriveTriggersCombatAndReport(t *testing.T) {
	clk := &stepClock{t: time.Unix(0, 0)}
	h := march.NewHub(clk.Now)

	store := report.NewMemStore()
	svc := report.NewService(store)
	resolver := combat.NewResolver(7, svc, combat.M2FixtureGarrisons(), nil)
	h.SetMarchArrivalHandler(resolver.HubHandler())

	h.RegisterCity(&march.CityState{
		ID:       10,
		PlayerID: 501,
		Troops:   map[int32]int32{1: 300, 2: 80},
	})

	m, err := h.CreateMarch(march.StartMarchRequest{
		ArmyID:       1,
		OriginCityID: 10,
		PlayerID:     501,
		FromX:        0, FromY: 0,
		ToX:          5, ToY: 5,
		Purpose:      combat.PurposeAttack,
		Troops: []march.TroopStack{
			{UnitCfgID: 1, Count: 200},
			{UnitCfgID: 2, Count: 50},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	city := h.City(10)
	if city.Troops[1] != 100 || city.Troops[2] != 30 {
		t.Fatalf("deducted troops: %+v", city.Troops)
	}

	clk.Advance(m.ArriveAt.Sub(clk.Now()))
	h.Tick()

	got := h.March(m.ID)
	if got.Phase != march.PhaseReturning {
		t.Fatalf("expected auto return, phase %s", got.Phase)
	}
	if got.LastReportID == 0 {
		t.Fatal("missing report id")
	}

	rec, err := svc.Get(context.Background(), 7, got.LastReportID)
	if err != nil {
		t.Fatal(err)
	}
	if rec.AttackerPlayerID != 501 || rec.LocationX != 5 || rec.LocationY != 5 {
		t.Fatalf("record meta %+v", rec)
	}
	if rec.Outcome != report.OutcomeFromResult(rec.Detail.Result) {
		t.Fatal("outcome mismatch")
	}

	clk.Advance(got.ReturnFinishAt.Sub(clk.Now()))
	h.Tick()
	if h.March(m.ID).Phase != march.PhasePending {
		t.Fatal("return complete")
	}
	home := h.City(10)
	if home.Troops[1]+home.Troops[2] == 0 {
		t.Fatal("survivors should return to city")
	}
}
