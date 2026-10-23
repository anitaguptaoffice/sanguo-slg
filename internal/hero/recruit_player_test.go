package hero

import (
	"context"
	"testing"
)

type memInventory struct {
	wallet Resources
	items  map[int32]int32
}

func (m *memInventory) LoadWalletAndItems(_ context.Context, _ PlayerRef) (Resources, map[int32]int32, error) {
	items := map[int32]int32{}
	for k, v := range m.items {
		items[k] = v
	}
	return m.wallet, items, nil
}

func (m *memInventory) ApplyRecruitSpend(_ context.Context, _ PlayerRef, walletBefore Resources, itemsBefore map[int32]int32, walletAfter Resources, itemsAfter map[int32]int32) error {
	m.wallet = walletAfter
	m.items = map[int32]int32{}
	for k, v := range itemsAfter {
		m.items[k] = v
	}
	return nil
}

func TestRecruitPlayerInsufficientItem(t *testing.T) {
	svc := NewService()
	inv := &memInventory{
		wallet: Resources{10000, 10000, 10000, 10000},
		items:  map[int32]int32{RecruitScrollID: 0},
	}
	p := PlayerRef{ServerID: 1, PlayerID: 7}
	_, err := svc.RecruitPlayer(context.Background(), p, inv, RecruitRequest{TemplateCfgID: 1001})
	if err != ErrInsufficientItem {
		t.Fatalf("expected ErrInsufficientItem, got %v", err)
	}
}

func TestRecruitPlayerSuccess(t *testing.T) {
	svc := NewService()
	inv := &memInventory{
		wallet: Resources{10000, 10000, 10000, 10000},
		items:  map[int32]int32{RecruitScrollID: 2},
	}
	p := PlayerRef{ServerID: 1, PlayerID: 7}
	res, err := svc.RecruitPlayer(context.Background(), p, inv, RecruitRequest{TemplateCfgID: 1001})
	if err != nil {
		t.Fatal(err)
	}
	if res.Hero.TemplateCfgID != 1001 {
		t.Fatalf("hero %+v", res.Hero)
	}
	if inv.items[RecruitScrollID] != 1 {
		t.Fatalf("items %v", inv.items)
	}
	tpl := svc.Catalog[1001]
	if tpl.Name != "玄德府君" {
		t.Fatalf("DATA-002 name expected, got %q", tpl.Name)
	}
}

func TestListPlayerHeroesPagination(t *testing.T) {
	svc := NewService()
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		h := &Hero{ServerID: 1, PlayerID: 9, HeroID: int64(i + 1), TemplateCfgID: 1001, Level: 1, Loyalty: 100}
		if err := svc.Store.SaveHero(ctx, h); err != nil {
			t.Fatal(err)
		}
	}
	page, err := svc.ListPlayerHeroes(ctx, PlayerRef{ServerID: 1, PlayerID: 9}, ListQuery{Limit: 2, Offset: 1})
	if err != nil || page.Total != 3 || len(page.Heroes) != 2 {
		t.Fatalf("page %+v err=%v", page, err)
	}
}
