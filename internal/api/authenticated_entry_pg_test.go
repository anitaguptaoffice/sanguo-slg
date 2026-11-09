package api

import (
	"context"
	"fmt"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	commonpb "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/shard"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

type entryWireFixture struct {
	s *Server
	c *websocket.Conn
	n int
}

func newEntryWireFixture(t *testing.T) *entryWireFixture {
	t.Helper()
	pool := walletBoundaryPool(t, true)
	seed, err := os.ReadFile("../../spec/data/generated/cfg_quest.sql")
	if err != nil {
		t.Fatal(err)
	}
	tutorialSQL(t, pool, string(seed))
	tutorialSQL(t, pool, `INSERT INTO game_server(server_id,display_name,status) VALUES(1,'S1',1),(2,'S2',1),(3,'S3',1)`)
	s := starterServer(t, pool, 0)
	cfg := gateway.DefaultConfig()
	cfg.PublicRoutes = s.PublicRoutes()
	gw := gateway.NewServer(s.log, cfg, gateway.AccessControl{}, account.SessionValidator{Svc: s.AccountService()}, s.GatewayRouter())
	ts := httptest.NewServer(gw.Handler())
	t.Cleanup(ts.Close)
	c, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(ts.URL, "http")+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = c.Close()
		deadline := time.Now().Add(5 * time.Second)
		for gw.ActiveConnections() != 0 && time.Now().Before(deadline) {
			time.Sleep(time.Millisecond)
		}
		if gw.ActiveConnections() != 0 {
			t.Error("entry websocket did not stop before database cleanup")
		}
	})
	return &entryWireFixture{s: s, c: c}
}

func (f *entryWireFixture) send(t *testing.T, p *commonv1.ClientPacket) *commonv1.ServerPacket {
	t.Helper()
	f.n++
	p.TraceId = fmt.Sprintf("entry-wire-%d", f.n)
	// Preserve the production limiter, with no mutating request retry.
	time.Sleep(time.Duration(float64(time.Second) / gateway.DefaultConfig().MessagesPerSecond))
	if err := f.c.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
		t.Fatal(err)
	}
	if err := f.c.SetReadDeadline(time.Now().Add(10 * time.Second)); err != nil {
		t.Fatal(err)
	}
	if err := f.c.WriteMessage(websocket.BinaryMessage, mustProto(p)); err != nil {
		t.Fatal(err)
	}
	kind, raw, err := f.c.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var out commonv1.ServerPacket
	if kind != websocket.BinaryMessage || unmarshal(raw, &out) != nil || out.TraceId != p.TraceId {
		t.Fatal("invalid or uncorrelated binary gateway response")
	}
	return &out
}

func (f *entryWireFixture) register(t *testing.T, name string, id int64) {
	t.Helper()
	// Sequence positioning only: the real registration handler hashes credentials.
	tutorialSQL(t, f.s.players.Pool, `SELECT setval(pg_get_serial_sequence('account','account_id'),$1,false)`, id)
	out := f.send(t, &commonv1.ClientPacket{Route: account.RouteRegister,
		Payload: mustProto(&accountv1.RegisterRequest{LoginName: name, Password: "entry-test-password"})})
	var registered accountv1.RegisterResponse
	if out.Code != 0 || unmarshal(out.Data, &registered) != nil || registered.AccountId != id {
		t.Fatal("real registration did not allocate the requested test identity")
	}
}

func (f *entryWireFixture) login(t *testing.T, name string, server int32, notice string) string {
	t.Helper()
	out := f.send(t, &commonv1.ClientPacket{Route: account.RouteLogin,
		Payload: mustProto(&accountv1.LoginRequest{LoginName: name, Password: "entry-test-password", ServerId: server})})
	var logged accountv1.LoginResponse
	if out.Code != 0 || out.Msg != notice || unmarshal(out.Data, &logged) != nil || logged.GetSessionId() == "" {
		t.Fatal("real credential login failed")
	}
	return logged.SessionId
}

func entryWirePacket(sid string, server int32) *commonv1.ClientPacket {
	return &commonv1.ClientPacket{Route: shard.RouteEnterGameServer, SessionId: sid, ServerId: server,
		Payload: mustProto(&accountv1.EnterGameServerRequest{ServerId: server})}
}

func (f *entryWireFixture) wallet(t *testing.T, server int32, player int64) string {
	t.Helper()
	var snapshot string
	err := f.s.players.Pool.QueryRow(context.Background(), `SELECT COALESCE((SELECT to_jsonb(w)::text
		FROM player_wallet w WHERE server_id=$1 AND player_id=$2),'<missing>')`, server, player).Scan(&snapshot)
	if err != nil {
		t.Fatal(err)
	}
	return snapshot
}

func (f *entryWireFixture) enter(t *testing.T, sid string, server int32, accountID int64, level int32, notice string) int64 {
	t.Helper()
	want := &accountv1.EnterGameServerResponse{SessionId: sid, ServerId: server,
		Player: &commonpb.PlayerProfile{ServerId: server}, Wallet: &commonpb.ResourceWallet{}}
	var expires time.Time
	err := f.s.players.Pool.QueryRow(context.Background(), `SELECT a.account_id,a.expires_at,
		p.player_id,p.display_name,p.level,p.power,COALESCE(w.food,0),COALESCE(w.wood,0),
		COALESCE(w.iron,0),COALESCE(w.stone,0),COALESCE(w.gold,0)
		FROM account_session a JOIN player p ON p.account_id=a.account_id AND p.server_id=$2
		LEFT JOIN player_wallet w USING(server_id,player_id) WHERE a.session_id=$1::uuid`, sid, server).
		Scan(&want.AccountId, &expires, &want.Player.PlayerId, &want.Player.DisplayName, &want.Player.Level,
			&want.Player.Power, &want.Wallet.Food, &want.Wallet.Wood, &want.Wallet.Iron, &want.Wallet.Stone, &want.Wallet.Gold)
	if err != nil || want.AccountId != accountID {
		t.Fatalf("authoritative entry fixture mismatch: %v", err)
	}
	want.SessionExpiresAtMs, want.Player.Level = expires.UnixMilli(), level
	before := f.wallet(t, server, want.Player.PlayerId)
	out := f.send(t, entryWirePacket(sid, server))
	var got accountv1.EnterGameServerResponse
	if out.Code != 0 || out.Msg != notice || unmarshal(out.Data, &got) != nil || !proto.Equal(want, &got) {
		t.Fatalf("registered entry lost identity/profile/session/wallet fields: code=%d notice=%q", out.Code, out.Msg)
	}
	pc, ok := f.s.sessions.Get(sid)
	if !ok || pc != (PlayerContext{AccountID: accountID, ServerID: server, PlayerID: want.Player.PlayerId}) {
		t.Fatal("entry response and actual bound actor disagree")
	}
	if f.wallet(t, server, want.Player.PlayerId) != before {
		t.Fatal("entry changed persisted wallet fields or timestamps")
	}
	var storedLevel int32
	if err := f.s.players.Pool.QueryRow(context.Background(), `SELECT level FROM player WHERE server_id=$1 AND player_id=$2`, server, pc.PlayerID).Scan(&storedLevel); err != nil || storedLevel != level {
		t.Fatalf("tutorial profile was not persisted: %v", err)
	}
	return pc.PlayerID
}

func (f *entryWireFixture) grant(t *testing.T, server int32, player int64, want int) {
	t.Helper()
	var items, receipts int
	err := f.s.players.Pool.QueryRow(context.Background(), `SELECT
		COALESCE((SELECT quantity FROM player_item WHERE server_id=$1 AND player_id=$2 AND item_cfg_id=2004),0),
		(SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2)`, server, player).Scan(&items, &receipts)
	if err != nil || items != want || receipts != want {
		t.Fatalf("starter rollback/delivery mismatch: items=%d receipts=%d err=%v", items, receipts, err)
	}
}

func (f *entryWireFixture) reject(t *testing.T, p *commonv1.ClientPacket, code commonv1.ErrorCode) {
	t.Helper()
	before, existed := f.s.sessions.Get(p.SessionId)
	out := f.send(t, p)
	after, exists := f.s.sessions.Get(p.SessionId)
	if out.Code != int32(code) || len(out.Data) != 0 || before != after || existed != exists {
		t.Fatalf("rejected entry leaked data or changed binding: code=%d", out.Code)
	}
}

func TestAuthenticatedEntryWirePG(t *testing.T) {
	f := newEntryWireFixture(t)
	pool := f.s.players.Pool
	const firstID int64 = 9007199254740993
	const secondID int64 = 9223372036854775807
	f.register(t, "entry-first", firstID)
	tutorialSQL(t, pool, `CREATE FUNCTION entry_reject_grant() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN RAISE EXCEPTION 'private injected grant failure'; END $$;
		CREATE CONSTRAINT TRIGGER entry_reject_grant AFTER UPDATE ON reward_grant_queue
		DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION entry_reject_grant()`)
	sid := f.login(t, "entry-first", 1, starterScrollPending)
	pc, ok := f.s.sessions.Get(sid)
	if !ok || pc.AccountID != firstID {
		t.Fatal("real login failed to bind the first account")
	}
	f.grant(t, 1, pc.PlayerID, 0)
	// Explicit legacy completed-quest fixture, not natural-play completion.
	levelRows(t, pool, quest.Actor{ServerID: pc.ServerID, PlayerID: pc.PlayerID}, 1005)
	tutorialSQL(t, pool, `UPDATE player SET display_name='entry-profile',power=123456 WHERE server_id=1;
		UPDATE player_wallet SET food=11,wood=22,iron=33,stone=44,gold=55,updated_at='2020-01-01 UTC'`)
	if !t.Run("starter_pending_refresh", func(t *testing.T) {
		f.enter(t, sid, 1, firstID, 5, starterScrollPending)
		f.grant(t, 1, pc.PlayerID, 0)
	}) {
		return
	}
	tutorialSQL(t, pool, `DROP TRIGGER entry_reject_grant ON reward_grant_queue`)
	tutorialSQL(t, pool, `UPDATE player SET level=1 WHERE server_id=1 AND player_id=$1`, pc.PlayerID)
	t.Run("profile_failure", func(t *testing.T) {
		tutorialSQL(t, pool, `CREATE FUNCTION entry_reject_profile() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN RAISE EXCEPTION 'private injected profile failure'; END $$;
			CREATE TRIGGER entry_reject_profile BEFORE UPDATE ON player FOR EACH ROW EXECUTE FUNCTION entry_reject_profile()`)
		defer tutorialSQL(t, pool, `DROP TRIGGER entry_reject_profile ON player`)
		before := f.wallet(t, 1, pc.PlayerID)
		out := f.send(t, entryWirePacket(sid, 1))
		if out.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || out.Msg != "quest operation failed" || len(out.Data) != 0 {
			t.Fatal("profile failure exposed authenticated payload or private diagnostics")
		}
		// PLATFORM binds before the API refresh fails; this is not a rollback claim.
		bound, present := f.s.sessions.Get(sid)
		if !present || bound != pc || f.wallet(t, 1, pc.PlayerID) != before {
			t.Fatal("profile failure changed actor identity or wallet")
		}
		f.grant(t, 1, pc.PlayerID, 0)
	})
	t.Run("starter_granted_retry", func(t *testing.T) {
		for i := 0; i < 2; i++ {
			f.enter(t, sid, 1, firstID, 5, "")
			f.grant(t, 1, pc.PlayerID, 1)
		}
	})
	t.Run("refresh_session", func(t *testing.T) {
		var before, after time.Time
		if err := pool.QueryRow(context.Background(), `SELECT expires_at FROM account_session WHERE session_id=$1::uuid`, sid).Scan(&before); err != nil {
			t.Fatal(err)
		}
		out := f.send(t, &commonv1.ClientPacket{Route: account.RouteRefreshSession, SessionId: sid,
			Payload: mustProto(&accountv1.RefreshSessionRequest{})})
		var refreshed accountv1.RefreshSessionResponse
		if out.Code != 0 || unmarshal(out.Data, &refreshed) != nil || refreshed.SessionId != sid {
			t.Fatal("real session refresh failed")
		}
		if err := pool.QueryRow(context.Background(), `SELECT expires_at FROM account_session WHERE session_id=$1::uuid`, sid).Scan(&after); err != nil || !after.After(before) || refreshed.SessionExpiresAtMs != after.UnixMilli() {
			t.Fatalf("renewed expiry mismatch: %v", err)
		}
		f.enter(t, sid, 1, firstID, 5, "")
	})
	t.Run("credential_relogin", func(t *testing.T) {
		fresh := f.login(t, "entry-first", 1, "")
		if fresh == sid {
			t.Fatal("credential relogin did not issue a new session")
		}
		f.enter(t, fresh, 1, firstID, 5, "")
	})
	t.Run("shard_switch", func(t *testing.T) {
		fresh := f.login(t, "entry-first", 2, "")
		f.enter(t, fresh, 2, firstID, 1, "")
		f.enter(t, sid, 2, firstID, 1, "")
		f.enter(t, sid, 1, firstID, 5, "")
	})
	f.register(t, "entry-second", secondID)
	other := f.login(t, "entry-second", 1, "")
	t.Run("other_account_max", func(t *testing.T) {
		if f.enter(t, other, 1, secondID, 1, "") == pc.PlayerID {
			t.Fatal("different accounts reused a shard player")
		}
		f.enter(t, sid, 1, firstID, 5, "")
	})
	otherPC, _ := f.s.sessions.Get(other)
	t.Run("zero_wallet", func(t *testing.T) {
		tutorialSQL(t, pool, `UPDATE player_wallet SET food=0,wood=0,iron=0,stone=0,gold=0 WHERE server_id=1 AND player_id=$1`, otherPC.PlayerID)
		f.enter(t, other, 1, secondID, 1, "")
	})
	t.Run("missing_wallet", func(t *testing.T) {
		tutorialSQL(t, pool, `DELETE FROM player_wallet WHERE server_id=1 AND player_id=$1`, otherPC.PlayerID)
		f.enter(t, other, 1, secondID, 1, starterScrollPending)
	})

	expired := f.login(t, "entry-first", 1, "")
	revoked := f.login(t, "entry-first", 1, "")
	tutorialSQL(t, pool, `UPDATE account_session SET expires_at='2000-01-01 UTC' WHERE session_id=$1::uuid`, expired)
	tutorialSQL(t, pool, `DELETE FROM account_session WHERE session_id=$1::uuid`, revoked)
	for _, tc := range []struct{ name, session string }{
		{"missing", ""}, {"malformed", "not-a-session"}, {"absent", "00000000-0000-0000-0000-000000000001"},
		{"expired", expired}, {"revoked", revoked},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f.reject(t, entryWirePacket(tc.session, 1), commonv1.ErrorCode_COMMON_UNAUTHORIZED)
			// An unknown route proves the real validator rejects before dispatch.
			f.reject(t, &commonv1.ClientPacket{Route: "identity.test.Unknown", SessionId: tc.session}, commonv1.ErrorCode_COMMON_UNAUTHORIZED)
		})
	}
	t.Run("authenticated_unknown_route", func(t *testing.T) {
		f.reject(t, &commonv1.ClientPacket{Route: "identity.test.Unknown", SessionId: sid}, commonv1.ErrorCode_COMMON_INVALID_PACKET)
	})
	t.Run("bad_payload", func(t *testing.T) {
		p := entryWirePacket(sid, 1)
		p.Payload = []byte{0xff}
		f.reject(t, p, commonv1.ErrorCode_COMMON_INVALID_PACKET)
	})
	t.Run("missing_server", func(t *testing.T) {
		f.reject(t, entryWirePacket(sid, 99), commonv1.ErrorCode_ACCOUNT_SERVER_NOT_FOUND)
	})
	t.Run("unavailable_server", func(t *testing.T) {
		tutorialSQL(t, pool, `UPDATE game_server SET status=0 WHERE server_id=2`)
		f.reject(t, entryWirePacket(sid, 2), commonv1.ErrorCode_ACCOUNT_SERVER_UNAVAILABLE)
	})
	t.Run("no_player", func(t *testing.T) {
		f.reject(t, entryWirePacket(sid, 3), commonv1.ErrorCode_ACCOUNT_NO_PLAYER)
	})
}
