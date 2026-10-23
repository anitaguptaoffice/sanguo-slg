package march

import (
	"testing"
	"time"
)

func TestRecruitDeductsAndCompletes(t *testing.T) {
	start := time.Unix(1_700_000_000, 0)
	now := start
	city := &CityState{
		ID:     1,
		Wallet: Resources{Food: 10_000, Wood: 10_000},
	}
	cat := DefaultUnitCatalog()
	res, job, err := StartRecruit(city, cat, now, RecruitRequest{CityID: 1, UnitCfgID: 1, Count: 10})
	if err != nil {
		t.Fatal(err)
	}
	wantCost := cat[1].RecruitCost.Scale(10)
	if city.Wallet.Food != 10_000-wantCost.Food {
		t.Fatalf("wallet food %d", city.Wallet.Food)
	}
	if res.FinishAt != now.Add(30*time.Duration(10)*time.Second) {
		t.Fatalf("finish at %v", res.FinishAt)
	}
	promoted, err := CompleteRecruit(city, cat, job.ID, job.FinishAt)
	if err != nil {
		t.Fatal(err)
	}
	if promoted != nil {
		t.Fatal("no second job")
	}
	if city.Troops[1] != 10 {
		t.Fatalf("troops %d", city.Troops[1])
	}
}

func TestRecruitInsufficientResources(t *testing.T) {
	city := &CityState{ID: 1, Wallet: Resources{Food: 1}}
	_, _, err := StartRecruit(city, DefaultUnitCatalog(), time.Now(), RecruitRequest{UnitCfgID: 1, Count: 100})
	if err != ErrInsufficientRes {
		t.Fatalf("got %v", err)
	}
}

func TestRecruitFIFOQueue(t *testing.T) {
	start := time.Unix(0, 0)
	now := start
	city := &CityState{ID: 1, Wallet: Resources{Food: 100_000, Wood: 100_000}}
	cat := DefaultUnitCatalog()

	_, job1, err := StartRecruit(city, cat, now, RecruitRequest{UnitCfgID: 1, Count: 1})
	if err != nil {
		t.Fatal(err)
	}
	_, job2, err := StartRecruit(city, cat, now, RecruitRequest{UnitCfgID: 1, Count: 1})
	if err != nil {
		t.Fatal(err)
	}
	if job2.StartAt != job1.FinishAt {
		t.Fatalf("job2 should start when job1 finishes: %v vs %v", job2.StartAt, job1.FinishAt)
	}
	if job2.Status != QueueWaiting {
		t.Fatal("second job waits")
	}
}
