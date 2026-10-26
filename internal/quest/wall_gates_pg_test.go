package quest

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestPGWallFloorOpensOnlyExistingCollateralGates(t *testing.T) {
	pool, _, fresh := claimPGFixture(t)
	ctx, actor := context.Background(), Actor{120, time.Now().UnixNano()}
	st := NewPGStore(pool)
	svc, _ := fresh(st)
	svc.SetTutorialFactsProvider(wallFacts)
	svc.level = func(ctx context.Context, _ int32, _ int64) (int32, error) {
		floor, err := svc.CompletedWallLevel(ctx, actor)
		if floor < 5 {
			floor = 5
		}
		return floor, err
	}
	now := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)
	svc.SetClock(func() time.Time { return now })
	for _, id := range []int32{1007, 1009, 1014, 1018} {
		if _, _, err := svc.AcceptQuest(ctx, actor, id); !errors.Is(err, ErrLevelTooLow) {
			t.Fatalf("gate%d at5: %v", id, err)
		}
	}
	if _, _, err := svc.AcceptQuest(ctx, actor, 1006); err != nil {
		t.Fatal(err)
	}
	view, _, reward, err := svc.ClaimQuestReward(ctx, actor, 1006)
	if err != nil || view.State != PlayerQuestStateCompleted || !wallRewards(reward) {
		t.Fatalf("wall claim %+v %+v %v", view, reward, err)
	}
	for _, id := range []int32{1007, 1009, 1014, 1018} {
		view, _, err := svc.AcceptQuest(ctx, actor, id)
		if err != nil || view.State != PlayerQuestStateInProgress || view.ProgressCurrent != 0 {
			t.Fatalf("gate%d at6: %+v %v", id, view, err)
		}
	}
	for _, ev := range []ProgressEvent{
		{Kind: EventTrainTroops, UnitCode: "infantry", Delta: 50},
		{Kind: EventBuildLevel, BuildingCfgID: 5, BuildLevel: 2, Delta: 1},
		{Kind: EventUseItem, ItemCode: "map_fragment", Delta: 3},
	} {
		if err := svc.ApplyProgressEvent(ctx, actor, ev); err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range []int32{1007, 1009, 1018} {
		r, _, err := st.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, id)
		if err != nil || r.State != StateInProgress || r.Progress != (ProgressCounter{}) {
			t.Fatalf("out-of-scope objective%d changed %+v %v", id, r, err)
		}
	}
	daily, _, err := st.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1014)
	if err != nil || daily.State != StateClaimable || daily.Progress.Count != 50 || daily.Progress.ServerVerifiedVersion != 0 {
		t.Fatalf("existing daily behavior %+v %v", daily, err)
	}
	if _, _, _, err := svc.ClaimQuestReward(ctx, actor, 1014); err != nil {
		t.Fatal(err)
	}
	now = now.Add(24 * time.Hour)
	if view, _, err := svc.AcceptQuest(ctx, actor, 1014); err != nil || view.State != PlayerQuestStateInProgress || view.ProgressCurrent != 0 {
		t.Fatalf("daily rollover %+v %v", view, err)
	}
}
