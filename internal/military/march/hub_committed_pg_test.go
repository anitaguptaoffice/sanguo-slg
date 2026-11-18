package march

import (
	"reflect"
	"testing"
	"time"
)

func TestPGCommittedMarchPublicationMatchesRestore(t *testing.T) {
	f := newDeploymentPG(t)
	baseSQL(t, f.pool, `INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status)
		VALUES (1,11,1,11,3),(1,12,1,12,3)`)
	o, a, ctx := baseOwner(t, f.binding)
	restore, err := NewMarchRestore(ctx, f.pool, f.store.profile)
	baseOK(t, err)
	h := NewHub(nil)
	_, err = restore.Restore(ctx, h)
	baseOK(t, err)
	in := marchStoreSample()
	in.PlayerID, in.OwnerPlayerID, in.FromX, in.FromY = 1, 1, 0, 0
	in.Troops = []TroopStack{{2, 4}, {1, 3}}
	wantTroops := []TroopStack{{1, 3}, {2, 4}}
	in.ArriveAt = in.ArriveAt.Add(5917 * time.Nanosecond)
	baseOK(t, f.lock(ctx, a))
	ready, err := f.recruit.DebitMarchTroops(ctx, a, 1, 1, 100, in.Troops)
	baseOK(t, err)
	ids, err := f.store.Create(ctx, a, in)
	baseOK(t, err)
	if h.March(ids.MarchID) != nil || marchStoreRows(t, f.pool) != "0,0,0,0" {
		t.Fatal("provisional order escaped")
	}
	baseOK(t, o.Commit(ctx))
	// A real failure to publish after commit must leave both stock and the
	// order recoverable using another Hub, even before any events can run.
	if _, err := NewHub(nil).PublishCommittedMarch(in, ids); err == nil {
		t.Fatal("unrestored Hub unexpectedly accepted publication")
	}
	order, err := h.PublishCommittedMarch(in, ids)
	baseOK(t, err)
	fresh := NewHub(nil)
	r, err := restore.Restore(ctx, fresh)
	baseOK(t, err)
	got, stacks := fresh.SnapshotMarch(ids.MarchID)
	if got == nil {
		t.Fatal("missing restored order")
	}
	got.DepartAt, got.ArriveAt = got.DepartAt.UTC(), got.ArriveAt.UTC()
	_, liveStacks := h.SnapshotMarch(ids.MarchID)
	if !reflect.DeepEqual(got, order) || !reflect.DeepEqual(stacks, wantTroops) || len(r.Marches) != 1 ||
		!reflect.DeepEqual(liveStacks, wantTroops) || r.Marches[0].MarchID != ids.MarchID ||
		!reflect.DeepEqual(r.Marches[0].HeroIDs, in.HeroIDs) {
		t.Fatal("restored march differs from confirmed publication", got, order, r)
	}
	for _, hub := range []*Hub{h, fresh} {
		if hub.Scheduler().PollDue(order.ArriveAt) != 0 || len(hub.restoreEv) != 1 || !hub.restoreEv[0].DueAt.Equal(order.ArriveAt) {
			t.Fatal("restored events did not preserve the committed deadline")
		}
	}
	var stock []int32
	baseOK(t, f.pool.QueryRow(ctx, "SELECT array_agg(count ORDER BY unit_cfg_id) FROM city_troop").Scan(&stock))
	if !reflect.DeepEqual(stock, ready[:]) || ready != ([4]int32{2, 5, 0, 7}) || marchStoreRows(t, f.pool) != "1,1,2,0" {
		t.Fatal("publication or restart unexpectedly changed durable stock or order", ready, stock)
	}
}
