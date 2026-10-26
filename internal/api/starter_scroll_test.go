package api

import (
	"context"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
)

func starterServer(t *testing.T, pool *pgxpool.Pool, bagLimit int32) *Server {
	t.Helper()
	domHub := domestic.NewHub(nil)
	domHub.UseStore(domestic.NewPGStore(pool), 1, 0)
	s := NewServer(slog.New(slog.NewTextHandler(io.Discard, nil)), pool,
		world.NewService(world.NewPGStore(pool)), domHub, march.NewHub(nil))
	if err := s.WireM4Content(context.Background()); err != nil {
		t.Fatal(err)
	}
	if bagLimit > 0 {
		cat, err := content.EmbeddedCatalog()
		if err != nil {
			t.Fatal(err)
		}
		cat.BagMaxDistinctItems = bagLimit
		s.contentSvc = content.NewService(cat)
		s.contentSvc.UseStore(content.NewPGStore(pool))
	}
	return s
}

func TestStarterScrollPolicyPG(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	sql := func(q string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, q, args...); err != nil {
			t.Fatal(err)
		}
	}
	check := func(pc PlayerContext, qty, grants int) {
		t.Helper()
		var gotQty, gotGrants int
		var food int64
		var sameClock bool
		err := pool.QueryRow(ctx, `SELECT COALESCE((SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=2004),0),
			(SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2),
			COALESCE((SELECT food FROM player_wallet WHERE server_id=$1 AND player_id=$2),0),
			(SELECT updated_at='2020-01-01 UTC'::timestamptz FROM player_wallet WHERE server_id=$1 AND player_id=$2)`, pc.ServerID, pc.PlayerID).Scan(&gotQty, &gotGrants, &food, &sameClock)
		if err != nil || gotQty != qty || gotGrants != grants || food != 77 || !sameClock {
			t.Fatalf("%+v: qty=%d grants=%d food=%d err=%v", pc, gotQty, gotGrants, food, err)
		}
	}
	player := func(id int64, shard int32) PlayerContext {
		pc := starterActor(t, pool, shard, id)
		sql(`INSERT INTO player_wallet(server_id,player_id,food,updated_at) VALUES($1,$2,77,'2020-01-01 UTC')`, shard, id)
		return pc
	}
	pc := player(51, 1)
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		s := starterServer(t, pool, 0)
		wg.Add(1)
		go func() {
			defer wg.Done()
			if msg := s.starterScrollNotice(ctx, pc); msg != "" {
				t.Errorf("concurrent notice=%q", msg)
			}
		}()
	}
	wg.Wait()
	check(pc, 1, 1)
	var exact bool
	if err := pool.QueryRow(ctx, `SELECT idempotency_key='onboarding:starter-scroll:v1:51' AND status=2 AND rewards='{"resources":null,"items":[{"item_cfg_id":2004,"qty":1}]}'::jsonb FROM reward_grant_queue`).Scan(&exact); err != nil || !exact {
		t.Fatalf("fixed receipt: %v %v", exact, err)
	}
	sql(`UPDATE player_item SET quantity=0 WHERE player_id=51`)
	starterServer(t, pool, 0).starterScrollNotice(ctx, pc) // Lost reply/restart/consumption cannot mint another.
	check(pc, 0, 1)
	otherShard := player(51, 2)
	starterServer(t, pool, 0).starterScrollNotice(ctx, otherShard)
	check(otherShard, 1, 1)
	for status := 0; status <= 5; status++ {
		p := player(int64(60+status), 1)
		sql(`INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,$1,$1,1001,$2)`, p.PlayerID, status)
		starterServer(t, pool, 0).starterScrollNotice(ctx, p)
		check(p, 0, 0)
		sql(`DELETE FROM player_hero WHERE player_id=$1`, p.PlayerID)
		starterServer(t, pool, 0).starterScrollNotice(ctx, p)
		check(p, 1, 1) // Ineligible snapshots do not consume the future chance.
	}
	p := player(70, 1)
	sql(`INSERT INTO player_item VALUES(1,70,2004,2)`)
	starterServer(t, pool, 0).starterScrollNotice(ctx, p)
	check(p, 2, 0)
	sql(`UPDATE player_item SET quantity=0 WHERE player_id=70`)
	starterServer(t, pool, 0).starterScrollNotice(ctx, p)
	check(p, 1, 1)
}

func TestStarterScrollFailuresAndRoutesPG(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	s := starterServer(t, pool, 1)
	sql := func(q string) {
		t.Helper()
		if _, err := pool.Exec(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	sql(`WITH a AS (INSERT INTO account(login_name,password_hash) VALUES('starter-fixture','fixture') RETURNING account_id)
        INSERT INTO player(server_id,player_id,account_id,display_name) SELECT 1,80,account_id,'fixture' FROM a`)
	pc := PlayerContext{ServerID: 1, PlayerID: 80}
	s.sessions.Bind("actor", pc)
	sql(`INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,80,77); INSERT INTO player_item VALUES(1,80,2001,1)`)
	bag := &commonv1.ClientPacket{SessionId: "actor", ServerId: 1, Payload: mustProto(&contentv1.ListPlayerBagRequest{})}
	assertPending := func(resp *commonv1.ServerPacket, err error) {
		t.Helper()
		if err != nil || resp.GetCode() != 0 || resp.GetMsg() != starterScrollPending || len(resp.GetMsg()) > 150 {
			t.Fatalf("pending response: %v %v", resp, err)
		}
	}
	assertPending(s.handleListPlayerBag(ctx, bag))
	var rows int
	if err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM reward_grant_queue) + (SELECT count(*) FROM player_item WHERE item_cfg_id=2004 AND quantity>0)`).Scan(&rows); err != nil || rows != 0 {
		t.Fatalf("full bag recorded success: %d %v", rows, err)
	}
	sql(`UPDATE player_item SET quantity=0 WHERE item_cfg_id=2001`)
	// Eligibility DB failure does not lose a normal readable bag payload.
	sql(`ALTER TABLE player_hero RENAME TO hidden_hero`)
	assertPending(s.handleListPlayerBag(ctx, bag))
	sql(`ALTER TABLE hidden_hero RENAME TO player_hero`)
	// Deferred failure rolls back the already-written item, wallet and receipt.
	sql(`CREATE FUNCTION fail_starter() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SECRET SQL diagnostic'; END $$;
	CREATE CONSTRAINT TRIGGER fail_starter AFTER UPDATE ON reward_grant_queue DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_starter()`)
	assertPending(s.handleListPlayerBag(ctx, bag))
	assertPending(s.handleListPlayerQuests(ctx, &commonv1.ClientPacket{SessionId: "actor", Payload: mustProto(&questv1.ListPlayerQuestsRequest{ChainId: 100})}))
	assertPending(s.handleGetQuestChainStatus(ctx, &commonv1.ClientPacket{SessionId: "actor", Payload: mustProto(&questv1.GetQuestChainStatusRequest{ChainId: 100})}))
	if err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM reward_grant_queue) + (SELECT count(*) FROM player_item WHERE item_cfg_id=2004 AND quantity>0)`).Scan(&rows); err != nil || rows != 0 {
		t.Fatalf("failed grant persisted: %d %v", rows, err)
	}
	// Real credentials/login still succeed when starter delivery fails.
	sql(`INSERT INTO game_server(server_id,display_name,status) VALUES(1,'S1',1)`)
	if _, err := s.account.Register(ctx, "starter_login", "secret"); err != nil {
		t.Fatal(err)
	}
	login := s.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: account.RouteLogin, Payload: mustProto(&accountv1.LoginRequest{LoginName: "starter_login", Password: "secret", ServerId: 1})})
	assertPending(login, nil)
	var logged accountv1.LoginResponse
	if err := unmarshal(login.Data, &logged); err != nil {
		t.Fatal(err)
	}
	enter := s.GatewayRouter().Dispatch(ctx, &commonv1.ClientPacket{Route: "account.v1.EnterGameServer", SessionId: logged.GetSessionId(), Payload: mustProto(&accountv1.EnterGameServerRequest{ServerId: 1})})
	assertPending(enter, nil)
	sql(`DROP TRIGGER fail_starter ON reward_grant_queue`)
	for _, bad := range []*commonv1.ClientPacket{
		{SessionId: "missing"}, {SessionId: "actor", ServerId: 2},
		{SessionId: "actor", Payload: []byte{0xff}},
		{SessionId: "actor", Payload: mustProto(&contentv1.ListPlayerBagRequest{ServerId: 2})},
	} {
		if resp, err := s.handleListPlayerBag(ctx, bad); err != nil || resp.GetCode() == 0 {
			t.Fatalf("invalid actor/request accepted: %v %v", resp, err)
		}
	}
	if err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM reward_grant_queue) + (SELECT count(*) FROM player_item WHERE item_cfg_id=2004 AND quantity>0)`).Scan(&rows); err != nil || rows != 0 {
		t.Fatalf("invalid request granted: %d %v", rows, err)
	}
	resp, err := s.handleListPlayerBag(ctx, bag)
	var out contentv1.ListPlayerBagResponse
	if err != nil || resp.GetCode() != 0 || unmarshal(resp.Data, &out) != nil || len(out.Items) != 1 || out.Items[0].ItemCfgId != 2004 || out.Items[0].Quantity != 1 {
		t.Fatalf("retry bag: %v %v", resp, err)
	}
	// A conflicting fixed receipt produces a diagnostic, never a replacement key.
	sql(`UPDATE player_item SET quantity=0 WHERE player_id=80; UPDATE reward_grant_queue SET rewards='{"resources":null,"items":[{"item_cfg_id":2004,"qty":2}]}' WHERE player_id=80`)
	assertPending(s.handleListPlayerBag(ctx, bag))
	sql(`UPDATE reward_grant_queue SET player_id=81, rewards='{"resources":null,"items":[{"item_cfg_id":2004,"qty":1}]}' WHERE player_id=80`)
	assertPending(s.handleListPlayerBag(ctx, bag))
	sql(`UPDATE reward_grant_queue SET player_id=80 WHERE player_id=81`)
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM reward_grant_queue WHERE player_id=80`).Scan(&rows); err != nil || rows != 1 {
		t.Fatalf("replacement key: %d %v", rows, err)
	}
}

func TestStarterScrollSnapshotAndTimeoutPG(t *testing.T) {
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	s := starterServer(t, pool, 0)
	for i, mode := range []string{"hero", "book", "stack"} {
		id := int64(90 + i)
		concurrentBook := mode != "hero"
		if mode == "stack" {
			cat, e := content.EmbeddedCatalog()
			if e != nil {
				t.Fatal(e)
			}
			book := cat.Items[2004]
			book.MaxStack = 1
			cat.Items[2004] = book
			s.contentSvc = content.NewService(cat)
			s.contentSvc.UseStore(content.NewPGStore(pool))
		}
		pc := starterActor(t, pool, 1, id)
		if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id) VALUES(1,$1)`, id); err != nil {
			t.Fatal(err)
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		if _, err = tx.Exec(ctx, `SELECT 1 FROM player_wallet WHERE player_id=$1 FOR UPDATE`, id); err != nil {
			t.Fatal(err)
		}
		result := make(chan string, 1)
		go func() { result <- s.starterScrollNotice(ctx, pc) }()
		deadline := time.Now().Add(time.Second)
		for {
			var waiting bool
			if err = pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT food,wood,iron,stone,gold FROM player_wallet%')`).Scan(&waiting); err != nil {
				t.Fatal(err)
			}
			if waiting {
				break
			}
			if time.Now().After(deadline) {
				_ = tx.Rollback(ctx)
				t.Fatal("grant did not reach post-snapshot wallet lock")
			}
			time.Sleep(10 * time.Millisecond)
		}
		if concurrentBook {
			_, err = tx.Exec(ctx, `INSERT INTO player_item VALUES(1,$1,2004,1)`, id)
		} else {
			_, err = tx.Exec(ctx, `INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status) VALUES(1,$1,$1,1001,4)`, id)
		}
		if err != nil {
			t.Fatal(err)
		}
		if err = tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		notice := ""
		if mode == "stack" {
			notice = starterScrollPending
		}
		if msg := <-result; msg != notice {
			t.Fatalf("snapshot eligible notice: %q want=%q", msg, notice)
		}
		var qty int
		want := 1
		if mode == "book" {
			want = 2
		}
		if mode == "stack" {
			var n int
			if e := pool.QueryRow(ctx, `SELECT count(*) FROM reward_grant_queue WHERE player_id=$1`, id).Scan(&n); e != nil || n != 0 {
				t.Fatalf("stack failure receipt: %d %v", n, e)
			}
		}
		if err = pool.QueryRow(ctx, `SELECT quantity FROM player_item WHERE player_id=$1 AND item_cfg_id=2004`, id).Scan(&qty); err != nil || qty != want {
			t.Fatalf("snapshot grant qty=%d want=%d err=%v", qty, want, err)
		}
	}
	// A locked grant times out without detached work or a successful receipt.
	pc := starterActor(t, pool, 1, 99)
	if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id) VALUES(1,99)`); err != nil {
		t.Fatal(err)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT 1 FROM player_wallet WHERE player_id=99 FOR UPDATE`); err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	if msg := s.starterScrollNotice(ctx, pc); msg != starterScrollPending || time.Since(start) > 3*time.Second {
		t.Fatalf("timeout msg=%q elapsed=%s", msg, time.Since(start))
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	var rows int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM reward_grant_queue WHERE player_id=99`).Scan(&rows); err != nil || rows != 0 {
		t.Fatalf("timed-out grant persisted: %d %v", rows, err)
	}
}
