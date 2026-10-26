package domestic

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func queuePeerPool(t *testing.T, pool *pgxpool.Pool) *pgxpool.Pool {
	t.Helper()
	cfg := pool.Config()
	cfg.MaxConns = 2
	peer, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(peer.Close)
	return peer
}

func queueCity(t *testing.T, pool *pgxpool.Pool, sid int32, city, player int64, now *time.Time) (*Hub, *CityState) {
	t.Helper()
	var account int64
	if err := pool.QueryRow(context.Background(), `INSERT INTO account(login_name,password_hash) VALUES($1,'unused') RETURNING account_id`, fmt.Sprintf("queue_%d_%d", sid, city)).Scan(&account); err != nil {
		t.Fatal(err)
	}
	productionSQL(t, pool, fmt.Sprintf(`INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(%d,%d,%d,'fixture') ON CONFLICT DO NOTHING;
 INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(%d,%d,%d,'fixture',%d,1)`, sid, player, account, sid, city, player, city))
	h := NewHub(func() time.Time { return *now })
	h.UseStore(NewPGStore(pool), sid, 0)
	c := &CityState{ID: city, PlayerID: player, Wallet: Resources{10000, 10000, 10000, 10000}, Buildings: map[string]*BuildingInstance{"hall": {1, 3}, "farm": {2, 1}}}
	if err := h.RegisterNewCity(context.Background(), c); err != nil {
		t.Fatal(err)
	}
	return h, c
}

// Fixture maintenance, never a runtime reseed: inventory includes the supplied
// live/out-of-band IDs and every row. No writer runs concurrently with this call.
func queueFixtureMaintenance(t *testing.T, pool *pgxpool.Pool, retained int64) {
	t.Helper()
	sql, err := os.ReadFile(filepath.Join("..", "..", "spec", "db", "m4_008_work_queue_id_sequence.sql"))
	if err != nil {
		t.Fatal(err)
	}
	tx, err := pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(tx.Rollback, context.Background())
	if _, err = tx.Exec(context.Background(), `SELECT pg_catalog.set_config('sanguo.queue_id_retained_highwater',$1,true)`, fmt.Sprint(retained)); err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(context.Background(), string(sql)); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestPGQueueConcurrentPoolsCitiesPlayersAndShards(t *testing.T) {
	pool := productionTestPool(t)
	clock := time.Unix(1700000000, 0)
	const n = 8
	hubs := make([]*Hub, n)
	cities := make([]*CityState, n)
	for i := range hubs {
		sid := int32(1 + i%2)
		player := int64(42 + i%3)
		hubs[i], cities[i] = queueCity(t, queuePeerPool(t, pool), sid, int64(i+1), player, &clock)
	}
	results := make([][2]UpgradeResult, n)
	var wg sync.WaitGroup
	for i, h := range hubs {
		wg.Add(1)
		go func(i int, h *Hub) {
			defer wg.Done()
			for j, slot := range []string{"lumber", "stone"} {
				res, err := h.StartBuildingUpgrade(cities[i].ID, slot, int32(j+3))
				if err != nil {
					t.Error(err)
					return
				}
				results[i][j] = res
			}
		}(i, h)
	}
	wg.Wait()
	seen := map[int64]bool{}
	for i, pair := range results {
		for j, res := range pair {
			if res.JobID <= 0 || seen[res.JobID] {
				t.Fatalf("nonunique ID %+v", res)
			}
			seen[res.JobID] = true
			c := cities[i]
			job := c.BuildJobs[j]
			if job.ID != res.JobID || job.FinishAt != res.FinishAt || res.InProgress != (j == 0) {
				t.Fatalf("response/cache mismatch %+v %+v", res, job)
			}
			var diskID int64
			if err := pool.QueryRow(context.Background(), `SELECT queue_id FROM work_queue WHERE server_id=$1 AND city_id=$2 AND payload->>'slot'=$3`, hubs[i].serverID, c.ID, job.Slot).Scan(&diskID); err != nil || diskID != res.JobID {
				t.Fatal(diskID, res, err)
			}
		}
	}
	var distinct, rows int
	if err := pool.QueryRow(context.Background(), `SELECT count(DISTINCT queue_id),count(*) FROM work_queue`).Scan(&distinct, &rows); err != nil || distinct != n*2 || rows != n*2 {
		t.Fatal(distinct, rows, err)
	}
	// Only one Hub owns each city; this does not claim cross-Hub cache coordination.
	clock = clock.Add(45 * time.Second)
	for i, h := range hubs {
		if h.Tick() != 1 || cities[i].Buildings["lumber"].Level != 1 || cities[i].BuildJobs[1].Status != QueueActive {
			t.Fatal("wrong scheduler ID", i)
		}
	}
	clock = clock.Add(50 * time.Second)
	for i, h := range hubs {
		if h.Tick() != 1 || cities[i].Buildings["stone"].Level != 1 {
			t.Fatal("FIFO completion", i)
		}
	}
}

func TestPGQueueRetainedJobsFlushRestartAndEmptyNonreuse(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	clock := time.Unix(1700000000, 0)
	_, c := queueCity(t, pool, 1, 10, 42, &clock)
	// Imported retained rows use real historic identities, not test expectations
	// rewritten to mask a collision. Supply their highwater to approved migration.
	productionSQL(t, pool, `INSERT INTO work_queue VALUES
 (1,8123,42,10,3,'{"retained":"foreign-type"}',to_timestamp(1700000000),to_timestamp(1700000010),0),
 (1,8124,42,10,1,'{"retained":"terminal"}',to_timestamp(1699999900),to_timestamp(1699999990),2),
 (1,8160,42,10,1,'{"slot":"farm","cfg_id":2,"target":2}',to_timestamp(1700000000),to_timestamp(1700000067),1)`)
	queueFixtureMaintenance(t, pool, 9000) // retained external reservation 9000
	var before string
	if err := pool.QueryRow(ctx, `SELECT jsonb_agg(to_jsonb(q) ORDER BY queue_id)::text FROM work_queue q WHERE queue_id IN(8123,8124)`).Scan(&before); err != nil {
		t.Fatal(err)
	}
	// The initial Hub has not admitted/scheduled a job. A replacement loads retained state.
	h := NewHub(func() time.Time { return clock })
	h.UseStore(NewPGStore(queuePeerPool(t, pool)), 1, 0)
	c, err := h.LoadCity(ctx, c.ID, c.PlayerID)
	if err != nil {
		t.Fatal(err)
	}
	if len(c.BuildJobs) != 1 || c.BuildJobs[0].ID != 8160 {
		t.Fatal(c.BuildJobs)
	}
	res, err := h.StartBuildingUpgrade(c.ID, "lumber", 3)
	if err != nil || res.JobID != 9001 || res.InProgress || res.FinishAt != clock.Add(112*time.Second) {
		t.Fatal(res, err)
	}
	if _, err = h.SettleCity(ctx, c.ID); err != nil {
		t.Fatal(err)
	}
	resumed := NewHub(func() time.Time { return clock })
	resumed.UseStore(NewPGStore(queuePeerPool(t, pool)), 1, 0)
	c, err = resumed.LoadCity(ctx, c.ID, c.PlayerID)
	if err != nil {
		t.Fatal(err)
	}
	if len(c.BuildJobs) != 2 || c.BuildJobs[0].ID != 8160 || c.BuildJobs[1].ID != res.JobID {
		t.Fatal(c.BuildJobs)
	}
	clock = clock.Add(67 * time.Second)
	if resumed.Tick() != 1 || c.Buildings["farm"].Level != 2 || c.BuildJobs[1].Status != QueueActive {
		t.Fatal("resume retained job")
	}
	clock = res.FinishAt
	if resumed.Tick() != 1 || c.Buildings["lumber"].Level != 1 {
		t.Fatal("resume allocated job")
	}
	var after string
	if err = pool.QueryRow(ctx, `SELECT jsonb_agg(to_jsonb(q) ORDER BY queue_id)::text FROM work_queue q WHERE queue_id IN(8123,8124)`).Scan(&after); err != nil || before != after {
		t.Fatal("foreign/terminal rows changed", before, after, err)
	}
	// Empty active-build queue, fresh pool/Hub: never reuse a completed identity.
	restarted := NewHub(func() time.Time { return clock })
	restarted.UseStore(NewPGStore(queuePeerPool(t, pool)), 1, 0)
	c, err = restarted.LoadCity(ctx, c.ID, c.PlayerID)
	if err != nil || len(c.BuildJobs) != 0 {
		t.Fatal(c, err)
	}
	next, err := restarted.StartBuildingUpgrade(c.ID, "stone", 4)
	if err != nil || next.JobID <= res.JobID {
		t.Fatal("completed ID reused", next, err)
	}
}
