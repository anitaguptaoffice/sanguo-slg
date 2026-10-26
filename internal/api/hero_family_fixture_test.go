package api

import (
	"context"
	"testing"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

func familyPacket(route string, cityID, heroID int64, npcID int32) *commonv1.ClientPacket {
	var req proto.Message
	switch route {
	case RouteListComingHeroes:
		req = &herov1.ListComingHeroesRequest{ServerId: 1}
	case RouteTryAcceptComing:
		req = &herov1.TryAcceptComingRequest{ServerId: 1, CityId: cityID, HeroId: heroID}
	case RouteSureAcceptComing:
		req = &herov1.SureAcceptComingRequest{ServerId: 1, CityId: cityID, HeroId: heroID}
	case RouteRejectComing:
		req = &herov1.RejectComingRequest{ServerId: 1, CityId: cityID, HeroId: heroID}
	case RouteListCaptiveHeroes:
		req = &herov1.ListCaptiveHeroesRequest{ServerId: 1}
	case RouteTrySummonCaptive:
		req = &herov1.TrySummonCaptiveRequest{ServerId: 1, CityId: cityID, HeroId: heroID}
	case RouteSureSummonCaptive:
		req = &herov1.SureSummonCaptiveRequest{ServerId: 1, CityId: cityID, HeroId: heroID}
	case RouteReleaseCaptive:
		req = &herov1.ReleaseCaptiveRequest{ServerId: 1, CityId: cityID, HeroId: heroID}
	case RouteListPersuadeTargets:
		req = &herov1.ListPersuadeTargetsRequest{ServerId: 1}
	case RoutePersuadeHero:
		req = &herov1.PersuadeHeroRequest{ServerId: 1, CityId: cityID, NpcCfgId: npcID}
	case RouteLionizeHero:
		req = &herov1.LionizeHeroRequest{ServerId: 1, CityId: cityID, NpcCfgId: npcID}
	default:
		panic("unknown family test route")
	}
	return &commonv1.ClientPacket{Route: route, SessionId: "hotel", ServerId: 1, TraceId: "family-tx", Payload: mustProto(req)}
}

func familyDispatch(t *testing.T, s *Server, pkt *commonv1.ClientPacket, out proto.Message) {
	t.Helper()
	r := s.GatewayRouter().Dispatch(context.Background(), pkt)
	if r.Code != 0 {
		t.Fatalf("%s: %+v", pkt.Route, r)
	}
	if out != nil {
		if err := proto.Unmarshal(r.Data, out); err != nil {
			t.Fatal(err)
		}
	}
}

// familySeed is explicitly an injected fixture, not a natural capture/coming
// gameplay route. The existing HERO draft and insert-only metadata participants
// share actor/wallet/city serialization and one commit, never legacy Inject*.
func familySeed(t *testing.T, s *Server, status int16, city int64, level int32) *hero.Hero {
	t.Helper()
	ctx := context.Background()
	pc := PlayerContext{ServerID: 1, PlayerID: 7}
	p := hero.PlayerRef{ServerID: 1, PlayerID: 7}
	tx, err := s.players.Pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	var account int64
	if err = tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=1 AND player_id=7 FOR KEY SHARE`).Scan(&account); err != nil {
		t.Fatal(err)
	}
	if _, err = lockRecruitWallet(ctx, tx, pc); err != nil {
		t.Fatal(err)
	}
	if err = s.hotel.owner.LockCityOwnerInTx(ctx, tx, 1, city, 7); err != nil {
		t.Fatal(err)
	}
	var h *hero.Hero
	switch status {
	case hero.StatusComing:
		plan, e := s.heroSvc.PlanComingInjection(p, hero.InjectComingInput{CityID: city, Level: level, DisplayName: "offer", Force: 11, Intel: 12, Politics: 13, Command: 14})
		if e != nil {
			t.Fatal(e)
		}
		h = plan.Hero
		if err = s.heroSvc.Store.(*hero.PGStore).CreateHeroInTx(ctx, tx, h); err == nil {
			err = s.heroSvc.ComingStore.(*hero.PGComingStore).InsertComingInTx(ctx, tx, p, h.HeroID, plan.Record)
		}
	case hero.StatusCaptive:
		plan, e := s.heroSvc.PlanCaptiveInjection(p, hero.InjectCaptiveInput{CityID: city, Level: level, DisplayName: "captive", Force: 11, Intel: 12, Politics: 13, Command: 14})
		if e != nil {
			t.Fatal(e)
		}
		h = plan.Hero
		if err = s.heroSvc.Store.(*hero.PGStore).CreateHeroInTx(ctx, tx, h); err == nil {
			err = s.heroSvc.CaptiveStore.(*hero.PGCaptiveStore).InsertCaptiveInTx(ctx, tx, p, h.HeroID, plan.Record)
		}
	default:
		t.Fatal("unsupported fixture status")
	}
	if err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	return h
}

// Durable fixture observation only; neither this SQL nor candidate absence is a
// production lost-ack receipt. Sequence gaps after rollback are allowed.
func familyState(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var meta string
	err := pool.QueryRow(context.Background(), `SELECT jsonb_build_array(
		(SELECT jsonb_agg(c ORDER BY server_id,hero_id) FROM player_hero_coming c),
		(SELECT jsonb_agg(c ORDER BY server_id,hero_id) FROM player_hero_captive c),
		(SELECT jsonb_agg(l ORDER BY server_id,player_id,npc_cfg_id) FROM player_hero_lionize l))::text`).Scan(&meta)
	if err != nil {
		t.Fatal(err)
	}
	return hotelState(t, pool) + meta
}

func familyHeroState(t *testing.T, pool *pgxpool.Pool, id int64) (exists bool, status int16, meta int) {
	t.Helper()
	err := pool.QueryRow(context.Background(), `SELECT
		EXISTS(SELECT 1 FROM player_hero WHERE server_id=1 AND hero_id=$1),
		COALESCE((SELECT status FROM player_hero WHERE server_id=1 AND hero_id=$1),-1),
		(SELECT count(*) FROM player_hero_coming WHERE server_id=1 AND hero_id=$1) +
		(SELECT count(*) FROM player_hero_captive WHERE server_id=1 AND hero_id=$1)`, id).Scan(&exists, &status, &meta)
	if err != nil {
		t.Fatal(err)
	}
	return
}

func familyItemQty(t *testing.T, pool *pgxpool.Pool, id int32) int32 {
	t.Helper()
	var n int32
	if err := pool.QueryRow(context.Background(), `SELECT COALESCE((SELECT quantity FROM player_item WHERE server_id=1 AND player_id=7 AND item_cfg_id=$1),0)`, id).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func familyOwned(t *testing.T, pool *pgxpool.Pool) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM player_hero WHERE server_id=1 AND player_id=7 AND status NOT IN ($1,$2)`, hero.StatusComing, hero.StatusCaptive).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}
