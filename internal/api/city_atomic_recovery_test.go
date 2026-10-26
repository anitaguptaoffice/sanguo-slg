package api

import (
	"bytes"
	"context"
	"errors"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func atomicCityPeer(model *Server, pool *pgxpool.Pool, now time.Time) *Server {
	h := domestic.NewHub(func() time.Time { return now })
	h.UseStore(domestic.NewPGStore(pool), 1, 0)
	// WORLD must use only the DOM-supplied transaction, not its own Pool.
	s := NewServer(model.log, pool, world.NewService(world.NewPGStore(nil)), h, march.NewHub(nil))
	s.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: 55})
	return s
}

func TestCreateCityAtomicConcurrentRequests(t *testing.T) {
	for _, tc := range []struct {
		name                         string
		sameCoordinate, sharedWallet bool
	}{
		{"distinct-shared-wallet", false, true},
		{"distinct-independent-wallets", false, false},
		{"same-independent-wallets", true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, pool, now, _ := registrationServer(t)
			peer := atomicCityPeer(s, pool, now)
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			wallets := 1
			if !tc.sharedWallet {
				wallets = 2
				if _, err := pool.Exec(ctx, `WITH a AS (INSERT INTO account(login_name,password_hash) VALUES('concurrent','test') RETURNING account_id)
 INSERT INTO player(server_id,player_id,account_id,display_name) SELECT 1,56,account_id,'concurrent' FROM a;
 INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,56,1000)`); err != nil {
					t.Fatal(err)
				}
				peer.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: 56})
				// Both independent wallets must be locked before either participant
				// proceeds, so the WORLD advisory lock actually sees contention.
				var arrivals atomic.Int32
				gate := make(chan struct{})
				participant := &atomicCityWorld{insert: func(ctx context.Context, tx pgx.Tx, c world.City) (world.City, error) {
					if arrivals.Add(1) == 2 {
						close(gate)
					}
					select {
					case <-gate:
					case <-ctx.Done():
						return world.City{}, ctx.Err()
					}
					return world.NewPGStore(nil).CreateCityInTx(ctx, tx, c)
				}}
				s.world, peer.world = world.NewService(participant), world.NewService(participant)
			}
			servers := []*Server{s, peer, s, peer}
			type result struct {
				s   *Server
				out *commonv1.ServerPacket
				err error
			}
			start, results := make(chan struct{}), make(chan result, len(servers))
			for i, server := range servers {
				index := i
				if tc.sameCoordinate {
					index = 0
				}
				pkt := atomicCityPacket(t, index)
				go func(s *Server) {
					<-start
					out, err := s.handleCreateCity(ctx, pkt)
					results <- result{s, out, err}
				}(server)
			}
			close(start)
			ids := map[int64]bool{}
			for range servers {
				r := <-results
				if r.err != nil || r.out == nil {
					t.Fatalf("create: %+v %v", r.out, r.err)
				}
				if r.out.Code != 0 {
					if !tc.sameCoordinate || r.out.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || r.out.Msg != "coordinate occupied" {
						t.Fatalf("unexpected loser: %+v", r.out)
					}
					continue
				}
				var decoded worldv1.CreateCityResponse
				if err := unmarshal(r.out.Data, &decoded); err != nil {
					t.Fatal(err)
				}
				id := decoded.GetCity().GetCityId()
				if id <= 0 || ids[id] || r.s.citySnapshot(id) == nil || r.s.military.SnapshotCity(id) == nil {
					t.Fatalf("duplicate ID or missing committed publication: %d", id)
				}
				if _, ok := r.s.cityCoordinate(id); !ok {
					t.Fatal("missing coordinates")
				}
				ids[id] = true
			}
			want := len(servers)
			if tc.sameCoordinate {
				want = 1
			}
			if len(ids) != want {
				t.Fatalf("created %d want %d", len(ids), want)
			}
			assertRegistrationRows(t, pool, want, want, 2*want)
			var food int64
			if err := pool.QueryRow(context.Background(), "SELECT sum(food) FROM player_wallet").Scan(&food); err != nil || food != int64(wallets*1000) {
				t.Fatalf("shared wallet regranted or lost: %d %v", food, err)
			}
		})
	}
}

// Drop a real PostgreSQL COMMIT acknowledgement only after the server sent its
// successful command tag. This is a client-unknown outcome, not a SQL rejection.
// This fixture uses plaintext isolated PG; it does not simulate power-loss safety.
type cityCommitAckLoss struct {
	net.Conn
	commits *atomic.Int32
	dropped *atomic.Bool
	armed   atomic.Bool
	readMu  sync.Mutex
	tail    []byte
}

func (c *cityCommitAckLoss) Write(p []byte) (int, error) {
	if bytes.Contains(p, []byte("commit\x00")) {
		c.commits.Add(1)
		c.armed.Store(true)
	}
	return c.Conn.Write(p)
}

func (c *cityCommitAckLoss) Read(p []byte) (int, error) {
	c.readMu.Lock()
	defer c.readMu.Unlock()
	n, err := c.Conn.Read(p)
	if c.armed.Load() && n > 0 {
		seen := append(c.tail, p[:n]...)
		if bytes.Contains(seen, []byte("COMMIT\x00")) {
			c.dropped.Store(true)
			_ = c.Conn.Close()
			return 0, errors.New("injected lost city commit acknowledgement")
		}
		if len(seen) > 6 {
			seen = seen[len(seen)-6:]
		}
		c.tail = append([]byte(nil), seen...)
	}
	return n, err
}

func TestCreateCityAtomicUnknownCommitAndReload(t *testing.T) {
	base, pool, now, log := registrationServer(t)
	cfg := pool.Config()
	if cfg.ConnConfig.TLSConfig != nil {
		t.Skip("commit-ack fault requires plaintext isolated PostgreSQL")
	}
	var commits atomic.Int32
	var dropped atomic.Bool
	dial := cfg.ConnConfig.DialFunc
	cfg.ConnConfig.DialFunc = func(ctx context.Context, network, address string) (net.Conn, error) {
		conn, err := dial(ctx, network, address)
		if err != nil {
			return nil, err
		}
		return &cityCommitAckLoss{Conn: conn, commits: &commits, dropped: &dropped}, nil
	}
	faultPool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer faultPool.Close()
	s := atomicCityPeer(base, faultPool, now)
	var calls atomic.Int32
	s.world = world.NewService(&atomicCityWorld{insert: func(ctx context.Context, tx pgx.Tx, c world.City) (world.City, error) {
		calls.Add(1)
		return world.NewPGStore(nil).CreateCityInTx(ctx, tx, c)
	}})
	pkt := registrationPacket(t, 1)
	out, err := s.handleCreateCity(context.Background(), pkt)
	if err != nil || out == nil || out.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || out.Msg != "city creation failed; reload cities before retry" || !dropped.Load() || commits.Load() != 1 || calls.Load() != 1 {
		t.Fatalf("unknown outcome: %+v %v dropped=%v commits=%d calls=%d", out, err, dropped.Load(), commits.Load(), calls.Load())
	}
	assertRegistrationUnavailable(t, s)
	if strings.Contains(log.String(), "create_city") {
		t.Fatal("unconfirmed commit emitted success")
	}
	// For this injected lost acknowledgement the server really committed. A
	// separate normal connection sees complete state, never a partial city.
	assertRegistrationRows(t, pool, 1, 1, 2)
	freshPool, err := pgxpool.NewWithConfig(context.Background(), pool.Config())
	if err != nil {
		t.Fatal(err)
	}
	defer freshPool.Close()
	fresh := atomicCityPeer(base, freshPool, now)
	fresh.world = world.NewService(world.NewPGStore(freshPool))
	listed, err := fresh.handleListPlayerCities(context.Background(), &commonv1.ClientPacket{SessionId: "owner"})
	var list worldv1.ListPlayerCitiesResponse
	if err != nil || listed.Code != 0 || unmarshal(listed.Data, &list) != nil || len(list.Cities) != 1 {
		t.Fatalf("unknown-commit recovery list: %+v %v", listed, err)
	}
	fresh.hydratePlayerCities(context.Background(), PlayerContext{ServerID: 1, PlayerID: 55})
	if c := fresh.citySnapshot(1); c == nil || c.Wallet.Food != 1000 || !c.LastSettleAt.Equal(now) || fresh.military.SnapshotCity(1) == nil {
		t.Fatalf("complete recovery: %+v", c)
	}
	out, err = fresh.handleCreateCity(context.Background(), pkt)
	if err != nil || out == nil || out.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || out.Msg != "coordinate occupied" {
		t.Fatalf("explicit retry must not adopt or regrant: %+v %v", out, err)
	}
	assertRegistrationRows(t, pool, 1, 1, 2)
}
