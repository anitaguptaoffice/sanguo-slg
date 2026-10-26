package hero

import (
	"context"
	"testing"
	"time"
)

func persuadeTestSetup(t *testing.T) (*Service, *stubHotelCity, *memInventory, PlayerRef) {
	svc := NewService()
	city := &stubHotelCity{hotelLevel: 5, officeLevel: 5, gold: 1_000_000}
	inv := &memInventory{
		wallet: Resources{Gold: 1_000_000},
		items:  map[int32]int32{PersuadeItemCfgID: 20},
	}
	p := PlayerRef{ServerID: 1, PlayerID: 77}
	return svc, city, inv, p
}

func TestPersuadeFriendProgressAndLionizeHire(t *testing.T) {
	base := time.Unix(1_700_100_000, 0)
	ctx := context.Background()
	svc, city, inv, p := persuadeTestSetup(t)
	svc.SetClock(func() time.Time { return base })
	cityRef := CityRef{CityID: 100}
	npcID := int32(1001)

	res, err := svc.LionizeHero(ctx, p, cityRef, npcID, city)
	if err != nil || !res.Befriended || res.Friend != LionizeInitialFriend {
		t.Fatalf("lionize befriended: %v %+v", err, res)
	}

	for i := 0; i < 2; i++ {
		svc.SetClock(func() time.Time {
			return base.Add(time.Duration(i+1) * time.Duration(PersuadeCooldownSeconds+1) * time.Second)
		})
		pr, err := svc.PersuadeHero(ctx, p, cityRef, npcID, city, inv)
		if err != nil {
			t.Fatalf("persuade %d: %v", i, err)
		}
		if pr.FriendDelta != PersuadeFriendDelta {
			t.Fatalf("delta %+v", pr)
		}
	}
	rec, _ := svc.LionizeStore.Get(ctx, p.ServerID, p.PlayerID, npcID)
	if rec == nil || rec.Friend != LionizeHireFriendMin {
		t.Fatalf("friend progress: %+v", rec)
	}

	hire, err := svc.LionizeHero(ctx, p, cityRef, npcID, city)
	if err != nil || !hire.Recruited || hire.Hero == nil {
		t.Fatalf("hire: %v %+v", err, hire)
	}
	if hire.Hero.TemplateCfgID != 1001 {
		t.Fatalf("hero %+v", hire.Hero)
	}
}

func TestLionizeHireInsufficientFriend(t *testing.T) {
	ctx := context.Background()
	svc, city, _, p := persuadeTestSetup(t)
	cityRef := CityRef{CityID: 100}
	npcID := int32(1002)

	_, err := svc.LionizeHero(ctx, p, cityRef, npcID, city)
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.LionizeHero(ctx, p, cityRef, npcID, city)
	if err != ErrInsufficientFriend {
		t.Fatalf("expected insufficient friend, got %v", err)
	}
}

func TestLionizeHireCapacityFull(t *testing.T) {
	ctx := context.Background()
	svc, city, inv, p := persuadeTestSetup(t)
	city.officeLevel = 1
	cityRef := CityRef{CityID: 100}
	npcID := int32(1003)

	if err := svc.Store.CreateHero(ctx, &Hero{
		ServerID: 1, PlayerID: 77, TemplateCfgID: 9999, Level: 1, Status: StatusIdle, Loyalty: 70,
	}); err != nil {
		t.Fatal(err)
	}
	_, err := svc.LionizeHero(ctx, p, cityRef, npcID, city)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		svc.SetClock(func() time.Time { return time.Unix(int64(i+1)*PersuadeCooldownSeconds+10, 0) })
		_, err = svc.PersuadeHero(ctx, p, cityRef, npcID, city, inv)
		if err != nil {
			t.Fatal(err)
		}
	}
	_, err = svc.LionizeHero(ctx, p, cityRef, npcID, city)
	if err != ErrHotelCapacityFull {
		t.Fatalf("expected capacity full, got %v", err)
	}
}

func TestPersuadeCooldownReject(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	svc, city, inv, p := persuadeTestSetup(t)
	svc.SetClock(func() time.Time { return base })
	ctx := context.Background()
	cityRef := CityRef{CityID: 100}
	npcID := int32(1004)

	if _, err := svc.LionizeHero(ctx, p, cityRef, npcID, city); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.PersuadeHero(ctx, p, cityRef, npcID, city, inv); err != nil {
		t.Fatal(err)
	}
	svc.SetClock(func() time.Time { return base.Add(time.Hour) })
	_, err := svc.PersuadeHero(ctx, p, cityRef, npcID, city, inv)
	if err != ErrPersuadeCooldown {
		t.Fatalf("expected cooldown, got %v", err)
	}
}
