package api

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
)

// The embedded catalog deliberately remains unchanged. HERO's old high-level
// captive stand-in 2050 has no definition there and legacy Remove rejects it.
// This explicit test-only catalog enables the existing planned-item branch to
// exercise real PG CONTENT adapters; it is not natural gameplay/catalog proof.
func familyCaptiveItemCatalog(t *testing.T, s *Server) {
	t.Helper()
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	cat.Items[hero.CaptiveSummonItemCfgID] = content.ItemDef{ID: hero.CaptiveSummonItemCfgID, Code: "injected_captive_test_item", Name: "test-only item", MaxStack: 100}
	s.wireHotelTransactions(cat)
	s.wireFamilyTransactions()
}

func TestFamilyAtomicPGDefaultCatalogRejectsUnregisteredItemWithoutDebit(t *testing.T) {
	for _, kind := range []string{"missing-item", "missing-gold", "unregistered-item"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := hotelFixture(t)
			h := familySeed(t, s, hero.StatusCaptive, 1, 60)
			cat, err := content.EmbeddedCatalog()
			if err != nil {
				t.Fatal(err)
			}
			if _, ok := cat.Items[hero.CaptiveSummonItemCfgID]; ok {
				t.Fatal("fixture assumption changed: reassess natural catalog coverage")
			}
			want := "hero outcome unavailable; reload state"
			if kind != "missing-item" {
				recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,7,$1,2)`, hero.CaptiveSummonItemCfgID)
			} else {
				want = hero.ErrInsufficientItem.Error()
			}
			if kind == "missing-gold" {
				recruitSQL(t, pool, `UPDATE player_wallet SET gold=0`)
				want = hero.ErrInsufficientGold.Error()
			}
			before := familyState(t, pool)
			r := s.GatewayRouter().Dispatch(context.Background(), familyPacket(RouteSureSummonCaptive, 1, h.HeroID, 0))
			if r.Code == 0 || r.Msg != want || len(r.Data) != 0 || familyState(t, pool) != before {
				t.Fatalf("unregistered item partial effect/error contract %+v want=%s", r, want)
			}
		})
	}
}
