package domestic

import (
	"context"
	"errors"
	"math"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func productionSQL(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}
func productionHub(pool *pgxpool.Pool, now *time.Time) *Hub {
	h := NewHub(func() time.Time { return *now })
	h.UseStore(NewPGStore(pool), 1, 0)
	return h
}
func productionCity(t *testing.T, h *Hub, id, player int64) *CityState {
	t.Helper()
	c := fractionCity(h.now())
	c.ID, c.PlayerID = id, player
	seedDomesticOwner(t, h.store.Pool, c)
	if err := h.RegisterNewCity(context.Background(), c); err != nil {
		t.Fatal(err)
	}
	return c
}
func sameProduction(t *testing.T, got, want *CityState) {
	t.Helper()
	if got.Wallet != want.Wallet || got.productionRemainder != want.productionRemainder || !got.LastSettleAt.Equal(want.LastSettleAt) {
		t.Fatalf("production differs: got=%+v want=%+v", got, want)
	}
}

func TestPGProductionPollingRestartAndOffline(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	start := time.Unix(1700000000, 123456789)
	now := start
	once, polled := productionHub(pool, &now), productionHub(pool, &now)
	baseline := productionCity(t, once, 1, 42)
	current := productionCity(t, polled, 2, 43)
	var total Resources
	for i := 1; i <= 720; i++ {
		now = start.Add(time.Duration(i)*5*time.Second + time.Duration(i%7))
		_, delta, err := polled.SettleCityWithProduction(ctx, 2)
		if err != nil {
			t.Fatal(err)
		}
		total.Food += delta.Food
		total.Wood += delta.Wood
		total.Stone += delta.Stone
		total.Iron += delta.Iron
		if i%97 == 0 {
			fresh, err := pgxpool.NewWithConfig(ctx, pool.Config())
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(fresh.Close)
			polled = productionHub(fresh, &now)
			current, err = polled.LoadCity(ctx, 2, 43)
			if err != nil {
				t.Fatal(err)
			}
		}
	}
	if _, err := once.SettleCity(ctx, 1); err != nil {
		t.Fatal(err)
	}
	sameProduction(t, current, baseline)
	if current.Wallet != (Resources{252, 105, 84, 63}) || total != current.Wallet {
		t.Fatal("partition/delta", current.Wallet, total)
	}
	before := cloneCity(current)
	now = now.Add(-time.Second)
	if _, err := polled.SettleCity(ctx, 2); err != nil {
		t.Fatal(err)
	}
	sameProduction(t, current, before)
	now = before.LastSettleAt.Add(48 * time.Hour)
	if _, err := polled.SettleCity(ctx, 2); err != nil {
		t.Fatal(err)
	}
	if current.Wallet != (Resources{6300, 2625, 2100, 1575}) {
		t.Fatal("offline cap", current.Wallet)
	}
	before = cloneCity(current)
	if _, err := polled.SettleCity(ctx, 2); err != nil {
		t.Fatal(err)
	}
	sameProduction(t, current, before)
}

func TestPGProductionTwoCitiesAndExternalWalletWrites(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	start := time.Unix(1700000000, 987654321)
	now := start
	h := productionHub(pool, &now)
	productionCity(t, h, 1, 42)
	productionCity(t, h, 2, 42)
	now = start.Add(5 * time.Second)
	if _, err := h.SettleCity(ctx, 1); err != nil {
		t.Fatal(err)
	}
	disk, err := h.store.LoadCity(ctx, 1, 2, 42)
	if err != nil || !disk.LastSettleAt.Equal(start) {
		t.Fatal("A moved B checkpoint", disk, err)
	}
	productionSQL(t, pool, "UPDATE player_wallet SET food=food+500,updated_at=$1", now.Add(24*time.Hour))
	now = start.Add(10 * time.Second)
	if _, err := h.SettleCity(ctx, 2); err != nil {
		t.Fatal(err)
	}
	productionSQL(t, pool, "UPDATE player_wallet SET food=food-100,updated_at=$1", now.Add(24*time.Hour))
	h = productionHub(pool, &now)
	a, err := h.LoadCity(ctx, 1, 42)
	if err != nil {
		t.Fatal(err)
	}
	b, err := h.LoadCity(ctx, 2, 42)
	if err != nil {
		t.Fatal(err)
	}
	now = start.Add(20 * time.Second)
	if _, err := h.SettleCity(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := h.SettleCity(ctx, 2); err != nil {
		t.Fatal(err)
	}
	if a.Wallet.Food != 401 || b.Wallet.Food != 402 || a.productionRemainder[0] != 4*int64(time.Hour)/10 || b.productionRemainder[0] != a.productionRemainder[0] {
		t.Fatal("external writes swallowed/doubled production", a, b)
	}
	c := fractionCity(start.Add(-48 * time.Hour))
	c.ID, c.PlayerID, c.Wallet.Food = 3, 42, 99999
	seedDomesticOwner(t, pool, c)
	if err := h.RegisterNewCity(ctx, c); err != nil {
		t.Fatal(err)
	}
	if !c.LastSettleAt.Equal(now) || c.Wallet.Food != 402 || c.productionRemainder != ([4]int64{}) {
		t.Fatal("new city used old wallet clock or overwrote balance", c)
	}
}

func TestPGProductionMissingCheckpointAndOwnerFailClosed(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	now := time.Unix(1700000000, 123)
	h := productionHub(pool, &now)
	c := productionCity(t, h, 1, 42)
	before := cloneCity(c)
	productionSQL(t, pool, "DELETE FROM player WHERE server_id=1 AND player_id=42")
	now = now.Add(time.Hour)
	if _, err := h.SettleCity(ctx, 1); !errors.Is(err, ErrProductionOwnerMismatch) {
		t.Fatal("settled orphan player", err)
	}
	if _, err := productionHub(pool, &now).LoadCity(ctx, 1, 42); !errors.Is(err, ErrProductionOwnerMismatch) {
		t.Fatal("loaded orphan player", err)
	}
	sameProduction(t, c, before)
	productionSQL(t, pool, "INSERT INTO player(server_id,player_id,account_id,display_name) SELECT 1,42,account_id,'fixture' FROM account WHERE login_name='domestic_42_1'")
	productionSQL(t, pool, "UPDATE city_production_checkpoint SET player_id=99")
	if _, err := h.SettleCity(ctx, 1); !errors.Is(err, ErrProductionOwnerMismatch) {
		t.Fatal(err)
	}
	if _, err := productionHub(pool, &now).LoadCity(ctx, 1, 42); !errors.Is(err, ErrProductionOwnerMismatch) {
		t.Fatal(err)
	}
	sameProduction(t, c, before)
	productionSQL(t, pool, "DELETE FROM city_production_checkpoint")
	if _, err := h.SettleCity(ctx, 1); !errors.Is(err, ErrProductionCheckpointMissing) {
		t.Fatal(err)
	}
	missing := productionHub(pool, &now)
	if _, err := missing.LoadCity(ctx, 1, 42); !errors.Is(err, ErrProductionCheckpointMissing) {
		t.Fatal(err)
	}
	if err := missing.RegisterNewCity(ctx, cloneCity(c)); !errors.Is(err, ErrCityAlreadyRegistered) {
		t.Fatal("legacy building state repaired", err)
	}
	if _, err := missing.SnapshotCity(1); !errors.Is(err, ErrCityNotFound) {
		t.Fatal("failed load published", err)
	}
	sameProduction(t, c, before)
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM city_production_checkpoint").Scan(&count); err != nil || count != 0 {
		t.Fatal(count, err)
	}
}

func TestPGProductionRegistrationGuards(t *testing.T) {
	for _, mode := range []string{"world-owner", "shard", "checkpoint", "queue", "schema", "negative-wallet", "orphan-player", "player-other-shard"} {
		t.Run(mode, func(t *testing.T) {
			pool, ctx := productionTestPool(t), context.Background()
			now := time.Unix(1700000000, 123)
			h := productionHub(pool, &now)
			c := fractionCity(now)
			c.PlayerID = 42
			seedDomesticOwner(t, pool, c)
			switch mode {
			case "orphan-player":
				productionSQL(t, pool, "DELETE FROM player WHERE server_id=1 AND player_id=42")
			case "player-other-shard":
				productionSQL(t, pool, "UPDATE player SET server_id=2 WHERE server_id=1 AND player_id=42")
			case "world-owner":
				c.PlayerID = 99
			case "shard":
				h.UseStore(NewPGStore(pool), 2, 0)
			case "checkpoint":
				productionSQL(t, pool, "INSERT INTO city_production_checkpoint(server_id,city_id,player_id,settled_at,food_remainder) VALUES (1,1,42,$1,123)", now.Add(-time.Hour))
			case "queue":
				productionSQL(t, pool, "INSERT INTO work_queue(server_id,queue_id,player_id,city_id,queue_type,start_at,finish_at) VALUES (1,1,42,1,1,$1,$1)", now)
			case "schema":
				productionSQL(t, pool, "DROP TABLE city_production_checkpoint")
			case "negative-wallet":
				productionSQL(t, pool, "INSERT INTO player_wallet(server_id,player_id,food) VALUES (1,42,$1)", int64(math.MinInt64))
			}
			before := cloneCity(c)
			if err := h.RegisterNewCity(ctx, c); err == nil {
				t.Fatal("invalid registration accepted")
			}
			if !reflect.DeepEqual(cloneCity(c), before) || len(h.sched.q) != 0 {
				t.Fatal("failed registration published/scheduled")
			}
			if _, err := h.SnapshotCity(1); !errors.Is(err, ErrCityNotFound) {
				t.Fatal(err)
			}
			var count int
			if err := pool.QueryRow(ctx, "SELECT count(*) FROM player_wallet").Scan(&count); err != nil {
				t.Fatal(err)
			}
			want := 0
			if mode == "negative-wallet" {
				want = 1
			}
			if count != want {
				t.Fatal("failed registration committed wallet", count)
			}
			if mode == "orphan-player" || mode == "player-other-shard" {
				if err := pool.QueryRow(ctx, "SELECT count(*) FROM city_production_checkpoint").Scan(&count); err != nil || count != 0 {
					t.Fatal("orphan registration committed checkpoint", count, err)
				}
			}
		})
	}
}

func TestPGProductionRegistrationSQLFailureAndCommitRollback(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	now := time.Unix(1700000000, 999)
	h := productionHub(pool, &now)
	c := fractionCity(now)
	c.PlayerID = 42
	c.BuildJobs = []*BuildJob{{ID: 1, Slot: "farm", CfgID: 2, Target: 3, Status: QueueActive, FinishAt: now}}
	seedDomesticOwner(t, pool, c)
	productionSQL(t, pool, "ALTER TABLE city_building ADD CONSTRAINT reject_registration CHECK(level<0)")
	if err := h.RegisterNewCity(ctx, c); err == nil {
		t.Fatal("expected registration failure")
	}
	if len(h.cities) != 0 || len(h.sched.q) != 0 {
		t.Fatal("failure published/scheduled")
	}
	var count int
	if err := pool.QueryRow(ctx, "SELECT (SELECT count(*) FROM player_wallet)+(SELECT count(*) FROM city_production_checkpoint)+(SELECT count(*) FROM work_queue)").Scan(&count); err != nil || count != 0 {
		t.Fatal("registration partial write", count, err)
	}
	productionSQL(t, pool, "ALTER TABLE city_building DROP CONSTRAINT reject_registration")
	c = productionCity(t, h, 2, 43)
	before := cloneCity(c)
	now = now.Add(15 * time.Second)
	if _, err := h.WithWallet(ctx, 2, func(Resources) (Resources, error) { return Resources{}, errors.New("callback rejected") }); err == nil {
		t.Fatal("callback accepted")
	}
	sameProduction(t, c, before)
	productionSQL(t, pool, `CREATE FUNCTION reject_checkpoint_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'checkpoint commit rejected'; END $$;
 CREATE CONSTRAINT TRIGGER reject_checkpoint_commit AFTER UPDATE ON city_production_checkpoint DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_checkpoint_commit()`)
	if _, err := h.SettleCity(ctx, 2); err == nil {
		t.Fatal("commit accepted")
	}
	disk, err := h.store.LoadCity(ctx, 1, 2, 43)
	if err != nil {
		t.Fatal(err)
	}
	sameProduction(t, c, before)
	sameProduction(t, disk, before)
	productionSQL(t, pool, "DROP TRIGGER reject_checkpoint_commit ON city_production_checkpoint")
	if _, err := h.SettleCity(ctx, 2); err != nil {
		t.Fatal(err)
	}
	if c.Wallet.Food != 1 || c.productionRemainder[0] != int64(time.Hour)/20 {
		t.Fatal("retry after commit failure", c)
	}
}

func TestPGProductionCapAndInvalidWallet(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	now := time.Unix(1700000000, 0)
	h := productionHub(pool, &now)
	c := productionCity(t, h, 1, 42)
	now = now.Add(5 * time.Second)
	if _, err := h.SettleCity(ctx, 1); err != nil {
		t.Fatal(err)
	}
	for _, balance := range []int64{100000, math.MaxInt64} {
		productionSQL(t, pool, "UPDATE player_wallet SET food=$1", balance)
		now = now.Add(5 * time.Second)
		if _, err := h.SettleCity(ctx, 1); err != nil {
			t.Fatal(err)
		}
		if c.Wallet.Food != balance || c.productionRemainder[0] != 0 {
			t.Fatal("cap banked overflow", c)
		}
	}
	productionSQL(t, pool, "UPDATE player_wallet SET food=0")
	now = now.Add(5 * time.Second)
	if _, err := h.SettleCity(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if c.Wallet.Food != 0 || c.productionRemainder[0] != 35*int64(time.Hour)/100 {
		t.Fatal("spend unlocked banked credit", c)
	}
	before := cloneCity(c)
	productionSQL(t, pool, "UPDATE player_wallet SET food=$1", int64(math.MinInt64))
	if _, err := h.SettleCity(ctx, 1); !errors.Is(err, ErrInsufficientRes) {
		t.Fatal(err)
	}
	if _, err := h.store.LoadCity(ctx, 1, 1, 42); !errors.Is(err, ErrInsufficientRes) {
		t.Fatal(err)
	}
	sameProduction(t, c, before)
	productionSQL(t, pool, "DELETE FROM player_wallet")
	if _, err := h.SettleCity(ctx, 1); err == nil {
		t.Fatal("recreated missing wallet")
	}
	if _, err := h.store.LoadCity(ctx, 1, 1, 42); err == nil {
		t.Fatal("loaded missing wallet")
	}
}

func TestPGProductionMainHallRateChangeSurvivesRestart(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	now := time.Unix(1700000000, 321)
	h := productionHub(pool, &now)
	c := fractionCity(now)
	c.PlayerID = 42
	c.BuildJobs = []*BuildJob{{ID: 1, Slot: "hall", CfgID: 1, Target: 3, Status: QueueActive, FinishAt: now.Add(5 * time.Second)}}
	seedDomesticOwner(t, pool, c)
	if err := h.RegisterNewCity(ctx, c); err != nil {
		t.Fatal(err)
	}
	now = now.Add(5 * time.Second)
	h.Tick()
	reloaded := productionHub(pool, &now)
	got, err := reloaded.LoadCity(ctx, 1, 42)
	if err != nil {
		t.Fatal(err)
	}
	if got.Buildings["hall"].Level != 3 || got.productionRemainder[0] != 35*int64(time.Hour)/100 {
		t.Fatal("old rate was repriced", got)
	}
	now = now.Add(15 * time.Second)
	if _, err := reloaded.SettleCity(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if got.Wallet.Food != 1 || got.productionRemainder[0] != 45*int64(time.Hour)/100 {
		t.Fatal("new rate/restart", got)
	}
}
