package hero

import (
	"context"
	"math/rand"
	"testing"
	"time"
)

func TestLargessItemIncreasesLoyaltyClamped(t *testing.T) {
	h := &Hero{HeroID: 1, PlayerID: 42, ServerID: 1, Level: 5, Loyalty: 98, Status: StatusIdle}
	ps := &PlayerState{
		ServerID: 1, PlayerID: 42,
		Items:  map[int32]int32{2050: 1},
		Heroes: []*Hero{h},
	}
	res, err := Largess(ps, DefaultLargessGoods, time.Time{}, rand.New(rand.NewSource(1)), time.Unix(1000, 0), LargessRequest{
		HeroID: 1, Kind: LargessGiftItem, ItemCfgID: 2050,
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.LoyaltyDelta != 2 || h.Loyalty != 100 {
		t.Fatalf("delta=%d loyalty=%d", res.LoyaltyDelta, h.Loyalty)
	}
	if ps.Items[2050] != 0 {
		t.Fatalf("item qty=%d", ps.Items[2050])
	}
}

func TestLargessCooldownBlocksSecondGift(t *testing.T) {
	h := &Hero{HeroID: 2, PlayerID: 1, ServerID: 1, Loyalty: 50, Status: StatusIdle}
	ps := &PlayerState{ServerID: 1, PlayerID: 1, Items: map[int32]int32{2051: 2}, Heroes: []*Hero{h}}
	now := time.Unix(5000, 0)
	last := now.Add(-time.Minute)
	_, err := Largess(ps, DefaultLargessGoods, last, rand.New(rand.NewSource(1)), now, LargessRequest{
		HeroID: 2, Kind: LargessGiftItem, ItemCfgID: 2051,
	})
	if err != ErrLargessCooldown {
		t.Fatalf("expected cooldown, got %v", err)
	}
}

func TestLargessGoldSpendAndPersistCD(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()
	h := &Hero{HeroID: 9, PlayerID: 7, ServerID: 1, Level: 1, Loyalty: 20, Status: StatusIdle}
	if err := store.SaveHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	svc := NewService()
	svc.UseStore(store)
	svc.RNG = rand.New(rand.NewSource(42))
	fixed := time.Unix(1_700_000_000, 0)
	svc.SetClock(func() time.Time { return fixed })

	inv := &largessTestInventory{gold: 10_000, items: map[int32]int32{}}
	res, err := svc.LargessPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 7}, inv, LargessRequest{HeroID: 9, Kind: LargessGiftGold})
	if err != nil {
		t.Fatal(err)
	}
	if res.GoldSpent != 100 || res.LoyaltyDelta < 1 {
		t.Fatalf("gold=%d delta=%d loyalty=%d", res.GoldSpent, res.LoyaltyDelta, res.Hero.Loyalty)
	}
	last, err := store.LastLargessAt(ctx, 1, 9)
	if err != nil || !last.Equal(fixed) {
		t.Fatalf("last largess: %v err=%v", last, err)
	}
	_, err = svc.LargessPlayer(ctx, PlayerRef{ServerID: 1, PlayerID: 7}, inv, LargessRequest{HeroID: 9, Kind: LargessGiftGold})
	if err != ErrLargessCooldown {
		t.Fatalf("expected cooldown, got %v", err)
	}
}

type largessTestInventory struct {
	gold  int64
	items map[int32]int32
}

func (l *largessTestInventory) LoadWalletAndItems(context.Context, PlayerRef) (Resources, map[int32]int32, error) {
	return Resources{Gold: l.gold}, l.items, nil
}

func (l *largessTestInventory) ApplyRecruitSpend(context.Context, PlayerRef, Resources, map[int32]int32, Resources, map[int32]int32) error {
	return nil
}

func (l *largessTestInventory) ApplyLargessSpend(_ context.Context, _ PlayerRef, goldSpent int64, itemCfgID int32) error {
	if goldSpent > 0 {
		if l.gold < goldSpent {
			return ErrInsufficientGold
		}
		l.gold -= goldSpent
	}
	if itemCfgID > 0 {
		if l.items[itemCfgID] < 1 {
			return ErrInsufficientItem
		}
		l.items[itemCfgID]--
	}
	return nil
}
