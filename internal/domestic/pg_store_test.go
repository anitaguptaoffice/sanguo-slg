package domestic

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGStoreRoundTripQueuedBuild(t *testing.T) {
	pool := openDomesticTestDB(t)
	ctx := context.Background()
	applyDomesticSchema(t, pool)
	store := NewPGStore(pool)

	clock := time.Unix(1_700_000_000, 0)
	now := func() time.Time { return clock }
	h1 := NewHub(now)
	h1.UseStore(store, 1, 0)

	c := &CityState{
		ID: 9001, PlayerID: 42, LastSettleAt: clock,
		Wallet:    Resources{1e4, 1e4, 1e4, 1e4},
		Buildings: map[string]*BuildingInstance{"hall": {1, 3}, "farm": {2, 1}},
	}
	seedDomesticOwner(t, pool, c)
	if err := h1.RegisterNewCity(ctx, c); err != nil {
		t.Fatal(err)
	}

	res, err := h1.StartBuildingUpgrade(9001, "farm", 2)
	if err != nil || !res.InProgress {
		t.Fatal("active build")
	}
	if _, err := h1.StartBuildingUpgrade(9001, "lumber", 3); err != nil {
		t.Fatal(err)
	}

	h2 := NewHub(now)
	h2.UseStore(store, 1, 0)
	loaded, err := h2.LoadCity(ctx, 9001, 42)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Wallet.Food != c.Wallet.Food || len(loaded.BuildJobs) != 2 {
		t.Fatalf("wallet/jobs: food=%d jobs=%d", loaded.Wallet.Food, len(loaded.BuildJobs))
	}
	var active, waiting int
	for _, j := range loaded.BuildJobs {
		if j.Status == QueueActive {
			active++
		}
		if j.Status == QueueWaiting {
			waiting++
		}
	}
	if active != 1 || waiting != 1 {
		t.Fatalf("queue states active=%d waiting=%d", active, waiting)
	}

	clock = res.FinishAt
	if h2.Tick() != 1 || loaded.Buildings["farm"].Level != 2 {
		t.Fatal("farm upgrade after reload")
	}
	for _, j := range loaded.BuildJobs {
		if j.CfgID == 3 && j.Status == QueueActive {
			clock = j.FinishAt
		}
	}
	if h2.Tick() != 1 || loaded.Buildings["lumber"].Level != 1 {
		t.Fatal("queued lumber after reload")
	}
}

func openDomesticTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := db.Open(ctx, url)
	if err != nil {
		t.Fatalf("db: %v", err)
	}
	return pool
}

func applyDomesticSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	for _, name := range []string{"001_account.sql", "002_world.sql", "003_domestic.sql", "007_domestic_production_checkpoint.sql", "m4_008_work_queue_id_sequence.sql"} {
		sql, err := os.ReadFile(filepath.Join("..", "..", "spec", "db", name))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(context.Background(), string(sql)); err != nil {
			t.Fatal(err)
		}
	}
}

func seedDomesticOwner(t *testing.T, pool *pgxpool.Pool, c *CityState) {
	t.Helper()
	var accountID int64
	err := pool.QueryRow(context.Background(), `INSERT INTO account(login_name,password_hash) VALUES ($1,'unused') RETURNING account_id`, fmt.Sprintf("domestic_%d_%d", c.PlayerID, c.ID)).Scan(&accountID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(context.Background(), `INSERT INTO player(server_id,player_id,account_id,display_name) VALUES (1,$1,$2,'fixture') ON CONFLICT DO NOTHING`, c.PlayerID, accountID); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(context.Background(), `INSERT INTO player_city (server_id,city_id,player_id,name,x,y) VALUES (1,$1,$2,'fixture',$3,1)`, c.ID, c.PlayerID, int32(c.ID)); err != nil {
		t.Fatal(err)
	}
}
