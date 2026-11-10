package api

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

type marchCleanupKey struct{}

// The wrapper delegates real HERO mutations, then interrupts only the request.
// It also makes the memory store obey the context that PostgreSQL already uses.
type marchCleanupStore struct {
	hero.Store
	t                             *testing.T
	afterClaim                    func()
	claimReadErr, claimSaveErr     error
	releaseReadErr, releaseSaveErr error
	claimed                       bool
	reads, saves                  int
	cleanup                       context.Context
}

func (s *marchCleanupStore) GetHero(ctx context.Context, sid int32, id int64) (*hero.Hero, error) {
	if s.claimed {
		s.reads++
		s.cleanup = ctx
		deadline, ok := ctx.Deadline()
		remaining := time.Until(deadline)
		if ctx.Err() != nil || !ok || remaining <= 0 || remaining > 5*time.Second || ctx.Value(marchCleanupKey{}) != "request" {
			s.t.Errorf("cleanup context lost independent deadline or request value: %v %v", ctx.Err(), remaining)
		}
		if s.releaseReadErr != nil {
			return nil, s.releaseReadErr
		}
	} else if s.claimReadErr != nil {
		return nil, s.claimReadErr
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return s.Store.GetHero(ctx, sid, id)
}

func (s *marchCleanupStore) SaveHero(ctx context.Context, h *hero.Hero) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if h.Status == hero.StatusIdle {
		s.saves++
		if ctx != s.cleanup {
			s.t.Error("cleanup save changed context")
		}
		if s.releaseSaveErr != nil {
			return s.releaseSaveErr
		}
	}
	if err := s.Store.SaveHero(ctx, h); err != nil {
		return err
	}
	if h.Status == hero.StatusMarch {
		s.claimed = true
		if s.afterClaim != nil {
			s.afterClaim()
		}
		// Simulate an applied claim whose acknowledgement is unavailable.
		return s.claimSaveErr
	}
	return nil
}

func assertMarchCleanupEnded(t *testing.T, store *marchCleanupStore, reads, saves int) {
	t.Helper()
	if store.reads != reads || store.saves != saves {
		t.Fatalf("cleanup calls read/save=%d/%d want=%d/%d", store.reads, store.saves, reads, saves)
	}
	if reads > 0 && (store.cleanup == nil || !errors.Is(store.cleanup.Err(), context.Canceled)) {
		t.Fatal("cleanup timer/context was not canceled after dispatch")
	}
	if reads == 0 && store.cleanup != nil {
		t.Fatal("unexpected cleanup context")
	}
}

func TestMarchRejectedClaimCleanup(t *testing.T) {
	for _, tc := range []struct {
		name                                string
		cancel, readFail, saveFail           bool
		claimReadFail, claimUnknown, success bool
		reads, saves                        int
	}{
		{name: "canceled-rejection", cancel: true, reads: 1, saves: 1},
		{name: "ordinary-rejection", reads: 1, saves: 1},
		{name: "cleanup-read-failure", cancel: true, readFail: true, reads: 1},
		{name: "cleanup-save-failure", cancel: true, saveFail: true, reads: 1, saves: 1},
		{name: "claim-read-failure", claimReadFail: true},
		{name: "unknown-claim-save", cancel: true, claimUnknown: true},
		{name: "canceled-success", cancel: true, success: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := garrisonServer(t)
			h := originHero(t, s, time.Unix(1700000000, 0))
			s.cacheCityCoord(7, 0, 0)
			ready := int32(4)
			if tc.success {
				ready = 8
			}
			s.SeedCityTroopsForTest(7, 1, ready)
			ctx, cancel := context.WithCancel(context.WithValue(context.Background(), marchCleanupKey{}, "request"))
			defer cancel()
			store := &marchCleanupStore{Store: s.heroSvc.Store, t: t}
			failure := errors.New("injected store failure")
			if tc.cancel {
				store.afterClaim = cancel
			}
			if tc.readFail {
				store.releaseReadErr = failure
			}
			if tc.saveFail {
				store.releaseSaveErr = failure
			}
			if tc.claimReadFail {
				store.claimReadErr = failure
			}
			if tc.claimUnknown {
				store.claimSaveErr = failure
			}
			s.heroSvc.Store = store
			pkt := originPacket(7, h.HeroID)
			out := s.GatewayRouter().Dispatch(ctx, pkt)
			wantCode, wantStatus := int32(50006), hero.StatusIdle
			if tc.claimReadFail || tc.claimUnknown {
				wantCode = int32(commonv1.ErrorCode_COMMON_INTERNAL)
			}
			if tc.readFail || tc.saveFail || tc.claimUnknown || tc.success {
				wantStatus = hero.StatusMarch
			}
			if tc.success {
				wantCode = 0
				ready -= 5
			}
			if out.Code != wantCode || out.TraceId != pkt.TraceId || (wantCode != 0 && len(out.Data) != 0) {
				t.Fatalf("original response changed: %v", out)
			}
			if wantCode == 50006 && out.Msg != "insufficient troops" {
				t.Fatalf("original MIL rejection changed: %v", out)
			}
			if tc.cancel && !errors.Is(ctx.Err(), context.Canceled) {
				t.Fatal("request interruption did not occur")
			}
			assertMarchCleanupEnded(t, store, tc.reads, tc.saves)
			got, err := store.Store.GetHero(context.Background(), 1, h.HeroID)
			if err != nil || got == nil || got.Status != wantStatus {
				t.Fatalf("hero status=%v want=%d err=%v", got, wantStatus, err)
			}
			force, err := store.Store.GetMarchForceState(context.Background(), 1, h.HeroID)
			wantForce := hero.MarchForceMax(1) - hero.MarchForceMarchCost
			if tc.claimReadFail {
				wantForce = hero.MarchForceMax(1)
			}
			if err != nil || force == nil || force.Current != wantForce || s.military.SnapshotCity(7).Troops[1] != ready {
				t.Fatalf("unexpected force or ready troop effects: %v %v", force, err)
			}
			order, troops := s.military.SnapshotMarch(1)
			if tc.success {
				binding, ok := s.lookupMarchHero(1)
				if order == nil || len(troops) != 1 || troops[0].Count != 5 || !ok || binding.heroID != h.HeroID || len(s.playerMarches[55]) != 1 {
					t.Fatal("successful dispatch lost march or binding")
				}
			} else if order != nil || len(s.playerMarches) != 0 || len(s.marchHeroByID) != 0 {
				t.Fatal("rejected dispatch published a march or binding")
			}
			if (tc.claimReadFail || tc.claimUnknown) && s.nextArmyID != 0 {
				t.Fatal("failed claim continued to CreateMarch")
			}
		})
	}
}
