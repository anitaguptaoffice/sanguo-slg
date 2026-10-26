package api

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

func TestRecruitAtomicPGConcurrentBudget(t *testing.T) {
	for _, kind := range []string{"same-template", "different-resources", "different-books", "random-books"} {
		t.Run(kind, func(t *testing.T) {
			pool := walletBoundaryPool(t, true)
			s1, s2 := recruitServer(t, pool, 7), recruitServer(t, pool, 7)
			templates := []int32{1001, 1002}
			wallet := hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 999}
			books := 2
			switch kind {
			case "same-template":
				templates[1] = 1001
			case "different-resources":
				a, b := s1.heroSvc.Catalog[1001].RecruitCost, s1.heroSvc.Catalog[1002].RecruitCost
				wallet = hero.Resources{Food: max(a.Food, b.Food), Wood: max(a.Wood, b.Wood), Stone: max(a.Stone, b.Stone), Iron: max(a.Iron, b.Iron), Gold: 999}
			case "different-books":
				books = 1
			case "random-books":
				books = 1
				templates = []int32{0, 0}
			}
			seedRecruitActor(t, pool, 7, wallet, books)
			before := readRecruitAssets(t, pool, 7)
			start := make(chan struct{})
			results := make(chan *commonv1.ServerPacket, 2)
			for i, s := range []*Server{s1, s2} {
				go func(s *Server, id int32) {
					<-start
					results <- s.GatewayRouter().Dispatch(context.Background(), recruitPacket(id))
				}(s, templates[i])
			}
			close(start)
			successes := 0
			want := before
			for i := 0; i < 2; i++ {
				resp := <-results
				if resp.Code == 0 {
					out := recruitReply(t, resp)
					successes++
					tpl := s1.heroSvc.Catalog[out.TemplateCfgId]
					if !want.Wallet.Sub(tpl.RecruitCost) {
						t.Fatal("overspend")
					}
					want.Books -= int(tpl.RecruitItem.Quantity)
					want.Heroes++
				} else if resp.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) {
					t.Fatalf("unstable rejection: %+v", resp)
				}
			}
			if successes != 1 {
				t.Fatalf("successes=%d", successes)
			}
			if after := readRecruitAssets(t, pool, 7); after != want {
				t.Fatalf("budget mismatch: %+v want %+v", after, want)
			}
		})
	}
}

func TestRecruitAtomicPGAcrossPlayersUniqueIdentity(t *testing.T) {
	pool := walletBoundaryPool(t, true)
	const n = 8
	servers := make([]*Server, n)
	for i := range servers {
		id := int64(i + 7)
		seedRecruitActor(t, pool, id, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000}, 1)
		servers[i] = recruitServer(t, pool, id)
	}
	start := make(chan struct{})
	results := make(chan *commonv1.ServerPacket, n)
	for _, s := range servers {
		go func(s *Server) {
			<-start
			results <- s.GatewayRouter().Dispatch(context.Background(), recruitPacket(1001))
		}(s)
	}
	close(start)
	ids := map[int64]bool{}
	for i := 0; i < n; i++ {
		out := recruitReply(t, <-results)
		if ids[out.HeroId] || out.HeroId <= 0 {
			t.Fatalf("collision: %d", out.HeroId)
		}
		ids[out.HeroId] = true
	}
	for i := range servers {
		if a := readRecruitAssets(t, pool, int64(i+7)); a.Heroes != 1 || a.Books != 0 {
			t.Fatalf("player%d assets %+v", i, a)
		}
	}
}

func TestRecruitAtomicPGStaleServicesRemoveGrantRace(t *testing.T) {
	pool := walletBoundaryPool(t, true)
	seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 123}, 2)
	s1, s2 := recruitServer(t, pool, 7), recruitServer(t, pool, 7)
	p := content.PlayerRef{ServerID: 1, PlayerID: 7}
	for _, s := range []*Server{s1, s2} {
		if err := s.contentSvc.LoadPlayer(context.Background(), p); err != nil {
			t.Fatal(err)
		}
	}
	// Both caches show two, but durable stock has already changed independently.
	if _, err := s2.contentSvc.Grant(p, content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2004, Qty: 1}}}, "before-race"); err != nil {
		t.Fatal(err)
	}
	before := readRecruitAssets(t, pool, 7)
	start := make(chan struct{})
	errs := make(chan error, 3)
	var wg sync.WaitGroup
	work := []func() error{
		func() error {
			resp := s1.GatewayRouter().Dispatch(context.Background(), recruitPacket(1001))
			if resp.Code != 0 {
				return fmt.Errorf("recruit: %+v", resp)
			}
			return nil
		},
		func() error { _, err := s2.contentSvc.Remove(p, 2004, 2); return err },
		func() error {
			_, err := s1.contentSvc.Grant(p, content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2004, Qty: 3}}}, "race-grant")
			return err
		},
	}
	for _, f := range work {
		wg.Add(1)
		go func(f func() error) { defer wg.Done(); <-start; errs <- f() }(f)
	}
	close(start)
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	want := before
	want.Wallet.Sub(s1.heroSvc.Catalog[1001].RecruitCost)
	want.Heroes++ // -1 book -2 Remove +3 Grant = unchanged.
	if after := readRecruitAssets(t, pool, 7); after != want {
		t.Fatalf("stale-cache overwrite: %+v want %+v", after, want)
	}
	for _, s := range []*Server{s1, s2, recruitServer(t, pool, 7)} {
		if err := s.contentSvc.LoadPlayer(context.Background(), p); err != nil {
			t.Fatal(err)
		}
		if bag := s.contentSvc.List(p); len(bag) != 1 || bag[0].Quantity != int32(want.Books) {
			t.Fatalf("refresh: %+v", bag)
		}
	}
}
