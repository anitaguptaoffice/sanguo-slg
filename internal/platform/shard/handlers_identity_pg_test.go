package shard

import (
	"context"
	"crypto/rand"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	commonpb "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const identityAccountA int64 = 9007199254740993

type identityBinding struct {
	session string
	server  int32
	player  int64
	account int64
}

type identityBinder struct{ calls []identityBinding }

func (b *identityBinder) BindSession(session string, server int32, player, accountID int64) {
	b.calls = append(b.calls, identityBinding{session, server, player, accountID})
}

type identityFixture struct {
	ctx    context.Context
	pool   *pgxpool.Pool
	svc    *account.Service
	store  *account.Store
	h      *Handlers
	binder *identityBinder
}

func newIdentityFixture(t *testing.T) *identityFixture {
	t.Helper()
	dsn := os.Getenv("SHARD_IDENTITY_TEST_DSN")
	if dsn == "" {
		t.Skip("newly owned disposable PostgreSQL 17 DSN required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	t.Cleanup(cancel)
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	var suffix [8]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("shard_identity_%x", suffix)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	var version int
	if err := pool.QueryRow(ctx, "SELECT current_setting('server_version_num')::int").Scan(&version); err != nil || version/10000 != 17 {
		t.Fatalf("PG17 required: version=%d err=%v", version, err)
	}
	if _, err := pool.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		if _, err := pool.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Errorf("isolated schema cleanup: %v", err)
		}
	})
	f := &identityFixture{ctx: ctx, pool: pool, store: account.NewStore(pool), binder: &identityBinder{}}
	f.svc = account.NewService(f.store)
	f.h = NewHandlers(&Store{Pool: pool}, f.svc, f.binder)
	for _, name := range []string{"001_account.sql", "003_domestic.sql"} {
		sql, err := os.ReadFile(filepath.Join("..", "..", "..", "spec", "db", name))
		if err != nil {
			t.Fatal(err)
		}
		f.exec(t, string(sql))
	}
	hash, err := account.HashPassword("fixture-password")
	if err != nil {
		t.Fatal(err)
	}
	for i, id := range []int64{identityAccountA, math.MaxInt64, 0, -1} {
		f.exec(t, `INSERT INTO account (account_id, login_name, password_hash)
			OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3)`, id, fmt.Sprintf("identity-%d", i), hash)
		f.exec(t, `INSERT INTO player (server_id, player_id, account_id, display_name, level, power)
			VALUES (1, $1, $2, $3, 7, 12345)`, int64(101+i), id, fmt.Sprintf("player-%d", 101+i))
	}
	f.exec(t, `INSERT INTO game_server (server_id, display_name, status)
		VALUES (1, 'one', 1), (2, 'two', 2), (3, 'maintenance', 0), (4, 'stopped', 3), (5, 'empty', 1)`)
	f.exec(t, `INSERT INTO player (server_id, player_id, account_id, display_name, level, power)
		VALUES (2, 201, $1, 'player-201', 7, 12345)`, identityAccountA)
	f.exec(t, `INSERT INTO player_wallet (server_id, player_id, food, wood, iron, stone, gold)
		VALUES (1, 101, 11, 12, 13, 14, 15), (1, 102, 21, 22, 23, 24, 25)`)
	return f
}

func (f *identityFixture) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := f.pool.Exec(f.ctx, sql, args...); err != nil {
		t.Fatal(err)
	}
}

func (f *identityFixture) login(t *testing.T, name string, server int32) string {
	t.Helper()
	resp, err := f.svc.Login(f.ctx, name, "fixture-password", server)
	if err != nil {
		t.Fatal(err)
	}
	return resp.GetSessionId()
}

func (f *identityFixture) enter(t *testing.T, session string, server int32, payload []byte) *commonv1.ServerPacket {
	t.Helper()
	if payload == nil {
		var err error
		payload, err = proto.Marshal(&accountv1.EnterGameServerRequest{ServerId: server})
		if err != nil {
			t.Fatal(err)
		}
	}
	packet, err := f.h.GatewayHandlers()[RouteEnterGameServer](f.ctx, &commonv1.ClientPacket{
		SessionId: session, Payload: payload, TraceId: "identity-test",
	})
	if err != nil || packet == nil {
		t.Fatalf("entry packet=%v err=%v", packet, err)
	}
	if packet.GetTraceId() != "identity-test" {
		t.Fatal("trace changed")
	}
	return packet
}

func TestEnterGameServerAuthenticatedIdentity(t *testing.T) {
	f := newIdentityFixture(t)
	first := f.login(t, "identity-0", 1)
	second := f.login(t, "identity-0", 1)
	otherShard := f.login(t, "identity-0", 2)
	otherAccount := f.login(t, "identity-1", 1)
	seen := map[string]bool{}
	for _, session := range []string{first, second, otherShard, otherAccount} {
		if session == "" || seen[session] {
			t.Fatal("credential logins must create distinct nonempty sessions")
		}
		seen[session] = true
	}
	walletA := &commonpb.ResourceWallet{Food: 11, Wood: 12, Iron: 13, Stone: 14, Gold: 15}
	walletB := &commonpb.ResourceWallet{Food: 21, Wood: 22, Iron: 23, Stone: 24, Gold: 25}
	for _, tc := range []struct {
		name, session string
		server        int32
		player, id    int64
		wallet        *commonpb.ResourceWallet
	}{
		{"first_login", first, 1, 101, identityAccountA, walletA},
		{"relogin", second, 1, 101, identityAccountA, walletA},
		{"other_shard_missing_wallet", otherShard, 2, 201, identityAccountA, &commonpb.ResourceWallet{}},
		{"different_account_max_int64", otherAccount, 1, 102, math.MaxInt64, walletB},
		{"renewed_session", first, 1, 101, identityAccountA, walletA},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f.binder.calls = nil
			if tc.name == "renewed_session" {
				if _, err := f.svc.RefreshSession(f.ctx, tc.session); err != nil {
					t.Fatal(err)
				}
			}
			packet := f.enter(t, tc.session, tc.server, nil)
			if packet.GetCode() != 0 {
				t.Fatalf("entry rejected: %v", packet)
			}
			var got accountv1.EnterGameServerResponse
			if err := proto.Unmarshal(packet.GetData(), &got); err != nil {
				t.Fatal(err)
			}
			id, expiry, err := f.h.store.SessionAccount(f.ctx, tc.session)
			if err != nil || id != tc.id {
				t.Fatalf("authoritative session: id=%d err=%v", id, err)
			}
			want := &accountv1.EnterGameServerResponse{
				SessionId: tc.session, ServerId: tc.server, SessionExpiresAtMs: expiry.UnixMilli(), AccountId: tc.id,
				Player: &commonpb.PlayerProfile{ServerId: tc.server, PlayerId: tc.player,
					DisplayName: fmt.Sprintf("player-%d", tc.player), Level: 7, Power: 12345},
				Wallet: tc.wallet,
			}
			if !proto.Equal(&got, want) {
				t.Fatalf("entry=%v want=%v", &got, want)
			}
			if len(f.binder.calls) != 1 || f.binder.calls[0] != (identityBinding{tc.session, tc.server, tc.player, tc.id}) {
				t.Fatalf("wrong binding: %+v", f.binder.calls)
			}
		})
	}
	var count int
	if err := f.pool.QueryRow(f.ctx, "SELECT count(*) FROM player_wallet").Scan(&count); err != nil || count != 2 {
		t.Fatalf("entry created wallet: rows=%d err=%v", count, err)
	}
}

func TestEnterGameServerRejectsUnauthenticatedIdentity(t *testing.T) {
	f := newIdentityFixture(t)
	valid := f.login(t, "identity-0", 1)
	sessions := map[string]string{"valid": valid}
	boundary := time.Now().Add(time.Hour).Truncate(time.Microsecond)
	for _, tc := range []struct {
		name   string
		id     int64
		expiry time.Time
	}{
		{"expired", identityAccountA, time.Now().Add(-time.Hour)},
		{"zero", 0, boundary}, {"negative", -1, boundary},
		{"expiry_boundary", identityAccountA, boundary},
	} {
		session, err := f.store.CreateSession(f.ctx, tc.id, tc.expiry)
		if err != nil {
			t.Fatal(err)
		}
		sessions[tc.name] = session
	}
	for _, tc := range []struct {
		name, session string
		server        int32
		payload       []byte
		code          commonv1.ErrorCode
	}{
		{"missing", "", 1, nil, commonv1.ErrorCode_COMMON_UNAUTHORIZED},
		{"malformed", "not-a-uuid", 1, nil, commonv1.ErrorCode_COMMON_UNAUTHORIZED},
		{"unknown", "00000000-0000-0000-0000-000000000000", 1, nil, commonv1.ErrorCode_COMMON_UNAUTHORIZED},
		{"expired", sessions["expired"], 1, nil, commonv1.ErrorCode_COMMON_UNAUTHORIZED},
		{"zero", sessions["zero"], 1, nil, commonv1.ErrorCode_COMMON_UNAUTHORIZED},
		{"negative", sessions["negative"], 1, nil, commonv1.ErrorCode_COMMON_UNAUTHORIZED},
		{"expiry_boundary", sessions["expiry_boundary"], 1, nil, commonv1.ErrorCode_COMMON_UNAUTHORIZED},
		{"malformed_payload", valid, 1, []byte{0x80}, commonv1.ErrorCode_COMMON_INVALID_PACKET},
		{"missing_server", valid, 0, nil, commonv1.ErrorCode_COMMON_INVALID_PACKET},
		{"unknown_server", valid, 99, nil, commonv1.ErrorCode_ACCOUNT_SERVER_NOT_FOUND},
		{"maintenance", valid, 3, nil, commonv1.ErrorCode_ACCOUNT_SERVER_UNAVAILABLE},
		{"stopped", valid, 4, nil, commonv1.ErrorCode_ACCOUNT_SERVER_UNAVAILABLE},
		{"no_player", valid, 5, nil, commonv1.ErrorCode_ACCOUNT_NO_PLAYER},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f.binder.calls = nil
			f.h.now = time.Now
			if tc.name == "expiry_boundary" {
				f.h.now = func() time.Time { return boundary }
			}
			packet := f.enter(t, tc.session, tc.server, tc.payload)
			if packet.GetCode() != int32(tc.code) || len(packet.GetData()) != 0 || len(f.binder.calls) != 0 {
				t.Fatalf("rejection leaked success: packet=%v bindings=%+v", packet, f.binder.calls)
			}
		})
	}
}
