package hero

import (
	"context"
	"testing"
)

func testHeroL5(t *testing.T) (*Hero, Template) {
	tpl := DefaultCatalog()[1001]
	h := &Hero{
		ServerID: 1, HeroID: 1, PlayerID: 9, TemplateCfgID: 1001, Level: 5, Status: StatusIdle,
	}
	ApplyStatsForLevel(h, tpl, 5)
	return h, tpl
}

func TestAddHeroPointAllocatesPotential(t *testing.T) {
	h, tpl := testHeroL5(t)
	base := StatsAtLevel(tpl, 5)
	targetPolitics := base.Politics + 2
	targetForce := base.Force + 1
	targetIntel := base.Intel + 2
	res, err := AddHeroPointOnce(h, tpl, AddHeroPointRequest{
		HeroID: 1, Politics: targetPolitics, Force: targetForce, Intel: targetIntel,
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.PotentialRemaining != 0 || h.PoliticsAdd != 2 || h.ForceAdd != 1 || h.IntelAdd != 2 {
		t.Fatalf("adds=%d,%d,%d rem=%d", h.PoliticsAdd, h.ForceAdd, h.IntelAdd, res.PotentialRemaining)
	}
	if h.Politics != targetPolitics || h.Force != targetForce || h.Intel != targetIntel {
		t.Fatalf("attrs politics=%d force=%d intel=%d", h.Politics, h.Force, h.Intel)
	}
}

func TestAddHeroPointInsufficientPotential(t *testing.T) {
	h, tpl := testHeroL5(t)
	base := StatsAtLevel(tpl, 5)
	_, err := AddHeroPointOnce(h, tpl, AddHeroPointRequest{
		HeroID: 1,
		Politics: base.Politics + 3,
		Force:    base.Force + 3,
		Intel:    base.Intel,
	})
	if err != ErrInsufficientPotential {
		t.Fatalf("err=%v", err)
	}
}

func TestAddHeroPointRejectsMarching(t *testing.T) {
	h, tpl := testHeroL5(t)
	h.Status = StatusMarch
	base := StatsAtLevel(tpl, 5)
	_, err := AddHeroPointOnce(h, tpl, AddHeroPointRequest{
		HeroID: 1, Politics: base.Politics + 1, Force: base.Force, Intel: base.Intel,
	})
	if err != ErrHeroNotInCity {
		t.Fatalf("err=%v", err)
	}
}

func TestClearHeroPointResetsAdds(t *testing.T) {
	h, tpl := testHeroL5(t)
	base := StatsAtLevel(tpl, 5)
	_, err := AddHeroPointOnce(h, tpl, AddHeroPointRequest{
		HeroID: 1, Politics: base.Politics + 2, Force: base.Force + 2, Intel: base.Intel + 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	res, err := ClearHeroPointOnce(h, tpl)
	if err != nil {
		t.Fatal(err)
	}
	if res.PotentialRemaining != PointBudget(5) || h.PoliticsAdd != 0 {
		t.Fatalf("after clear rem=%d adds=%d,%d,%d", res.PotentialRemaining, h.PoliticsAdd, h.ForceAdd, h.IntelAdd)
	}
	if h.Politics != base.Politics || h.Force != base.Force || h.Intel != base.Intel {
		t.Fatalf("baseline attrs politics=%d force=%d intel=%d", h.Politics, h.Force, h.Intel)
	}
}

func TestAddHeroPointPlayerNotOwned(t *testing.T) {
	ctx := context.Background()
	svc := NewService()
	_, err := svc.AddHeroPointPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 1}, AddHeroPointRequest{HeroID: 99})
	if err != ErrHeroNotFound {
		t.Fatalf("err=%v", err)
	}
}

func TestUpgradePreservesPointAdds(t *testing.T) {
	h, tpl := testHeroL5(t)
	base := StatsAtLevel(tpl, 5)
	_, err := AddHeroPointOnce(h, tpl, AddHeroPointRequest{
		HeroID: 1, Politics: base.Politics + 1, Force: base.Force, Intel: base.Intel,
	})
	if err != nil {
		t.Fatal(err)
	}
	levels, _ := DefaultLevelTable()
	h.Exp = 100000
	_, err = UpgradeHeroOnce(h, tpl, levels)
	if err != nil {
		t.Fatal(err)
	}
	if h.PoliticsAdd != 1 || h.Level != 6 {
		t.Fatalf("level=%d politics_add=%d", h.Level, h.PoliticsAdd)
	}
	base6 := StatsAtLevel(tpl, 6)
	if h.Politics != base6.Politics+1 {
		t.Fatalf("politics=%d want=%d", h.Politics, base6.Politics+1)
	}
}
