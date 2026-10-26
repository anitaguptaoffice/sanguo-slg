package api

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
)

func TestFamilyAtomicPGRejectsActorScopeAndRewiredMetadata(t *testing.T) {
	for _, kind := range []string{"actor", "account", "wallet", "dependencies", "coming-memory", "captive-memory", "lionize-memory", "coming-replaced", "captive-replaced", "lionize-replaced", "coming-pool", "captive-pool", "lionize-pool", "api-pool", "hero-pool", "world-pool", "item-pool", "domestic-shard", "packet-shard", "payload-shard"} {
		t.Run(kind, func(t *testing.T) {
			pool, s, pkt := familyFailureFixture(t, "summon")
			peer := hotelPeer(t, pool).players.Pool
			switch kind {
			case "actor":
				recruitSQL(t, pool, `DELETE FROM player`)
			case "account":
				s.sessions.Bind("hotel", PlayerContext{ServerID: 1, PlayerID: 7, AccountID: 999})
			case "wallet":
				recruitSQL(t, pool, `DELETE FROM player_wallet`)
			case "dependencies":
				s.family = nil
			case "coming-memory":
				s.heroSvc.ComingStore = hero.NewMemComingStore()
			case "captive-memory":
				s.heroSvc.CaptiveStore = hero.NewMemCaptiveStore()
			case "lionize-memory":
				s.heroSvc.LionizeStore = hero.NewMemLionizeStore()
			case "coming-replaced":
				s.heroSvc.ComingStore = hero.NewPGComingStore(pool)
			case "captive-replaced":
				s.heroSvc.CaptiveStore = hero.NewPGCaptiveStore(pool)
			case "lionize-replaced":
				s.heroSvc.LionizeStore = hero.NewPGLionizeStore(pool)
			case "coming-pool":
				s.family.coming.Pool = peer
			case "captive-pool":
				s.family.captive.Pool = peer
			case "lionize-pool":
				s.family.lionize.Pool = peer
			case "api-pool":
				s.players.Pool = peer
			case "hero-pool":
				s.hotel.heroes.Pool = peer
			case "world-pool":
				s.hotel.owner.Pool = peer
			case "item-pool":
				s.hotel.itemStore.Pool = peer
			case "domestic-shard":
				s.domestic.UseStore(nil, 2, 0)
			}
			before := familyState(t, pool)
			for _, route := range []string{RouteListComingHeroes, RouteTryAcceptComing, RouteSureAcceptComing, RouteRejectComing, RouteListCaptiveHeroes, RouteTrySummonCaptive, RouteSureSummonCaptive, RouteReleaseCaptive, RouteListPersuadeTargets, RoutePersuadeHero, RouteLionizeHero} {
				p := familyPacket(route, 1, 1000, hero.DefaultPersuadeTargets()[0].NpcCfgID)
				if route == RouteSureSummonCaptive {
					p = pkt
				}
				if kind == "packet-shard" {
					p.ServerId = 2
				}
				if kind == "payload-shard" {
					p.Payload[1] = 2
				}
				r := s.GatewayRouter().Dispatch(context.Background(), p)
				if r.Code == 0 || familyState(t, pool) != before {
					t.Fatalf("%s accepted unavailable identity %+v", route, r)
				}
			}
		})
	}
}

func TestFamilyAtomicPGMetadataSchemaMissingHasNoLazyDDLFallback(t *testing.T) {
	for _, tc := range []struct{ op, table string }{{"accept", "player_hero_coming"}, {"summon", "player_hero_captive"}, {"befriend", "player_hero_lionize"}} {
		t.Run(tc.op, func(t *testing.T) {
			pool, s, pkt := familyFailureFixture(t, tc.op)
			recruitSQL(t, pool, "ALTER TABLE "+tc.table+" RENAME TO absent_metadata")
			before := hotelState(t, pool)
			r := s.GatewayRouter().Dispatch(context.Background(), pkt)
			var exists bool
			if e := pool.QueryRow(context.Background(), `SELECT to_regclass($1) IS NOT NULL`, tc.table).Scan(&exists); e != nil {
				t.Fatal(e)
			}
			if r.Code == 0 || strings.Contains(r.Msg, tc.table) || exists || hotelState(t, pool) != before {
				t.Fatalf("metadata fallback %+v exists=%v", r, exists)
			}
		})
	}
}

func TestFamilyAtomicPGOnlyCallerConnectionBeforeCommit(t *testing.T) {
	for _, op := range []string{"accept", "reject", "preview", "summon", "release", "befriend", "persuade", "hire"} {
		t.Run(op, func(t *testing.T) {
			pool, s, pkt := familyFailureFixture(t, op)
			var start, finish int64
			s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				tx, e := pool.BeginTx(ctx, opts)
				if e != nil {
					return nil, e
				}
				start = pool.Stat().AcquireCount()
				return &recruitObservedTx{Tx: tx, beforeCommit: func() { finish = pool.Stat().AcquireCount() }}, nil
			}
			familyDispatch(t, s, pkt, nil)
			if start == 0 || start != finish {
				t.Fatalf("participant queried pool while holding tx: %d -> %d", start, finish)
			}
		})
	}
}

func TestFamilyErrorsNeverExposePrivateFailures(t *testing.T) {
	for _, err := range []error{errors.New("private SQL schema"), hero.ErrInvalidFamilyState, errFamilyOutcome} {
		for _, mapErr := range []func(string, error) *commonv1.ServerPacket{comingErr, captiveErr, persuadeErr} {
			r := mapErr("trace", err)
			if r.Code == 0 || strings.Contains(r.Msg, "SQL") || strings.Contains(r.Msg, "rollback") || strings.Contains(r.Msg, "not charged") || len(r.Data) != 0 {
				t.Fatalf("unsafe response %+v", r)
			}
		}
	}
	s := &Server{heroSvc: hero.NewService()}
	err := s.familyAtomic(context.Background(), PlayerContext{ServerID: 1, PlayerID: 7}, "test", func(*familyTx) error { t.Fatal("memory callback ran"); return nil })
	if !errors.Is(err, hero.ErrFamilyTransactionRequired) {
		t.Fatal(err)
	}
}
