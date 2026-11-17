package api

import (
	"context"
	"reflect"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMarchRejectedClaimCleanupPG(t *testing.T) {
	s, pool, now, _ := registrationServer(t)
	background := context.Background()
	created, err := s.handleCreateCity(background, registrationPacket(t, 1))
	var city worldv1.CreateCityResponse
	if err != nil || created == nil || created.Code != 0 || unmarshal(created.Data, &city) != nil || city.City == nil {
		t.Fatalf("real city setup: %v %v", created, err)
	}
	s.wireHeroService(pool)
	h := originHero(t, s, now)
	cityID := city.City.CityId
	s.SeedCityTroopsForTest(cityID, 1, 4)
	peer, err := pgxpool.NewWithConfig(background, pool.Config())
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	before := originRows(t, peer)
	ctx, cancel := context.WithCancel(context.WithValue(background, marchCleanupKey{}, "request"))
	defer cancel()
	store := &marchCleanupStore{Store: s.heroSvc.Store, t: t, afterClaim: cancel}
	s.heroSvc.Store = store
	pkt := originPacket(cityID, h.HeroID)
	out := s.GatewayRouter().Dispatch(ctx, pkt)
	if out.Code != 50006 || out.Msg != "insufficient troops" || out.TraceId != pkt.TraceId || len(out.Data) != 0 || ctx.Err() != context.Canceled {
		t.Fatalf("real rejected/canceled dispatch: %v %v", out, ctx.Err())
	}
	assertMarchCleanupEnded(t, store, 1, 1)
	stored, err := hero.NewPGStore(peer).GetHero(background, 1, h.HeroID)
	if err != nil || !reflect.DeepEqual(stored, h) {
		t.Fatalf("committed hero was not restored: %v %v", stored, err)
	}
	force, err := hero.NewPGStore(peer).GetMarchForceState(background, 1, h.HeroID)
	if err != nil || force == nil || force.Current != hero.MarchForceMax(1)-hero.MarchForceMarchCost {
		t.Fatalf("existing one-time force charge changed: %v %v", force, err)
	}
	after := originRows(t, peer)
	// Force deduction and ordinary domestic settlement remain existing effects.
	for _, table := range []string{"player_city", "city_building", "work_queue", "player_hero", "field_army", "march_order", "army_troop"} {
		if before[table] != after[table] {
			t.Fatalf("rejected creation changed committed %s", table)
		}
	}
	order, _ := s.military.SnapshotMarch(1)
	if order != nil || len(s.playerMarches) != 0 || len(s.marchHeroByID) != 0 || s.military.SnapshotCity(cityID).Troops[1] != 4 {
		t.Fatal("rejected creation published march state or debited troops")
	}
}
