package api

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestWalletRefreshWithoutPersistenceDoesNotOverwrite(t *testing.T) {
	h := domestic.NewHub(nil)
	s := NewServer(nil, nil, nil, h, nil)
	c := &domestic.CityState{ID: 77, PlayerID: 5151, Wallet: domestic.Resources{Food: 100}}
	if err := h.RegisterCity(c); err != nil {
		t.Fatal(err)
	}
	s.cities[c.ID] = c
	s.refreshDomesticWalletAfterCommit(context.Background(), 1, c.PlayerID)
	if c.Wallet.Food != 100 {
		t.Fatalf("in-memory wallet overwritten: %+v", c.Wallet)
	}
}

func TestWalletBoundaryExternalCreditSpendSettleReload(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t)
	now := time.Unix(1700000000, 0)
	h := domestic.NewHub(func() time.Time { return now })
	store := domestic.NewPGStore(pool)
	h.UseStore(store, 1, 0)
	c := &domestic.CityState{ID: 77, PlayerID: 5151, LastSettleAt: now,
		Wallet:    domestic.Resources{Food: 1000, Wood: 1000, Iron: 1000, Stone: 1000},
		Buildings: map[string]*domestic.BuildingInstance{"farm": {CfgID: 2, Level: 1}}}
	registerWalletBoundaryCity(t, pool, h, c)
	s := NewServer(nil, pool, nil, h, nil)
	s.cities[c.ID] = c
	// Simulate a committed content/quest/mail credit. Never import that snapshot
	// into CityState: doing so would make it look like new domestic production.
	if _, err := pool.Exec(ctx, "UPDATE player_wallet SET food=food+500, gold=99"); err != nil {
		t.Fatal(err)
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	s.refreshDomesticWalletAfterCommit(canceled, 1, c.PlayerID)
	if c.Wallet.Food != 1000 {
		t.Fatalf("failed refresh published state: %+v", c.Wallet)
	}
	s.refreshDomesticWalletAfterCommit(ctx, 1, c.PlayerID)
	s.refreshDomesticWalletAfterCommit(ctx, 1, c.PlayerID)
	if c.Wallet.Food != 1500 {
		t.Fatalf("refresh credited twice or lost reward: %+v", c.Wallet)
	}
	w, err := s.ShopWalletStore().Spend(ctx, content.PlayerRef{ServerID: 1, PlayerID: c.PlayerID}, content.ResourceWallet{Food: 200})
	if err != nil || w.Food != 1300 || c.Wallet.Food != 1300 {
		t.Fatalf("shop debit: wallet=%+v city=%+v err=%v", w, c.Wallet, err)
	}
	if _, err = s.ShopWalletStore().Spend(ctx, content.PlayerRef{ServerID: 1, PlayerID: c.PlayerID}, content.ResourceWallet{Food: 9999}); err == nil {
		t.Fatal("insufficient debit succeeded")
	}
	if c.Wallet.Food != 1300 {
		t.Fatalf("failed debit changed cache: %+v", c.Wallet)
	}
	now = now.Add(time.Hour)
	if err := s.accrueCityWithQuest(ctx, 1, c); err != nil {
		t.Fatal(err)
	}
	loaded, err := store.LoadCity(ctx, 1, c.ID, c.PlayerID)
	if err != nil || loaded.Wallet.Food != 1420 {
		t.Fatalf("reload after production: city=%+v err=%v", loaded, err)
	}
	var gold int64
	if err := pool.QueryRow(ctx, "SELECT gold FROM player_wallet").Scan(&gold); err != nil || gold != 99 {
		t.Fatalf("gold changed: %d %v", gold, err)
	}
}

func walletBoundaryPool(t *testing.T, fullSchema ...bool) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("api_wallet_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
		admin.Close()
	})
	if len(fullSchema) > 0 && fullSchema[0] {
		if err := db.ApplySpecs(ctx, pool, "../../spec/db"); err != nil {
			t.Fatal(err)
		}
		return pool
	}
	for _, file := range []string{"001_account.sql", "002_world.sql", "003_domestic.sql", "007_domestic_production_checkpoint.sql", "m4_008_work_queue_id_sequence.sql"} {
		sql, err := os.ReadFile("../../spec/db/" + file)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = pool.Exec(ctx, string(sql)); err != nil {
			t.Fatal(err)
		}
	}
	return pool
}

func TestWalletBoundaryRecruitCommitFailureDoesNotQueue(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	now := time.Unix(1700000000, 0)
	h := domestic.NewHub(func() time.Time { return now })
	store := domestic.NewPGStore(pool)
	h.UseStore(store, 1, 0)
	c := &domestic.CityState{ID: 77, PlayerID: 5151, LastSettleAt: now,
		Wallet: domestic.Resources{Food: 1000, Wood: 1000, Iron: 1000, Stone: 1000}}
	registerWalletBoundaryCity(t, pool, h, c)
	m := march.NewHub(func() time.Time { return now })
	worldStore := world.NewPGStore(pool)
	s := NewServer(nil, pool, world.NewService(worldStore), h, m)
	s.cities[c.ID] = c
	s.sessions.Bind("wallet-test", PlayerContext{ServerID: 1, PlayerID: c.PlayerID})
	payload, err := marshal(&militaryv1.RecruitTroopRequest{CityId: c.ID, UnitCfgId: 1, Count: 1})
	if err != nil {
		t.Fatal(err)
	}
	pkt := &commonv1.ClientPacket{SessionId: "wallet-test", Payload: payload}
	// Cancellation can fail authoritative ownership lookup before military registration.
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	resp, err := s.handleRecruitTroop(canceled, pkt)
	if err != nil || resp == nil || resp.Code != int32(commonv1.ErrorCode_WORLD_CITY_NOT_FOUND) {
		t.Fatalf("canceled recruit: %+v %v", resp, err)
	}
	if mc := m.SnapshotCity(c.ID); (mc != nil && len(mc.RecruitJobs) != 0) || !m.Scheduler().NextDue().IsZero() {
		t.Fatal("failed wallet commit queued or scheduled recruitment")
	}
	// Fail at COMMIT (not merely before the callback), after the staged debit.
	_, err = pool.Exec(ctx, `CREATE FUNCTION reject_wallet_debit() RETURNS trigger LANGUAGE plpgsql AS $$
	BEGIN IF NEW.food < OLD.food THEN RAISE EXCEPTION 'injected commit failure'; END IF; RETURN NEW; END $$;
	CREATE CONSTRAINT TRIGGER reject_wallet_debit AFTER UPDATE ON player_wallet
	DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_wallet_debit();`)
	if err != nil {
		t.Fatal(err)
	}
	resp, err = s.handleRecruitTroop(ctx, pkt)
	if err != nil || resp == nil || resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || !strings.Contains(resp.Msg, "injected commit failure") {
		t.Fatalf("commit-failed recruit: %+v %v", resp, err)
	}
	if mc := m.SnapshotCity(c.ID); mc == nil || c.Wallet.Food != 1000 || len(mc.RecruitJobs) != 0 || !m.Scheduler().NextDue().IsZero() {
		t.Fatal("failed commit published wallet, job or schedule")
	}
	var persisted int64
	if err = pool.QueryRow(ctx, "SELECT food FROM player_wallet").Scan(&persisted); err != nil || persisted != 1000 {
		t.Fatalf("failed commit changed persisted balance: %d %v", persisted, err)
	}
	if _, err = pool.Exec(ctx, "DROP TRIGGER reject_wallet_debit ON player_wallet"); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, "UPDATE player_wallet SET food=food+500"); err != nil {
		t.Fatal(err)
	}
	resp, err = s.handleRecruitTroop(ctx, pkt)
	if err != nil || resp == nil || resp.Code != 0 {
		t.Fatalf("recruit: %+v %v", resp, err)
	}
	cost := march.DefaultUnitCatalog()[1].RecruitCost
	loaded, err := store.LoadCity(ctx, 1, c.ID, c.PlayerID)
	if err != nil || loaded.Wallet.Food != 1500-cost.Food {
		t.Fatalf("recruit debit lost/duplicated credit: %+v %v", loaded, err)
	}
	if mc := m.SnapshotCity(c.ID); mc == nil || len(mc.RecruitJobs) != 1 {
		t.Fatal("expected one committed job")
	}
}

func TestContentGrantThroughAPIWalletLifecycle(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	now := time.Unix(1700000000, 0)
	h := domestic.NewHub(func() time.Time { return now })
	store := domestic.NewPGStore(pool)
	h.UseStore(store, 1, 0)
	c := &domestic.CityState{ID: 77, PlayerID: 5151, LastSettleAt: now,
		Wallet:    domestic.Resources{Food: 1000},
		Buildings: map[string]*domestic.BuildingInstance{"farm": {CfgID: 2, Level: 1}}}
	registerWalletBoundaryCity(t, pool, h, c)
	s := NewServer(nil, pool, nil, h, nil)
	s.cacheCity(77, c)
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	rewards := content.NewService(cat)
	rewards.UseStore(content.NewPGStore(pool))
	player := content.PlayerRef{ServerID: 1, PlayerID: 5151}
	pkg := content.RewardPackage{Resources: map[string]int64{"food": 500}}
	for i := 0; i < 2; i++ {
		grant, err := rewards.Grant(player, pkg, "api-ledger")
		if err != nil || grant.Duplicate != (i == 1) {
			t.Fatalf("grant replay: %+v %v", grant, err)
		}
		s.refreshDomesticWalletAfterCommit(ctx, 1, 5151)
	}
	if _, err := s.ShopWalletStore().Spend(ctx, player, content.ResourceWallet{Food: 200}); err != nil {
		t.Fatal(err)
	}
	now = now.Add(time.Hour)
	if err := s.accrueCityWithQuest(ctx, 1, s.citySnapshot(77)); err != nil {
		t.Fatal(err)
	}
	restarted := domestic.NewHub(func() time.Time { return now })
	restarted.UseStore(store, 1, 0)
	loaded, err := restarted.LoadCity(ctx, 77, 5151)
	if err != nil || loaded.Wallet.Food != 1420 {
		t.Fatalf("grant/spend/production/reload: %+v %v", loaded, err)
	}
	freshRewards := content.NewService(cat)
	freshRewards.UseStore(content.NewPGStore(pool))
	replay, err := freshRewards.Grant(player, pkg, "api-ledger")
	if err != nil || !replay.Duplicate {
		t.Fatalf("restart replay: %+v %v", replay, err)
	}
	if wallet, err := restarted.RefreshWallet(ctx, 77); err != nil || wallet.Food != 1420 {
		t.Fatalf("restart duplicate changed balance: %+v %v", wallet, err)
	}
}

func registerWalletBoundaryCity(t *testing.T, pool *pgxpool.Pool, h *domestic.Hub, c *domestic.CityState) {
	t.Helper()
	seedRegistrationPlayer(t, pool, c.PlayerID, c.Wallet)
	ctx := context.Background()
	if err := world.NewPGStore(pool).CreateCity(ctx, world.City{ServerID: 1, CityID: c.ID, PlayerID: c.PlayerID, Name: "wallet-test", X: 1, Y: 1}); err != nil {
		t.Fatal(err)
	}
	if err := h.RegisterNewCity(ctx, c); err != nil {
		t.Fatal(err)
	}
}
