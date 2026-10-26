package api

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Real actor fixtures intentionally leave wallet initialization to each test.
func starterActor(t *testing.T, pool *pgxpool.Pool, serverID int32, playerID int64) PlayerContext {
	t.Helper()
	pc := PlayerContext{ServerID: serverID, PlayerID: playerID}
	err := pool.QueryRow(context.Background(), `WITH a AS (
		INSERT INTO account(login_name,password_hash) VALUES($3,'fixture') RETURNING account_id)
		INSERT INTO player(server_id,player_id,account_id,display_name)
		SELECT $1,$2,account_id,'fixture' FROM a RETURNING account_id`,
		serverID, playerID, fmt.Sprintf("starter-%d-%d", serverID, playerID)).Scan(&pc.AccountID)
	if err != nil {
		t.Fatal(err)
	}
	return pc
}

func TestStarterScrollWaitsForBootstrapPG(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	s := starterServer(t, pool, 0)
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	pc := starterActor(t, pool, 1, 101)
	orphan := PlayerContext{ServerID: 1, PlayerID: 102}
	exec(`INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,102,123)`)
	checkAbsent := func(p PlayerContext, walletRows int) {
		t.Helper()
		var wallets, items, grants int
		err := pool.QueryRow(ctx, `SELECT
			(SELECT count(*) FROM player_wallet WHERE server_id=$1 AND player_id=$2),
			(SELECT count(*) FROM player_item WHERE server_id=$1 AND player_id=$2),
			(SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2)`,
			p.ServerID, p.PlayerID).Scan(&wallets, &items, &grants)
		if err != nil || wallets != walletRows || items != 0 || grants != 0 {
			t.Fatalf("bootstrap side effects: wallets=%d items=%d grants=%d err=%v", wallets, items, grants, err)
		}
	}
	for _, p := range []PlayerContext{pc, orphan, {ServerID: 1, PlayerID: 103}} {
		if msg := s.starterScrollNotice(ctx, p); msg != starterScrollPending {
			t.Fatalf("missing actor/wallet: %q", msg)
		}
	}
	checkAbsent(pc, 0)
	checkAbsent(orphan, 1)
	checkAbsent(PlayerContext{ServerID: 1, PlayerID: 103}, 0)

	// Reproduce the committed-player / not-yet-inserted-wallet bootstrap window
	// with real credentials. The concurrent login must remain a normal success.
	exec(`INSERT INTO game_server(server_id,display_name,status) VALUES(1,'S1',1)`)
	aid, err := s.account.Register(ctx, "bootstrap_login", "secret")
	if err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,104,$1,'bootstrap')`, aid)
	login := s.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: account.RouteLogin,
		Payload: mustProto(&accountv1.LoginRequest{LoginName: "bootstrap_login", Password: "secret", ServerId: 1})})
	if login.GetCode() != 0 || login.GetMsg() != starterScrollPending {
		t.Fatalf("bootstrap login: %v", login)
	}
	var logged accountv1.LoginResponse
	if err := unmarshal(login.Data, &logged); err != nil || logged.GetSessionId() == "" {
		t.Fatalf("login payload: %v %v", &logged, err)
	}
	actual := PlayerContext{ServerID: 1, PlayerID: 104, AccountID: aid}
	checkAbsent(actual, 0)

	// This is the same initial funding and conflict behavior as EnsurePlayer.
	// The original login can now finish without a zero wallet stealing its insert.
	exec(`INSERT INTO player_wallet(server_id,player_id,food,wood,iron,stone,gold)
		VALUES(1,104,8000,8000,5000,5000,0) ON CONFLICT(server_id,player_id) DO NOTHING`)
	var before time.Time
	if err := pool.QueryRow(ctx, `SELECT updated_at FROM player_wallet WHERE server_id=1 AND player_id=104`).Scan(&before); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		resp, err := s.handleListPlayerBag(ctx, &commonv1.ClientPacket{SessionId: logged.GetSessionId(), ServerId: 1,
			Payload: mustProto(&contentv1.ListPlayerBagRequest{ServerId: 1})})
		var bag contentv1.ListPlayerBagResponse
		if err != nil || resp.GetCode() != 0 || unmarshal(resp.Data, &bag) != nil || len(bag.Items) != 1 || bag.Items[0].ItemCfgId != 2004 || bag.Items[0].Quantity != 1 {
			t.Fatalf("bootstrap retry: %v %v", resp, err)
		}
	}
	var wallet content.ResourceWallet
	var after time.Time
	if err := pool.QueryRow(ctx, `SELECT food,wood,iron,stone,gold,updated_at FROM player_wallet WHERE server_id=1 AND player_id=104`).Scan(
		&wallet.Food, &wallet.Wood, &wallet.Iron, &wallet.Stone, &wallet.Gold, &after); err != nil {
		t.Fatal(err)
	}
	if wallet != (content.ResourceWallet{Food: 8000, Wood: 8000, Iron: 5000, Stone: 5000}) || !after.Equal(before) {
		t.Fatalf("initial funding/clock changed: wallet=%+v before=%v after=%v", wallet, before, after)
	}
	var exact bool
	if err := pool.QueryRow(ctx, `SELECT count(*)=1 AND bool_and(player_id=104 AND status=2
		AND idempotency_key='onboarding:starter-scroll:v1:104'
		AND rewards='{"resources":null,"items":[{"item_cfg_id":2004,"qty":1}]}'::jsonb) FROM reward_grant_queue`).Scan(&exact); err != nil || !exact {
		t.Fatalf("bootstrap receipt: exact=%v err=%v", exact, err)
	}
	var orphanFood int64
	if err := pool.QueryRow(ctx, `SELECT food FROM player_wallet WHERE server_id=1 AND player_id=102`).Scan(&orphanFood); err != nil || orphanFood != 123 {
		t.Fatalf("orphan wallet changed: %d %v", orphanFood, err)
	}
}
