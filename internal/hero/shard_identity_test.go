package hero

import (
	"context"
	"testing"
	"time"
)

func TestMemHistoricalIDsStayShardIsolated(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	at := time.Unix(1000, 0)
	// Historical duplicate IDs across shards are legal. Seed them explicitly only
	// in this migration fixture; production creation never accepts supplied IDs.
	for _, sid := range []int32{1, 2} {
		store.heroes[heroKey{sid, 55}] = &Hero{ServerID: sid, HeroID: 55, PlayerID: int64(sid), CreatedAt: at}
	}
	store.nextHeroID = 55
	for _, sid := range []int32{1, 2} {
		h, err := store.GetHero(ctx, sid, 55)
		if err != nil || h == nil {
			t.Fatalf("load shard %d: %+v %v", sid, h, err)
		}
		h.PlayerID += 10
		for _, err := range []error{
			store.SaveHero(ctx, h),
			store.SaveAssignment(ctx, &Assignment{ServerID: sid, HeroID: 55, AssignType: AssignTypeCity, TargetID: int64(sid)}),
			store.SetLastLargessAt(ctx, sid, 55, at.Add(time.Duration(sid)*time.Hour)),
			store.SaveExprSession(ctx, ExprSession{ServerID: sid, HeroID: 55, Hours: sid}),
			store.SaveMarchForceState(ctx, MarchForceState{ServerID: sid, HeroID: 55, Current: sid}),
		} {
			if err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := store.DeleteHero(ctx, 1, 55); err != nil {
		t.Fatal(err)
	}
	h, _ := store.GetHero(ctx, 2, 55)
	a, _ := store.GetAssignmentByHero(ctx, 2, 55)
	sess, _ := store.GetExprSession(ctx, 2, 55)
	force, _ := store.GetMarchForceState(ctx, 2, 55)
	last, _ := store.LastLargessAt(ctx, 2, 55)
	if h == nil || h.PlayerID != 12 || a == nil || a.TargetID != 2 || sess == nil || sess.Hours != 2 || force == nil || force.Current != 2 || !last.Equal(at.Add(2*time.Hour)) {
		t.Fatalf("wrong-shard overwrite/deletion: hero=%+v assignment=%+v expr=%+v force=%+v last=%v", h, a, sess, force, last)
	}
	if h, _ := store.GetHero(ctx, 1, 55); h != nil {
		t.Fatal("deleted shard retained hero")
	}
	if a, _ := store.GetAssignmentByHero(ctx, 1, 55); a != nil {
		t.Fatal("deleted shard retained assignment")
	}
	if s, _ := store.GetExprSession(ctx, 1, 55); s != nil {
		t.Fatal("deleted shard retained expression session")
	}
	if f, _ := store.GetMarchForceState(ctx, 1, 55); f != nil {
		t.Fatal("deleted shard retained march force")
	}
}
