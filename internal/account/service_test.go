package account

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestRegisterLoginRefreshMultiServer(t *testing.T) {
	pool := openTestDB(t)
	ctx := context.Background()
	applyAccountSchema(t, pool)

	store := NewStore(pool)
	svc := NewService(store)
	fixed := time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return fixed }

	id, err := svc.Register(ctx, "hero1", "p@ssw0rd")
	if err != nil || id <= 0 {
		t.Fatalf("register: id=%d err=%v", id, err)
	}
	_, err = svc.Register(ctx, "hero1", "other")
	if err == nil {
		t.Fatal("duplicate register should fail")
	}

	seedServer(t, pool, 1, "S1", 1)
	seedServer(t, pool, 2, "S2", 1)
	seedPlayer(t, pool, 1, 1001, id, "Lord-A")
	seedPlayer(t, pool, 2, 2002, id, "Lord-B")

	login1, err := svc.Login(ctx, "hero1", "p@ssw0rd", 1)
	if err != nil || login1.GetPlayer().GetDisplayName() != "Lord-A" {
		t.Fatalf("login server 1: %+v err=%v", login1, err)
	}
	login2, err := svc.Login(ctx, "hero1", "p@ssw0rd", 2)
	if err != nil || login2.GetPlayer().GetDisplayName() != "Lord-B" {
		t.Fatalf("login server 2: %+v err=%v", login2, err)
	}
	if login1.GetSessionId() == login2.GetSessionId() {
		t.Fatal("expected distinct sessions per login")
	}

	// Account login reads the wallet; bootstrap belongs to the API layer. The
	// legacy players above have no wallet rows and must receive zero balances.
	for _, login := range []*accountv1.LoginResponse{login1, login2} {
		wallet := login.GetWallet()
		if wallet == nil || wallet.GetFood() != 0 || wallet.GetWood() != 0 || wallet.GetIron() != 0 || wallet.GetStone() != 0 || wallet.GetGold() != 0 {
			t.Fatalf("login server %d wallet: %+v; want zero balances", login.GetPlayer().GetServerId(), wallet)
		}
	}
	var walletRows int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM player_wallet WHERE (server_id, player_id) IN ((1, 1001), (2, 2002))`).Scan(&walletRows); err != nil {
		t.Fatal(err)
	}
	if walletRows != 0 {
		t.Fatalf("account login unexpectedly created %d wallet rows", walletRows)
	}

	refreshed, err := svc.RefreshSession(ctx, login1.GetSessionId())
	if err != nil {
		t.Fatal(err)
	}
	if refreshed.GetSessionExpiresAtMs() != fixed.Add(24*time.Hour).UnixMilli() {
		t.Fatalf("unexpected expiry %d", refreshed.GetSessionExpiresAtMs())
	}
}

func openTestDB(t *testing.T) *pgxpool.Pool {
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

func applyAccountSchema(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	// Login reads player_wallet, which is defined by the domestic migration.
	for _, name := range []string{"001_account.sql", "003_domestic.sql"} {
		path := filepath.Join("..", "..", "spec", "db", name)
		sql, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read schema %s: %v", name, err)
		}
		if _, err := pool.Exec(context.Background(), string(sql)); err != nil {
			t.Fatalf("apply schema %s: %v", name, err)
		}
	}
}

func seedServer(t *testing.T, pool *pgxpool.Pool, id int32, name string, status int16) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO game_server (server_id, display_name, status)
		VALUES ($1, $2, $3)
		ON CONFLICT (server_id) DO UPDATE SET display_name = EXCLUDED.display_name, status = EXCLUDED.status`,
		id, name, status)
	if err != nil {
		t.Fatal(err)
	}
}

func seedPlayer(t *testing.T, pool *pgxpool.Pool, serverID int32, playerID int64, accountID int64, name string) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO player (server_id, player_id, account_id, display_name)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (server_id, player_id) DO NOTHING`,
		serverID, playerID, accountID, name)
	if err != nil {
		t.Fatal(err)
	}
}
