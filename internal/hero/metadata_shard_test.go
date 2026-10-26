package hero

import (
	"context"
	"testing"
)

func TestMemComingMetadataShardIsolation(t *testing.T) {
	ctx := context.Background()
	store := NewMemComingStore()
	for sid := int32(1); sid <= 2; sid++ {
		if err := store.PutComing(ctx, sid, 55, ComingRecord{CityID: int64(sid)}); err != nil {
			t.Fatal(err)
		}
	}
	for sid := int32(1); sid <= 2; sid++ {
		rec, err := store.GetComing(ctx, sid, 55)
		if err != nil || rec == nil || rec.CityID != int64(sid) {
			t.Fatalf("shard %d overwritten: %+v %v", sid, rec, err)
		}
	}
	if rec, err := store.GetComing(ctx, 3, 55); err != nil || rec != nil {
		t.Fatalf("missing shard read another shard: %+v %v", rec, err)
	}
	if err := store.PutComing(ctx, 1, 55, ComingRecord{CityID: 11}); err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteComing(ctx, 1, 55); err != nil {
		t.Fatal(err)
	}
	if rec, err := store.GetComing(ctx, 1, 55); err != nil || rec != nil {
		t.Fatalf("deleted shard retained record: %+v %v", rec, err)
	}
	if rec, err := store.GetComing(ctx, 2, 55); err != nil || rec == nil || rec.CityID != 2 {
		t.Fatalf("other shard changed/deleted: %+v %v", rec, err)
	}
}

func TestMemCaptiveMetadataShardIsolation(t *testing.T) {
	ctx := context.Background()
	store := NewMemCaptiveStore()
	for sid := int32(1); sid <= 2; sid++ {
		rec := CaptiveRecord{CityID: int64(sid), SummonItemCfgID: 2050 + sid, SummonItemQty: sid}
		if err := store.PutCaptive(ctx, sid, 55, rec); err != nil {
			t.Fatal(err)
		}
	}
	for sid := int32(1); sid <= 2; sid++ {
		rec, err := store.GetCaptive(ctx, sid, 55)
		if err != nil || rec == nil || rec.CityID != int64(sid) || rec.SummonItemCfgID != 2050+sid || rec.SummonItemQty != sid {
			t.Fatalf("shard %d overwritten: %+v %v", sid, rec, err)
		}
	}
	if rec, err := store.GetCaptive(ctx, 3, 55); err != nil || rec != nil {
		t.Fatalf("missing shard read another shard: %+v %v", rec, err)
	}
	if err := store.PutCaptive(ctx, 1, 55, CaptiveRecord{CityID: 11}); err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteCaptive(ctx, 1, 55); err != nil {
		t.Fatal(err)
	}
	if rec, err := store.GetCaptive(ctx, 1, 55); err != nil || rec != nil {
		t.Fatalf("deleted shard retained record: %+v %v", rec, err)
	}
	if rec, err := store.GetCaptive(ctx, 2, 55); err != nil || rec == nil || *rec != (CaptiveRecord{CityID: 2, SummonItemCfgID: 2052, SummonItemQty: 2}) {
		t.Fatalf("other shard changed/deleted: %+v %v", rec, err)
	}
}

// legacyMetadataService explicitly imports legal historical equal IDs for a test.
// Production creation still rejects caller-supplied hero identities.
func legacyMetadataService(status int16) *Service {
	svc := NewService()
	store := NewMemStore()
	for sid := int32(1); sid <= 2; sid++ {
		store.heroes[heroKey{sid, 55}] = &Hero{ServerID: sid, HeroID: 55, PlayerID: 9, Level: 1, Status: status}
	}
	store.nextHeroID = 55
	svc.UseStore(store)
	return svc
}

func TestComingFlowsKeepHistoricalShardsIndependent(t *testing.T) {
	ctx := context.Background()
	svc := legacyMetadataService(StatusComing)
	for sid := int32(1); sid <= 2; sid++ {
		if err := svc.ComingStore.PutComing(ctx, sid, 55, ComingRecord{CityID: int64(sid)}); err != nil {
			t.Fatal(err)
		}
	}
	city := &stubHotelCity{officeLevel: 2}
	accepted, err := svc.SureAcceptComing(ctx, PlayerRef{ServerID: 1, PlayerID: 9}, CityRef{CityID: 1}, 55, city)
	if err != nil || accepted.Hero == nil || accepted.Hero.HeroID != 55 || accepted.Hero.Status != StatusIdle {
		t.Fatalf("accept own shard: %+v %v", accepted, err)
	}
	other, err := svc.Store.GetHero(ctx, 2, 55)
	if err != nil || other == nil || other.Status != StatusComing {
		t.Fatalf("other hero changed: %+v %v", other, err)
	}
	if _, err := svc.TryAcceptComing(ctx, PlayerRef{ServerID: 2, PlayerID: 9}, 2, 55); err != nil {
		t.Fatalf("other coming metadata changed/deleted: %v", err)
	}
	if err := svc.RejectComing(ctx, PlayerRef{ServerID: 2, PlayerID: 9}, 2, 55); err != nil {
		t.Fatal(err)
	}
	kept, err := svc.Store.GetHero(ctx, 1, 55)
	if err != nil || kept == nil || kept.Status != StatusIdle {
		t.Fatalf("reject removed accepted other-shard hero: %+v %v", kept, err)
	}
	if gone, err := svc.Store.GetHero(ctx, 2, 55); err != nil || gone != nil {
		t.Fatalf("rejected hero remains: %+v %v", gone, err)
	}
}

func TestCaptiveFlowsKeepHistoricalShardsIndependent(t *testing.T) {
	ctx := context.Background()
	svc := legacyMetadataService(StatusCaptive)
	for sid := int32(1); sid <= 2; sid++ {
		rec := CaptiveRecord{CityID: int64(sid), SummonItemCfgID: 2050, SummonItemQty: sid}
		if err := svc.CaptiveStore.PutCaptive(ctx, sid, 55, rec); err != nil {
			t.Fatal(err)
		}
	}
	city := &stubHotelCity{officeLevel: 2, gold: 1000000}
	inv := &memInventory{wallet: Resources{Gold: 1000000}, items: map[int32]int32{2050: 3}}
	summoned, err := svc.SureSummonCaptive(ctx, PlayerRef{ServerID: 1, PlayerID: 9}, CityRef{CityID: 1}, 55, city, inv)
	if err != nil || summoned.Hero == nil || summoned.Hero.HeroID != 55 || summoned.Hero.Status != StatusIdle || inv.items[2050] != 2 {
		t.Fatalf("summon own shard: %+v items=%v %v", summoned, inv.items, err)
	}
	other, err := svc.Store.GetHero(ctx, 2, 55)
	if err != nil || other == nil || other.Status != StatusCaptive {
		t.Fatalf("other hero changed: %+v %v", other, err)
	}
	pre, err := svc.TrySummonCaptive(ctx, PlayerRef{ServerID: 2, PlayerID: 9}, 2, 55)
	if err != nil || len(pre.Items) != 1 || pre.Items[0].Quantity != 2 {
		t.Fatalf("other captive metadata changed/deleted: %+v %v", pre, err)
	}
	if err := svc.ReleaseCaptive(ctx, PlayerRef{ServerID: 2, PlayerID: 9}, 2, 55); err != nil {
		t.Fatal(err)
	}
	kept, err := svc.Store.GetHero(ctx, 1, 55)
	if err != nil || kept == nil || kept.Status != StatusIdle {
		t.Fatalf("release removed summoned other-shard hero: %+v %v", kept, err)
	}
	if gone, err := svc.Store.GetHero(ctx, 2, 55); err != nil || gone != nil {
		t.Fatalf("released hero remains: %+v %v", gone, err)
	}
}
