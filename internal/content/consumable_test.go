package content

import (
	"testing"
)

func TestUseResourcePack(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 2, PlayerID: 7}
	const foodID = 2001

	if _, err := svc.Add(p, foodID, 2); err != nil {
		t.Fatal(err)
	}
	res, err := svc.Use(p, foodID, 2)
	if err != nil {
		t.Fatal(err)
	}
	if res.Grants == nil || res.Grants.Food != 2000 {
		t.Fatalf("grants: %+v", res.Grants)
	}
	if res.Remaining != 0 {
		t.Fatalf("remaining %d", res.Remaining)
	}
	qty, _ := svc.Get(p, foodID)
	if qty != 0 {
		t.Fatalf("qty %d", qty)
	}
}

func TestUseSpeedup(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 2, PlayerID: 8}
	const speedID = 2003

	if _, err := svc.Add(p, speedID, 3); err != nil {
		t.Fatal(err)
	}
	res, err := svc.Use(p, speedID, 2)
	if err != nil {
		t.Fatal(err)
	}
	if res.Speedup == nil || res.Speedup.Seconds != 600 {
		t.Fatalf("speedup: %+v", res.Speedup)
	}
	if len(res.Speedup.AppliesTo) != 2 {
		t.Fatalf("applies: %v", res.Speedup.AppliesTo)
	}
	if res.Remaining != 1 {
		t.Fatalf("remaining %d", res.Remaining)
	}
}

func TestUseResourcePackCreditsWallet(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 2, PlayerID: 10}
	const foodID = 2001
	if _, err := svc.Add(p, foodID, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Use(p, foodID, 1); err != nil {
		t.Fatal(err)
	}
	w := svc.Wallet(p)
	if w.Food != 1000 {
		t.Fatalf("wallet food %d", w.Food)
	}
}

func TestUseRecruitScroll(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 1, PlayerID: 11}
	const scrollID = 2004
	if _, err := svc.Add(p, scrollID, 2); err != nil {
		t.Fatal(err)
	}
	res, err := svc.Use(p, scrollID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if res.Recruit == nil || res.Recruit.HeroPool != "standard" || res.Recruit.Draws != 1 {
		t.Fatalf("recruit %+v", res.Recruit)
	}
}

func TestUseTrainToken(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 1, PlayerID: 12}
	const tokenID = 2005
	if _, err := svc.Add(p, tokenID, 2); err != nil {
		t.Fatal(err)
	}
	res, err := svc.Use(p, tokenID, 2)
	if err != nil {
		t.Fatal(err)
	}
	if res.Train == nil || res.Train.UnitCode != "infantry" || res.Train.Count != 200 {
		t.Fatalf("train %+v", res.Train)
	}
}

