package hero

import (
	"context"
	"reflect"
	"testing"
	"time"
)

func TestFamilyViewPlansPreservePromptsRosterAndCooldown(t *testing.T) {
	ctx := context.Background()
	for _, name := range []string{"", "coming"} {
		svc, _, p, id := comingTestSetup(t)
		h, _ := svc.Store.GetHero(ctx, p.ServerID, id)
		h.DisplayName = name
		if err := svc.Store.SaveHero(ctx, h); err != nil {
			t.Fatal(err)
		}
		rec, _ := svc.ComingStore.GetComing(ctx, p.ServerID, id)
		plan, err := PlanComingPreview(p, 0, h, rec)
		if err != nil {
			t.Fatal(err)
		}
		old, err := svc.TryAcceptComing(ctx, p, 0, id)
		if err != nil || !reflect.DeepEqual(plan, old) || plan.Hero == h {
			t.Fatalf("preview %+v %+v %v", plan, old, err)
		}
	}
	svc, _, _, p := persuadeTestSetup(t)
	now, calls := time.Unix(1_700_100_000, 0).UTC(), 0
	svc.SetClock(func() time.Time { calls++; return now })
	progress := map[int32]LionizeRecord{1001: {Friend: 10, State: 1}, 1002: {Friend: 20, State: 1, LastPersuadeAt: now.Add(-24 * time.Hour)},
		1003: {Friend: 30, State: 2, LastPersuadeAt: now.Add(-24*time.Hour + time.Second)}, 7777: {Friend: 999, State: 8}}
	for npc, rec := range progress {
		if err := svc.LionizeStore.Put(ctx, p.ServerID, p.PlayerID, npc, rec); err != nil {
			t.Fatal(err)
		}
	}
	plan, err := svc.PlanPersuadeTargets(progress)
	if err != nil || calls != 1 {
		t.Fatalf("plan %v clock %d", err, calls)
	}
	old, err := svc.ListPersuadeTargets(ctx, p)
	if err != nil || !reflect.DeepEqual(plan, old) || len(plan) != 4 {
		t.Fatalf("views %+v %+v %v", plan, old, err)
	}
	if progress[7777].Friend != 999 || len(progress) != 4 {
		t.Fatal("progress mutated")
	}
}
