package hero

import (
	"context"
	"errors"
	"testing"
)

func TestCreatorsReturnStoreIdentity(t *testing.T) {
	for _, backend := range []string{"memory", "postgres"} {
		t.Run(backend, func(t *testing.T) {
			var store Store = NewMemStore()
			if backend == "postgres" {
				store = identityStore(t)
			}
			ctx := context.Background()
			old := &Hero{ServerID: 1, PlayerID: 999, DisplayName: "keep me"}
			if err := store.CreateHero(ctx, old); err != nil {
				t.Fatal(err)
			}
			deleted := &Hero{ServerID: 1, PlayerID: 999}
			if err := store.CreateHero(ctx, deleted); err != nil {
				t.Fatal(err)
			}
			if err := store.DeleteHero(ctx, 1, deleted.HeroID); err != nil {
				t.Fatal(err)
			}
			svc := NewService()
			svc.UseStore(store)
			p := PlayerRef{ServerID: 1, PlayerID: 40}
			city := &stubHotelCity{hotelLevel: 3, officeLevel: 20, gold: 10000}
			inv := &memInventory{wallet: Resources{Food: 100000, Wood: 100000, Stone: 100000, Iron: 100000}, items: map[int32]int32{RecruitScrollID: 9}}
			check := func(h *Hero, err error) {
				t.Helper()
				if err != nil || h == nil || h.HeroID <= deleted.HeroID {
					t.Fatalf("creation identity: %+v %v", h, err)
				}
				got, err := store.GetHero(ctx, p.ServerID, h.HeroID)
				if err != nil || got == nil || got.PlayerID != p.PlayerID || got.Status != h.Status {
					t.Fatalf("reload: %+v %v", got, err)
				}
				deleted = h // Every subsequent creation must receive a fresh identity.
			}
			res, err := svc.RecruitPlayer(ctx, p, inv, RecruitRequest{TemplateCfgID: 1001})
			if backend == "memory" {
				check(res.Hero, err) // Memory identity only, not an atomic-spend assertion.
			} else if !errors.Is(err, ErrRecruitTransactionRequired) || res.Hero != nil {
				t.Fatalf("legacy PG recruit bypass: %+v %v", res, err)
			}
			if backend == "memory" {
				ps := &PlayerState{ServerID: p.ServerID, PlayerID: p.PlayerID, Wallet: inv.wallet, Items: inv.items}
				res, err = svc.RecruitAndPersist(ctx, ps, RecruitRequest{TemplateCfgID: 1002})
				check(res.Hero, err)
			}
			hs := &memHotelStore{rows: []*HotelCandidate{{CandidateID: 77, Level: 2, Loyalty: 70, DisplayName: "candidate"}}}
			hotel, err := svc.RecruitHotelCandidate(ctx, p, CityRef{CityID: 1}, hs, city, 77)
			check(hotel.Hero, err)
			h, err := svc.InjectComing(ctx, p, InjectComingInput{CityID: 1})
			check(h, err)
			if rec, err := svc.ComingStore.GetComing(ctx, p.ServerID, h.HeroID); err != nil || rec == nil {
				t.Fatalf("coming metadata ID: %+v %v", rec, err)
			}
			h, err = svc.InjectCaptive(ctx, p, InjectCaptiveInput{CityID: 1})
			check(h, err)
			if rec, err := svc.CaptiveStore.GetCaptive(ctx, p.ServerID, h.HeroID); err != nil || rec == nil {
				t.Fatalf("captive metadata ID: %+v %v", rec, err)
			}
			if err := svc.LionizeStore.Put(ctx, p.ServerID, p.PlayerID, 1003, LionizeRecord{State: LionizeStateBefriended, Friend: LionizeHireFriendMin}); err != nil {
				t.Fatal(err)
			}
			hire, err := svc.LionizeHero(ctx, p, CityRef{CityID: 1}, 1003, city)
			check(hire.Hero, err)
			got, err := store.GetHero(ctx, old.ServerID, old.HeroID)
			if err != nil || got == nil || got.PlayerID != old.PlayerID || got.DisplayName != old.DisplayName {
				t.Fatalf("old hero overwritten: %+v %v", got, err)
			}
		})
	}
}

func TestDurableRecruitAndPersistRejectsExternalState(t *testing.T) {
	svc := NewService()
	svc.UseStore(&PGStore{}) // Rejection must precede state mutation or database access.
	if _, err := svc.RecruitAndPersist(context.Background(), nil, RecruitRequest{}); !errors.Is(err, ErrRecruitTransactionRequired) {
		t.Fatalf("unsafe external-state path accepted: %v", err)
	}
}

func TestHeroUpdateOnlyAndOwnerTransfer(t *testing.T) {
	for _, backend := range []string{"memory", "postgres"} {
		t.Run(backend, func(t *testing.T) {
			var store Store = NewMemStore()
			if backend == "postgres" {
				store = identityStore(t)
			}
			ctx := context.Background()
			h := &Hero{ServerID: 1, HeroID: 777, PlayerID: 12}
			if err := store.SaveHero(ctx, h); !errors.Is(err, ErrHeroNotFound) {
				t.Fatalf("update created missing row: %v", err)
			}
			h.HeroID = 0
			if err := store.CreateHero(ctx, h); err != nil {
				t.Fatal(err)
			}
			id, created := h.HeroID, h.CreatedAt
			h.PlayerID, h.Status, h.Loyalty, h.Level, h.Exp, h.ForceAdd = 13, StatusIdle, 60, 2, 100, 1
			if err := store.SaveHero(ctx, h); err != nil {
				t.Fatal(err)
			}
			got, err := store.GetHero(ctx, 1, id)
			if err != nil || got == nil || got.PlayerID != 13 || got.Status != StatusIdle || got.ForceAdd != 1 || !got.CreatedAt.Equal(created) {
				t.Fatalf("owner/attribute transition changed identity: %+v %v", got, err)
			}
			h.ServerID = 2
			if err := store.SaveHero(ctx, h); !errors.Is(err, ErrHeroNotFound) {
				t.Fatalf("wrong-shard update: %v", err)
			}
		})
	}
}
