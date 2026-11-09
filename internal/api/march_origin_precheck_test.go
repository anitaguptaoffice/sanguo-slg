package api

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
)

func originHero(t *testing.T, s *Server, now time.Time) *hero.Hero {
	t.Helper()
	s.SetClock(func() time.Time { return now })
	if s.heroSvc == nil {
		s.wireHeroService(nil)
		s.heroSvc.SetClock(s.now)
	}
	h := &hero.Hero{ServerID: 1, PlayerID: 55, TemplateCfgID: 1001, Level: 1, Status: hero.StatusIdle, CreatedAt: now}
	ctx := context.Background()
	if err := s.heroSvc.Store.CreateHero(ctx, h); err != nil {
		t.Fatal(err)
	}
	if err := s.heroSvc.Store.SaveMarchForceState(ctx, hero.MarchForceState{
		ServerID: 1, HeroID: h.HeroID, Current: hero.MarchForceMax(1), LastRegenAt: now,
	}); err != nil {
		t.Fatal(err)
	}
	// Initialize the legacy PG read columns before any full-row snapshot.
	stored, err := s.heroSvc.Store.GetHero(ctx, 1, h.HeroID)
	if err != nil || stored == nil {
		t.Fatalf("hero setup read: %v %v", stored, err)
	}
	return stored
}

func originPacket(cityID, heroID int64) *commonv1.ClientPacket {
	return &commonv1.ClientPacket{Route: RouteStartMarch, SessionId: "owner", ServerId: 1, TraceId: "origin",
		Payload: mustProto(&militaryv1.StartMarchRequest{CityId: cityID, HeroId: heroID, ToX: 10, ToY: 11, Purpose: 1,
			Troops: []*apicommon.CityTroopStack{{UnitCfgId: 1, Count: 5}}})}
}

func assertOriginRejected(t *testing.T, s *Server, pkt *commonv1.ClientPacket, heroID int64) {
	t.Helper()
	ctx := context.Background()
	h, err := s.heroSvc.Store.GetHero(ctx, 1, heroID)
	if err != nil {
		t.Fatal(err)
	}
	force, err := s.heroSvc.Store.GetMarchForceState(ctx, 1, heroID)
	if err != nil || force == nil {
		t.Fatalf("force fixture: %v %v", force, err)
	}
	var req militaryv1.StartMarchRequest
	if err := unmarshal(pkt.Payload, &req); err != nil {
		t.Fatal(err)
	}
	before := s.citySnapshot(req.CityId)
	mil := s.military.SnapshotCity(req.CityId)
	for i := 0; i < 3; i++ {
		out := s.GatewayRouter().Dispatch(ctx, pkt)
		if out.Code != 50005 || out.Msg != "city coordinates unknown" || out.TraceId != pkt.TraceId || len(out.Data) != 0 {
			t.Fatalf("missing origin response: %v", out)
		}
		got, err := s.heroSvc.Store.GetHero(ctx, 1, heroID)
		if err != nil || !reflect.DeepEqual(got, h) {
			t.Fatalf("rejection changed hero: %v %v", got, err)
		}
		gotForce, err := s.heroSvc.Store.GetMarchForceState(ctx, 1, heroID)
		if err != nil || !reflect.DeepEqual(gotForce, force) {
			t.Fatalf("rejection charged force: %v %v", gotForce, err)
		}
		if !reflect.DeepEqual(before, s.citySnapshot(req.CityId)) || !reflect.DeepEqual(mil, s.military.SnapshotCity(req.CityId)) ||
			s.nextArmyID != 0 || len(s.playerMarches) != 0 || len(s.marchHeroByID) != 0 {
			t.Fatal("rejection settled production or published military state")
		}
	}
}

func TestMarchOriginPrecheckRejectsWithoutEffects(t *testing.T) {
	for _, registered := range []bool{false, true} {
		name := "unregistered-military"
		if registered {
			name = "registered-military"
		}
		t.Run(name, func(t *testing.T) {
			s := garrisonServer(t)
			h := originHero(t, s, time.Unix(1700000000, 0))
			if registered {
				s.military.EnsureCity(&march.CityState{ID: 7, PlayerID: 55, Troops: map[int32]int32{1: 20}})
			}
			assertOriginRejected(t, s, originPacket(7, h.HeroID), h.HeroID)
		})
	}
}

func TestMarchOriginPrecheckPreservesValidationOrder(t *testing.T) {
	for _, tc := range []struct {
		name        string
		city, hero  int64
		unit, count int32
		code        commonv1.ErrorCode
	}{
		{"foreign-city", 8, 1, 1, 5, commonv1.ErrorCode_WORLD_CITY_NOT_FOUND},
		{"missing-hero", 7, 0, 1, 5, commonv1.ErrorCode(50005)},
		{"unknown-unit", 7, 1, 999, 5, commonv1.ErrorCode_MILITARY_INVALID_UNIT},
		{"invalid-count", 7, 1, 1, 0, commonv1.ErrorCode_MILITARY_INVALID_TROOP_COUNT},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := garrisonServer(t)
			pkt := originPacket(tc.city, tc.hero)
			pkt.Payload = mustProto(&militaryv1.StartMarchRequest{CityId: tc.city, HeroId: tc.hero,
				Troops: []*apicommon.CityTroopStack{{UnitCfgId: tc.unit, Count: tc.count}}})
			out := s.GatewayRouter().Dispatch(context.Background(), pkt)
			if out.Code != int32(tc.code) || out.Msg == "city coordinates unknown" || s.nextArmyID != 0 {
				t.Fatalf("earlier validation changed: %v", out)
			}
		})
	}
}

func assertOriginDispatch(t *testing.T, s *Server, cityID, heroID int64, x, y int) {
	t.Helper()
	ctx := context.Background()
	before, err := s.heroSvc.Store.GetMarchForceState(ctx, 1, heroID)
	if err != nil || before == nil {
		t.Fatalf("force fixture: %v %v", before, err)
	}
	s.SeedCityTroopsForTest(cityID, 1, 20)
	out := s.GatewayRouter().Dispatch(ctx, originPacket(cityID, heroID))
	var response militaryv1.StartMarchResponse
	if out.Code != 0 || unmarshal(out.Data, &response) != nil || response.March == nil {
		t.Fatalf("explicit retry: %v", out)
	}
	order, troops := s.military.SnapshotMarch(response.March.MarchId)
	if order == nil || order.FromX != x || order.FromY != y || order.ToX != 10 || order.ToY != 11 ||
		len(troops) != 1 || troops[0].Count != 5 || s.military.SnapshotCity(cityID).Troops[1] != 15 ||
		s.nextArmyID != 1 || len(s.playerMarches[55]) != 1 || len(s.marchHeroByID) != 1 {
		t.Fatalf("normal dispatch changed: %v %v", order, troops)
	}
	h, err := s.heroSvc.Store.GetHero(ctx, 1, heroID)
	if err != nil || h == nil || h.Status != hero.StatusMarch {
		t.Fatalf("hero not claimed: %v %v", h, err)
	}
	force, err := s.heroSvc.Store.GetMarchForceState(ctx, 1, heroID)
	if err != nil || force == nil || force.Current != before.Current-hero.MarchForceMarchCost {
		t.Fatalf("expected exactly one force charge: %v %v", force, err)
	}
}

func TestMarchOriginPrecheckAcceptsZeroCoordinates(t *testing.T) {
	for _, tc := range []struct {
		name  string
		coord cityCoord
	}{{"zero-zero", cityCoord{0, 0}}, {"zero-y", cityCoord{0, 7}}, {"x-zero", cityCoord{7, 0}}} {
		t.Run(tc.name, func(t *testing.T) {
			coord := tc.coord
			s := garrisonServer(t)
			h := originHero(t, s, time.Unix(1700000000, 0))
			s.cacheCityCoord(7, coord.x, coord.y)
			assertOriginDispatch(t, s, 7, h.HeroID, coord.x, coord.y)
		})
	}
}

// Only the first WORLD read fails. Subsequent calls use the actual PG store.
type originListingFailure struct {
	world.Store
	failed bool
}

func (s *originListingFailure) PlayerCities(ctx context.Context, sid int32, pid int64) ([]world.City, error) {
	if !s.failed {
		s.failed = true
		return nil, errors.New("initial city read unavailable")
	}
	return s.Store.PlayerCities(ctx, sid, pid)
}

func originRows(t *testing.T, pool *pgxpool.Pool) map[string]string {
	t.Helper()
	out := map[string]string{}
	for _, table := range []string{"player_city", "player_wallet", "city_production_checkpoint", "city_building", "work_queue", "player_hero", "hero_march_force", "field_army", "march_order", "army_troop"} {
		var rows string
		if err := pool.QueryRow(context.Background(), `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]')::text FROM `+table+` t`).Scan(&rows); err != nil {
			t.Fatal(err)
		}
		out[table] = rows
	}
	return out
}

func TestMarchOriginPrecheckPGLazyLoadRecovery(t *testing.T) {
	seed, pool, now, _ := registrationServer(t)
	ctx := context.Background()
	created, err := seed.handleCreateCity(ctx, registrationPacket(t, 1))
	var city worldv1.CreateCityResponse
	if err != nil || created == nil || created.Code != 0 || unmarshal(created.Data, &city) != nil || city.City == nil {
		t.Fatalf("real city setup: %v %v", created, err)
	}
	peer, err := pgxpool.NewWithConfig(ctx, pool.Config())
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	later := now.Add(time.Hour).Truncate(time.Microsecond)
	hub := domestic.NewHub(func() time.Time { return later })
	hub.UseStore(domestic.NewPGStore(peer), 1, 0)
	listing := &originListingFailure{Store: world.NewPGStore(peer)}
	fresh := NewServer(nil, peer, world.NewService(listing), hub, march.NewHub(func() time.Time { return later }))
	fresh.wireHeroService(peer)
	h := originHero(t, fresh, later)
	fresh.BindSession("owner", 1, 55, 0)
	id := city.City.CityId
	if !listing.failed || fresh.citySnapshot(id) != nil || len(fresh.cityCoords) != 0 {
		t.Fatal("failed hydration must leave an unloaded origin")
	}
	chief := fresh.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: RouteGetCityChief, SessionId: "owner", ServerId: 1,
		Payload: mustProto(&herov1.GetCityChiefRequest{ServerId: 1, CityId: id})})
	if chief.Code != 0 || fresh.citySnapshot(id) == nil || len(fresh.cityCoords) != 0 || fresh.military.SnapshotCity(id) != nil {
		t.Fatalf("actual chief read did not reproduce lazy DOM-only load: %v", chief)
	}
	before := originRows(t, pool) // Separate pool sees committed state, not the handler connection.
	assertOriginRejected(t, fresh, originPacket(id, h.HeroID), h.HeroID)
	if !reflect.DeepEqual(before, originRows(t, pool)) {
		t.Fatal("missing-origin rejection changed committed PG state")
	}
	fresh.hydratePlayerCities(ctx, PlayerContext{ServerID: 1, PlayerID: 55})
	coord, ok := fresh.cityCoordinate(id)
	if !ok || coord.x != int(city.City.X) || coord.y != int(city.City.Y) {
		t.Fatal("normal hydration did not restore actual WORLD coordinates")
	}
	assertOriginDispatch(t, fresh, id, h.HeroID, coord.x, coord.y)
}
