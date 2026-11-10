package api

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

type marchClaimGate struct {
	hero.Store
	id              int64
	cleanup         bool
	afterClaim      func()
	entered, resume chan struct{}
	paused          atomic.Bool
	reads           atomic.Int32
}

func (g *marchClaimGate) pause(ctx context.Context) error {
	if !g.paused.CompareAndSwap(false, true) {
		return nil
	}
	close(g.entered)
	select {
	case <-g.resume:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (g *marchClaimGate) GetHero(ctx context.Context, sid int32, id int64) (*hero.Hero, error) {
	h, err := g.Store.GetHero(ctx, sid, id)
	if id == g.id {
		g.reads.Add(1)
		if !g.cleanup && err == nil && h != nil && h.Status == hero.StatusIdle {
			err = g.pause(ctx)
		}
	}
	return h, err
}

func (g *marchClaimGate) SaveHero(ctx context.Context, h *hero.Hero) error {
	if err := g.Store.SaveHero(ctx, h); err != nil {
		return err
	}
	if h.HeroID == g.id {
		if h.Status == hero.StatusMarch && g.afterClaim != nil {
			g.afterClaim()
		}
		if h.Status == hero.StatusIdle && g.cleanup {
			return g.pause(ctx)
		}
	}
	return nil
}

func inflightResult(t *testing.T, results <-chan *commonv1.ServerPacket) *commonv1.ServerPacket {
	t.Helper()
	select {
	case result := <-results:
		return result
	case <-time.After(10 * time.Second):
		t.Fatal("march request did not finish")
		return nil
	}
}

func pausedMarch(t *testing.T, s *Server, ctx context.Context, pkt *commonv1.ClientPacket, gate *marchClaimGate) (<-chan *commonv1.ServerPacket, func()) {
	t.Helper()
	ctx, cancel := context.WithCancel(ctx)
	gate.entered, gate.resume = make(chan struct{}), make(chan struct{})
	s.heroSvc.Store = gate
	results, done := make(chan *commonv1.ServerPacket, 1), make(chan struct{})
	var once sync.Once
	resume := func() { once.Do(func() { close(gate.resume) }) }
	go func() {
		defer close(done)
		results <- s.GatewayRouter().Dispatch(ctx, pkt)
	}()
	t.Cleanup(func() {
		resume()
		cancel()
		waitMarchIndexWorkers(t, done)
	})
	waitMarchIndexWorkers(t, gate.entered)
	return results, resume
}

func assertInflightEmpty(t *testing.T, s *Server) {
	t.Helper()
	s.marchIndexMu.RLock()
	defer s.marchIndexMu.RUnlock()
	if len(s.marchStarting) != 0 {
		t.Fatal("handler retained an in-flight marker")
	}
}

func inflightCall(t *testing.T, s *Server, pkt *commonv1.ClientPacket, release func()) *commonv1.ServerPacket {
	t.Helper()
	results := make(chan *commonv1.ServerPacket, 1)
	go func() { results <- s.GatewayRouter().Dispatch(context.Background(), pkt) }()
	select {
	case out := <-results:
		return out
	case <-time.After(10 * time.Second):
		release()
		_ = inflightResult(t, results)
		t.Fatal("request waited for an unrelated paused operation")
		return nil
	}
}

func assertInflightBusy(t *testing.T, s *Server, pkt *commonv1.ClientPacket, release func()) {
	t.Helper()
	out := inflightCall(t, s, pkt, release)
	if out.Code != 50005 || out.Msg != "hero march request in progress" || out.TraceId != pkt.TraceId || len(out.Data) != 0 {
		t.Fatalf("overlap was not rejected before the paused operation: %v", out)
	}
}

// Shared actual-handler flow; the PG caller supplies real committed HERO storage.
func exerciseMarchInflight(t *testing.T, s *Server, cityID, first, other int64) {
	t.Helper()
	s.SeedCityTroopsForTest(cityID, 1, 30)
	pkt := originPacket(cityID, first)
	gate := &marchClaimGate{Store: s.heroSvc.Store, id: first}
	results, resume := pausedMarch(t, s, context.Background(), pkt, gate)
	for i := 0; i < 16; i++ {
		assertInflightBusy(t, s, pkt, resume)
	}
	if gate.reads.Load() != 1 || s.nextArmyID != 0 || s.military.SnapshotCity(cityID).Troops[1] != 30 {
		t.Fatal("overlap crossed the first HERO read or debited troops")
	}
	if out := inflightCall(t, s, originPacket(cityID, other), resume); out.Code != 0 {
		t.Fatalf("unrelated hero was blocked: %v", out)
	}
	resume()
	if out := inflightResult(t, results); out.Code != 0 {
		t.Fatalf("first dispatch failed: %v", out)
	}
	assertInflightEmpty(t, s)
	for _, id := range []int64{first, other} {
		force, err := gate.Store.GetMarchForceState(context.Background(), 1, id)
		if err != nil || force == nil || force.Current != hero.MarchForceMax(1)-hero.MarchForceMarchCost {
			t.Fatalf("wrong one-time force charge: %v %v", force, err)
		}
	}
	rows, total := s.listPlayerMarches(55, cityID, 100, 0)
	if total != 2 || len(rows) != 2 || rows[0].heroID != other || rows[1].heroID != first || s.military.SnapshotCity(cityID).Troops[1] != 20 {
		t.Fatal("overlap published extra armies or changed their owners")
	}
	if out := s.GatewayRouter().Dispatch(context.Background(), pkt); out.Code != 50005 || out.Msg != hero.ErrHeroNotIdle.Error() {
		t.Fatalf("active HERO status rejection changed: %v", out)
	}
	assertInflightEmpty(t, s)
	last := s.military.March(2)
	if s.military.Scheduler().PollDue(last.ArriveAt.Add(time.Hour)) != 2 {
		t.Fatal("actual MIL completion did not release both heroes")
	}
	if out := s.GatewayRouter().Dispatch(context.Background(), pkt); out.Code != 0 {
		t.Fatalf("completed hero could not explicitly dispatch again: %v", out)
	}
	if s.nextArmyID != 3 || s.military.SnapshotCity(cityID).Troops[1] != 15 {
		t.Fatal("explicit redispatch changed admission or troop debit")
	}
	assertInflightEmpty(t, s)
}

func TestMarchClaimInflightGateway(t *testing.T) {
	s := garrisonServer(t)
	first := originHero(t, s, time.Unix(1700000000, 0))
	other := originHero(t, s, time.Unix(1700000000, 0))
	s.cacheCityCoord(7, 0, 0)
	exerciseMarchInflight(t, s, 7, first.HeroID, other.HeroID)
}

func TestMarchClaimInflightKeys(t *testing.T) {
	var s Server
	pc := PlayerContext{ServerID: 1, PlayerID: 55}
	results := make(chan bool, 32)
	for i := 0; i < cap(results); i++ {
		go func() { results <- s.beginMarchStart(pc, 1) }()
	}
	winners := 0
	for i := 0; i < cap(results); i++ {
		select {
		case won := <-results:
			if won {
				winners++
			}
		case <-time.After(10 * time.Second):
			t.Fatal("in-flight key acquisition did not finish")
		}
	}
	if winners != 1 {
		t.Fatalf("concurrent first-use winners=%d", winners)
	}
	for _, key := range []marchStartKey{{2, 55, 1}, {1, 56, 1}, {1, 55, 2}} {
		actor := PlayerContext{ServerID: key.serverID, PlayerID: key.playerID}
		if !s.beginMarchStart(actor, key.heroID) {
			t.Fatal("independent namespace was blocked")
		}
		s.endMarchStart(actor, key.heroID)
	}
	s.endMarchStart(pc, 1)
	assertInflightEmpty(t, &s)
}

func TestMarchClaimInflightCleanup(t *testing.T) {
	for _, canceled := range []bool{false, true} {
		t.Run(map[bool]string{false: "ordinary", true: "canceled"}[canceled], func(t *testing.T) {
			s := garrisonServer(t)
			h := originHero(t, s, time.Unix(1700000000, 0))
			s.cacheCityCoord(7, 0, 0)
			s.SeedCityTroopsForTest(7, 1, 4)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			gate := &marchClaimGate{Store: s.heroSvc.Store, id: h.HeroID, cleanup: true}
			if canceled {
				gate.afterClaim = cancel
			}
			pkt := originPacket(7, h.HeroID)
			results, resume := pausedMarch(t, s, ctx, pkt, gate)
			// HERO is already idle, but cleanup has not returned.
			assertInflightBusy(t, s, pkt, resume)
			resume()
			if out := inflightResult(t, results); out.Code != 50006 || (canceled && ctx.Err() == nil) {
				t.Fatalf("rejected cleanup changed: %v %v", out, ctx.Err())
			}
			assertInflightEmpty(t, s)
			gate.afterClaim = nil
			s.SeedCityTroopsForTest(7, 1, 10)
			if out := s.GatewayRouter().Dispatch(context.Background(), pkt); out.Code != 0 {
				t.Fatalf("cleanup blocked later explicit dispatch: %v", out)
			}
			assertInflightEmpty(t, s)
		})
	}
}

func TestMarchClaimInflightFailedClaim(t *testing.T) {
	for _, unknown := range []bool{false, true} {
		t.Run(map[bool]string{false: "read-failure", true: "unknown-save"}[unknown], func(t *testing.T) {
			s := garrisonServer(t)
			h := originHero(t, s, time.Unix(1700000000, 0))
			s.cacheCityCoord(7, 0, 0)
			store := &marchCleanupStore{Store: s.heroSvc.Store, t: t}
			if unknown {
				store.claimSaveErr = errors.New("unconfirmed claim")
			} else {
				store.claimReadErr = errors.New("unavailable claim")
			}
			s.heroSvc.Store = store
			out := s.GatewayRouter().Dispatch(context.Background(), originPacket(7, h.HeroID))
			if out.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || s.nextArmyID != 0 {
				t.Fatalf("failed claim crossed creation: %v", out)
			}
			assertMarchCleanupEnded(t, store, 0, 0)
			assertInflightEmpty(t, s)
		})
	}
}
