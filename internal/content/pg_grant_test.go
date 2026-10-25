package content

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
)

func TestPGGrantAtomicPersistence(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	ctx := context.Background()
	if err := db.ApplySpecs(ctx, pool, "../../spec/db"); err != nil {
		t.Fatal(err)
	}
	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	store := NewPGStore(pool)
	fresh := func() *Service { s := NewService(cat); s.UseStore(store); return s }
	player := PlayerRef{ServerID: 1, PlayerID: time.Now().UnixNano()}
	key := fmt.Sprintf("atomic:%d", player.PlayerID)
	if _, err = pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food) VALUES($1,$2,1000)`, player.ServerID, player.PlayerID); err != nil {
		t.Fatal(err)
	}
	pkg := RewardPackage{Resources: map[string]int64{"food": 500}, Items: []RewardItem{{ItemCfgID: 2001, Qty: 2}}}
	first, err := fresh().Grant(player, pkg, key)
	if err != nil {
		t.Fatal(err)
	}
	if first.Duplicate || first.Wallet.Food != 1500 {
		t.Fatalf("first grant: %+v", first)
	}
	restarted := fresh()
	if err = restarted.LoadPlayer(ctx, player); err != nil {
		t.Fatal(err)
	}
	if restarted.Wallet(player).Food != 1500 {
		t.Fatal("wallet not restored from PG")
	}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, e := fresh().Grant(player, pkg, key)
			if e != nil || !r.Duplicate || r.GrantID != first.GrantID {
				t.Errorf("replay: %+v err=%v", r, e)
			}
		}()
	}
	wg.Wait()
	check := func(food int64, qty int32) {
		t.Helper()
		s := fresh()
		if e := s.LoadPlayer(ctx, player); e != nil {
			t.Fatal(e)
		}
		q, e := s.Get(player, 2001)
		if e != nil || q != qty || s.Wallet(player).Food != food {
			t.Fatalf("durable wallet=%+v qty=%d err=%v", s.Wallet(player), q, e)
		}
	}
	check(1500, 2)
	if _, err = fresh().Grant(PlayerRef{ServerID: 1, PlayerID: player.PlayerID + 1}, pkg, key); err == nil {
		t.Fatal("cross-player key replay accepted")
	}
	changed := RewardPackage{Resources: map[string]int64{"food": 501}}
	if _, err = fresh().Grant(player, changed, key); err == nil {
		t.Fatal("changed payload replay accepted")
	}

	// The GM producer pre-inserts a pending queue row; keep that ID and apply once.
	pendingKey := key + ":gm"
	raw, _ := json.Marshal(pkg)
	var pendingID int64
	if err = pool.QueryRow(ctx, `INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,rewards,status,idempotency_key) SELECT $1,COALESCE(MAX(grant_id),0)+1,$2,'gm','test',$3,1,$4 FROM reward_grant_queue WHERE server_id=$1 RETURNING grant_id`, player.ServerID, player.PlayerID, raw, pendingKey).Scan(&pendingID); err != nil {
		t.Fatal(err)
	}
	got, err := fresh().Grant(player, pkg, pendingKey)
	if err != nil || got.GrantID != pendingID || got.Duplicate {
		t.Fatalf("pending GM: %+v err=%v", got, err)
	}
	check(2000, 4)

	// Reject after bag writes but before wallet/queue commit: no partial reward persists.
	faultName := fmt.Sprintf("content_fail_wallet_%d", player.PlayerID)
	faultSQL := fmt.Sprintf(`CREATE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected wallet failure'; END $$; CREATE TRIGGER %s BEFORE UPDATE ON player_wallet FOR EACH ROW WHEN (NEW.player_id=%d) EXECUTE FUNCTION %s()`, faultName, faultName, player.PlayerID, faultName)
	cleanupSQL := fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON player_wallet; DROP FUNCTION IF EXISTS %s()`, faultName, faultName)
	if _, err = pool.Exec(ctx, faultSQL); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, cleanupSQL)
	})
	retryKey := key + ":retry"
	if _, err = fresh().Grant(player, pkg, retryKey); err == nil {
		t.Fatal("injected failure ignored")
	}
	check(2000, 4)
	var n int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND idempotency_key=$2`, player.ServerID, retryKey).Scan(&n); err != nil || n != 0 {
		t.Fatalf("failed queue persisted n=%d err=%v", n, err)
	}
	if _, err = pool.Exec(ctx, cleanupSQL); err != nil {
		t.Fatal(err)
	}
	if _, err = fresh().Grant(player, pkg, retryKey); err != nil {
		t.Fatal(err)
	}
	check(2500, 6)

	// Distinct concurrent keys/players exercise MAX+1 conflict retry as well as replay.
	for i := int64(2); i < 8; i++ {
		wg.Add(1)
		go func(i int64) {
			defer wg.Done()
			p := PlayerRef{ServerID: 1, PlayerID: player.PlayerID + i}
			r, e := fresh().Grant(p, pkg, fmt.Sprintf("%s:%d", key, i))
			if e != nil || r.Wallet.Food != 500 {
				t.Errorf("concurrent grant: %+v err=%v", r, e)
			}
		}(i)
	}
	wg.Wait()
	// Simultaneous first submissions must produce exactly one non-duplicate grant.
	var applied atomic.Int32
	start := make(chan struct{})
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			r, e := fresh().Grant(player, pkg, key+":first-race")
			if e != nil {
				t.Errorf("first race: %v", e)
				return
			}
			if !r.Duplicate {
				applied.Add(1)
			}
		}()
	}
	close(start)
	wg.Wait()
	if applied.Load() != 1 {
		t.Fatalf("applied %d times", applied.Load())
	}
	check(3000, 8)
	// SQL resource overflow rolls back an earlier bag write, too.
	if _, err = fresh().Grant(player, RewardPackage{Resources: map[string]int64{"food": math.MaxInt64}, Items: pkg.Items}, key+":overflow"); err == nil {
		t.Fatal("overflow accepted")
	}
	check(3000, 8)
}

func TestGrantRejectsResourceAliasOverflow(t *testing.T) {
	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	_, err = NewService(cat).Grant(PlayerRef{ServerID: 1, PlayerID: 1}, RewardPackage{Resources: map[string]int64{"gold": math.MaxInt64, "silver": 1}}, "overflow")
	if err == nil {
		t.Fatal("gold+silver overflow accepted")
	}
}
