package api

import (
	"context"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMarchClaimInflightPG(t *testing.T) {
	s, pool, now, _ := registrationServer(t)
	ctx := context.Background()
	created, err := s.handleCreateCity(ctx, registrationPacket(t, 1))
	var city worldv1.CreateCityResponse
	if err != nil || created == nil || created.Code != 0 || unmarshal(created.Data, &city) != nil || city.City == nil {
		t.Fatalf("real city setup: %v %v", created, err)
	}
	first, other := originHero(t, s, now), originHero(t, s, now)
	exerciseMarchInflight(t, s, city.City.CityId, first.HeroID, other.HeroID)
	peer, err := pgxpool.NewWithConfig(ctx, pool.Config())
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	for _, want := range []struct {
		id     int64
		status int16
		force  int32
	}{{first.HeroID, hero.StatusMarch, 4}, {other.HeroID, hero.StatusIdle, 14}} {
		h, err := hero.NewPGStore(peer).GetHero(ctx, 1, want.id)
		if err != nil || h == nil || h.Status != want.status {
			t.Fatalf("committed hero: %v %v", h, err)
		}
		force, err := hero.NewPGStore(peer).GetMarchForceState(ctx, 1, want.id)
		if err != nil || force == nil || force.Current != want.force {
			t.Fatalf("committed force: %v %v", force, err)
		}
	}
	// Missing authoritative wallet makes real settlement fail before HERO claim.
	tag, err := pool.Exec(ctx, "DELETE FROM player_wallet WHERE server_id=1 AND player_id=55")
	if err != nil || tag.RowsAffected() != 1 {
		t.Fatalf("isolated settlement-failure fixture: %v %v", tag, err)
	}
	pkt := originPacket(city.City.CityId, other.HeroID)
	out := s.GatewayRouter().Dispatch(ctx, pkt)
	if out.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || out.TraceId != pkt.TraceId || len(out.Data) != 0 || s.nextArmyID != 3 {
		t.Fatalf("settlement failure continued to claim: %v", out)
	}
	h, err := hero.NewPGStore(peer).GetHero(ctx, 1, other.HeroID)
	if err != nil || h == nil || h.Status != hero.StatusIdle {
		t.Fatalf("settlement failure changed committed hero: %v %v", h, err)
	}
	force, err := hero.NewPGStore(peer).GetMarchForceState(ctx, 1, other.HeroID)
	if err != nil || force == nil || force.Current != 14 || len(s.playerMarches[55]) != 3 || s.military.SnapshotCity(city.City.CityId).Troops[1] != 15 {
		t.Fatalf("settlement failure changed force, armies or troops: %v %v", force, err)
	}
	assertInflightEmpty(t, s)
}
