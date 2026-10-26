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
	"github.com/jackc/pgx/v5/pgxpool"
)

func familyWalletBarrier(ctx context.Context, pool *pgxpool.Pool) (func(context.Context, pgx.TxOptions) (pgx.Tx, error), <-chan struct{}, func()) {
	locked, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	begin := func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
		tx, err := pool.BeginTx(ctx, opts)
		if err != nil {
			return nil, err
		}
		return &recruitObservedTx{Tx: tx, afterRow: func(q string) {
			if strings.Contains(q, "SELECT food,wood,stone,iron,gold FROM player_wallet") {
				close(locked)
				select {
				case <-release:
				case <-ctx.Done():
				}
			}
		}}, nil
	}
	return begin, locked, func() { once.Do(func() { close(release) }) }
}

// Natural template recruitment deliberately has no office-capacity gate. These
// observed SQL lock waits prove serialization, not a universal capacity ceiling.
// Only the template recruitment here is naturally reached; coming/captive offers
// and ready-to-hire friend values are explicit transaction/SQL fixtures.
func TestFamilyAtomicPGOrdersNaturalWithoutInventingCapacityRule(t *testing.T) {
	for _, kind := range []string{"coming", "captive", "hire"} {
		for _, first := range []string{"family", "natural"} {
			t.Run(kind+"/"+first, func(t *testing.T) {
				pool, f := hotelFixture(t)
				n := hotelPeer(t, pool)
				n.sessions.Bind("recruit", PlayerContext{ServerID: 1, PlayerID: 7})
				var packet *commonv1.ClientPacket
				var gold int64
				switch kind {
				case "coming":
					h := familySeed(t, f, hero.StatusComing, 1, 1)
					packet = familyPacket(RouteSureAcceptComing, 1, h.HeroID, 0)
				case "captive":
					h := familySeed(t, f, hero.StatusCaptive, 1, 1)
					packet, gold = familyPacket(RouteSureSummonCaptive, 1, h.HeroID, 0), hero.HeroSummonGold(h)
				case "hire":
					familyDispatch(t, f, familyPacket(RouteLionizeHero, 1, 0, 1003), nil)
					recruitSQL(t, pool, `UPDATE player_hero_lionize SET friend=$1`, hero.LionizeHireFriendMin)
					packet = familyPacket(RouteLionizeHero, 1, 0, 1003)
				}
				recruitSQL(t, pool, `UPDATE city_building SET level=1 WHERE building_cfg_id=1`)
				before := readRecruitAssets(t, pool, 7)
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				firstPool := pool
				if first == "natural" {
					firstPool = n.players.Pool
				}
				begin, locked, release := familyWalletBarrier(ctx, firstPool)
				defer release()
				fd, nd := make(chan *commonv1.ServerPacket, 1), make(chan *commonv1.ServerPacket, 1)
				if first == "family" {
					f.hotel.begin = begin
					go func() { fd <- f.GatewayRouter().Dispatch(ctx, packet) }()
				} else {
					n.recruit.begin = begin
					go func() { nd <- n.GatewayRouter().Dispatch(ctx, recruitPacket(1001)) }()
				}
				select {
				case <-locked:
				case <-ctx.Done():
					t.Fatal("first transaction did not lock wallet", ctx.Err())
				}
				if first == "family" {
					go func() { nd <- n.GatewayRouter().Dispatch(ctx, recruitPacket(1001)) }()
				} else {
					go func() { fd <- f.GatewayRouter().Dispatch(ctx, packet) }()
				}
				hotelWaitForLock(t, ctx, pool, "SELECT food,wood,stone,iron,gold FROM player_wallet%")
				release()
				family, natural := <-fd, <-nd
				want, owned := before, 1
				tpl := n.heroSvc.Catalog[1001]
				if !want.Wallet.Sub(tpl.RecruitCost) {
					t.Fatal("natural fixture budget")
				}
				want.Books -= int(tpl.RecruitItem.Quantity)
				want.Heroes++
				if first == "family" {
					owned++
					want.Wallet.Gold -= gold
					if kind == "hire" {
						want.Heroes++
					}
				}
				if natural.Code != 0 || (family.Code == 0) != (first == "family") || familyOwned(t, pool) != owned || readRecruitAssets(t, pool, 7) != want {
					t.Fatalf("wrong ordering/capacity/debit family=%+v natural=%+v assets=%+v want=%+v", family, natural, readRecruitAssets(t, pool, 7), want)
				}
			})
		}
	}
}
