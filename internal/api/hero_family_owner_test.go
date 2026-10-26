package api

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
)

func TestFamilyAtomicPGOwnerUpdatesWaitAndRecheckIncludingLists(t *testing.T) {
	for _, route := range []string{RouteListComingHeroes, RouteListCaptiveHeroes, RouteTryAcceptComing, RouteSureAcceptComing, RouteRejectComing, RouteTrySummonCaptive, RouteSureSummonCaptive, RouteReleaseCaptive, RouteLionizeHero, RoutePersuadeHero} {
		for _, first := range []string{"family", "owner"} {
			t.Run(route+"/"+first, func(t *testing.T) {
				pool, s := hotelFixture(t)
				status := int16(hero.StatusComing)
				if strings.Contains(route, "Captive") {
					status = hero.StatusCaptive
				}
				heroID, city, ownerLocks := int64(0), int64(1), 1
				switch route {
				case RouteListComingHeroes, RouteListCaptiveHeroes:
					// Reverse hero creation order to ensure city locks are independently
					// sorted; the second city must also remain authorized through commit.
					familySeed(t, s, status, 2, 1)
					familySeed(t, s, status, 1, 1)
					city, ownerLocks = 2, 2
				case RouteLionizeHero:
				case RoutePersuadeHero:
					familyDispatch(t, s, familyPacket(RouteLionizeHero, 1, 0, 1003), nil)
				default:
					heroID = familySeed(t, s, status, 1, 1).HeroID
				}
				packet := familyPacket(route, 0, heroID, 1003)
				if route == RouteLionizeHero || route == RoutePersuadeHero {
					packet = familyPacket(route, 1, 0, 1003)
				}
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if first == "owner" {
					tx, err := pool.Begin(ctx)
					if err != nil {
						t.Fatal(err)
					}
					defer tx.Rollback(context.Background())
					if _, err = tx.Exec(ctx, `UPDATE player_city SET player_id=9 WHERE city_id=$1`, city); err != nil {
						t.Fatal(err)
					}
					before := familyState(t, pool)
					done := make(chan *commonv1.ServerPacket, 1)
					go func() { done <- s.GatewayRouter().Dispatch(ctx, packet) }()
					hotelWaitForLock(t, ctx, pool, "SELECT player_id FROM player_city%")
					if err = tx.Commit(ctx); err != nil {
						t.Fatal(err)
					}
					if r := <-done; r.Code != int32(commonv1.ErrorCode_COMMON_UNAUTHORIZED) || familyState(t, pool) != before {
						t.Fatalf("stale city owner accepted %+v", r)
					}
					return
				}
				locked, release := make(chan struct{}), make(chan struct{})
				var once sync.Once
				unblock := func() { once.Do(func() { close(release) }) }
				defer unblock()
				s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
					tx, err := pool.BeginTx(ctx, opts)
					if err != nil {
						return nil, err
					}
					seen := 0
					return &recruitObservedTx{Tx: tx, afterRow: func(q string) {
						if strings.Contains(q, "SELECT player_id FROM player_city") {
							seen++
							if seen == ownerLocks {
								close(locked)
								select {
								case <-release:
								case <-ctx.Done():
								}
							}
						}
					}}, nil
				}
				done := make(chan *commonv1.ServerPacket, 1)
				go func() { done <- s.GatewayRouter().Dispatch(ctx, packet) }()
				select {
				case <-locked:
				case <-ctx.Done():
					t.Fatal("family did not acquire owner locks", ctx.Err())
				}
				changed := make(chan error, 1)
				go func() {
					_, err := pool.Exec(ctx, `UPDATE player_city SET player_id=9 WHERE city_id=$1`, city)
					changed <- err
				}()
				hotelWaitForLock(t, ctx, pool, "UPDATE player_city SET player_id=9%")
				unblock()
				if r := <-done; r.Code != 0 {
					t.Fatalf("authorized family operation failed %+v", r)
				}
				if err := <-changed; err != nil {
					t.Fatal("owner update did not resume", err)
				}
			})
		}
	}
}

func TestFamilyAtomicPGDoesNotTakeHubWhileHoldingWallet(t *testing.T) {
	for _, route := range []string{RouteListCaptiveHeroes, RouteTrySummonCaptive, RouteSureSummonCaptive} {
		t.Run(route, func(t *testing.T) {
			pool, s := hotelFixture(t)
			h := familySeed(t, s, hero.StatusCaptive, 1, 1)
			recruitSQL(t, pool, `INSERT INTO city_production_checkpoint(server_id,city_id,player_id,settled_at) VALUES(1,1,7,$1)`, hotelTestNow)
			if _, err := s.domestic.LoadCity(context.Background(), 1, 7); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			begin, locked, release := familyWalletBarrier(ctx, pool)
			defer release()
			s.hotel.begin = begin
			done := make(chan *commonv1.ServerPacket, 1)
			go func() { done <- s.GatewayRouter().Dispatch(ctx, familyPacket(route, 1, h.HeroID, 0)) }()
			select {
			case <-locked:
			case <-ctx.Done():
				t.Fatal(ctx.Err())
			}
			writer := make(chan error, 1)
			go func() { _, err := s.domestic.SettleCity(ctx, 1); writer <- err }()
			hotelWaitForLock(t, ctx, pool, "SELECT food,wood,stone,iron FROM player_wallet%")
			release()
			if r := <-done; r.Code != 0 {
				t.Fatalf("Hub-wallet lock cycle %+v", r)
			}
			if err := <-writer; err != nil {
				t.Fatal("DOM writer did not resume", err)
			}
		})
	}
}
