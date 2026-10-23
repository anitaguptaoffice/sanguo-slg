package hero

import (
	"context"
	"math/rand"
	"testing"
	"time"
)

func TestStatsGrowthAndLoyalty(t *testing.T) {
	tpl := DefaultCatalog()[1001]
	g := GrowthPerStat(tpl.Base.Force, tpl.Rarity)
	if StatAtLevel(tpl.Base.Force, 1, g) != 72 {
		t.Fatal("level1 base")
	}
	l20 := StatsAtLevel(tpl, 20)
	if l20.Force != tpl.Base.Force+g*19 {
		t.Fatalf("growth: %d", l20.Force)
	}
	h := &Hero{Loyalty: LoyaltyDefault}
	h.SetLoyalty(200)
	if h.Loyalty != 100 {
		t.Fatal("loyalty clamp")
	}
	h.SetLoyalty(-1)
	if h.Loyalty != 0 {
		t.Fatal("loyalty floor")
	}
}

func TestRecruitPersist(t *testing.T) {
	ps := &PlayerState{
		ServerID: 1, PlayerID: 42,
		Wallet: Resources{10000, 10000, 10000, 10000},
		Items:  map[int32]int32{RecruitScrollID: 5},
	}
	svc := NewService()
	ctx := context.Background()
	res, err := svc.RecruitAndPersist(ctx, ps, RecruitRequest{TemplateCfgID: 1002})
	if err != nil {
		t.Fatal(err)
	}
	if res.Hero.TemplateCfgID != 1002 || ps.Items[RecruitScrollID] != 4 {
		t.Fatalf("hero %+v items %v", res.Hero, ps.Items)
	}
	got, _ := svc.Store.GetHero(ctx, 1, res.Hero.HeroID)
	if got == nil {
		t.Fatal("not persisted")
	}
	_, err = Recruit(ps, DefaultCatalog(), DefaultRecruitItems(), rand.New(rand.NewSource(1)), time.Now(),
		RecruitRequest{TemplateCfgID: 1002})
	if err != ErrAlreadyOwned {
		t.Fatalf("dup %v", err)
	}
}
