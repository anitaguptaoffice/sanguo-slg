package api

import (
	"context"
	"strings"
	"testing"
	"time"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

func hotelPeer(t *testing.T, pool *pgxpool.Pool) *Server {
	t.Helper()
	other, err := pgxpool.NewWithConfig(context.Background(), pool.Config())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(other.Close)
	return hotelServer(t, other)
}

func hotelRace(t *testing.T, a, b *Server, p, q *commonv1.ClientPacket) [2]*commonv1.ServerPacket {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	start := make(chan struct{})
	done := make(chan struct {
		index    int
		response *commonv1.ServerPacket
	}, 2)
	for i, s := range []*Server{a, b} {
		pkt := []*commonv1.ClientPacket{p, q}[i]
		go func(i int, s *Server) {
			<-start
			done <- struct {
				index    int
				response *commonv1.ServerPacket
			}{i, s.GatewayRouter().Dispatch(ctx, pkt)}
		}(i, s)
	}
	close(start)
	var out [2]*commonv1.ServerPacket
	for i := 0; i < 2; i++ {
		select {
		case r := <-done:
			out[r.index] = r.response
		case <-ctx.Done():
			t.Fatal("concurrent operations did not finish")
		}
	}
	return out
}

func TestHotelAtomicPGConcurrentPoolsAndSingleFee(t *testing.T) {
	for _, kind := range []string{"first-list", "list-refresh", "one-item", "same-candidate", "cross-city-capacity", "list-consume", "refresh-consume"} {
		t.Run(kind, func(t *testing.T) {
			pool, a := hotelFixture(t)
			b := hotelPeer(t, pool)
			p, q := hotelPacket(hotelList, 1, 0), hotelPacket(hotelList, 1, 0)
			var selected *herov1.HotelRecruitCandidate
			if kind != "first-list" {
				selected = hotelListReply(t, a, 1).Candidates[0]
			}
			switch kind {
			case "list-refresh":
				q = hotelPacket(hotelRefresh, 1, 0)
			case "one-item":
				recruitSQL(t, pool, `UPDATE player_item SET quantity=1`)
				p, q = hotelPacket(hotelRefresh, 1, 0), hotelPacket(hotelRefresh, 1, 0)
			case "same-candidate":
				p, q = hotelPacket(hotelRecruit, 1, selected.CandidateId), hotelPacket(hotelRecruit, 1, selected.CandidateId)
			case "cross-city-capacity":
				second := hotelListReply(t, a, 2).Candidates[0]
				recruitSQL(t, pool, `UPDATE city_building SET level=1 WHERE building_cfg_id=1`)
				p, q = hotelPacket(hotelRecruit, 1, selected.CandidateId), hotelPacket(hotelRecruit, 2, second.CandidateId)
			case "list-consume":
				q = hotelPacket(hotelRecruit, 1, selected.CandidateId)
			case "refresh-consume":
				p, q = hotelPacket(hotelRefresh, 1, 0), hotelPacket(hotelRecruit, 1, selected.CandidateId)
			}
			before := readRecruitAssets(t, pool, 7)
			out := hotelRace(t, a, b, p, q)
			success := 0
			for _, r := range out {
				if r.Code == 0 {
					success++
				}
			}
			wantSuccess := 2
			if kind == "one-item" || kind == "same-candidate" || kind == "cross-city-capacity" {
				wantSuccess = 1
			}
			if kind == "refresh-consume" {
				wantSuccess = success
				if out[0].Code != 0 {
					t.Fatalf("refresh failed %+v", out)
				}
			}
			if success != wantSuccess {
				t.Fatalf("responses %+v %+v", out[0], out[1])
			}
			after := readRecruitAssets(t, pool, 7)
			var count, selectedCount int
			if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM city_hotel_recruit WHERE city_id=1`).Scan(&count); err != nil {
				t.Fatal(err)
			}
			if kind == "first-list" {
				var x, y herov1.ListHotelRecruitCandidatesResponse
				if proto.Unmarshal(out[0].Data, &x) != nil || proto.Unmarshal(out[1].Data, &y) != nil || !proto.Equal(&x, &y) || count != 2 || after != before {
					t.Fatal("first-list raced or charged")
				}
				return
			}
			if kind == "list-refresh" || kind == "one-item" {
				if after.Books != before.Books-1 || after.Wallet != before.Wallet || after.Heroes != before.Heroes || count != 2 {
					t.Fatalf("refresh effects %+v -> %+v count=%d", before, after, count)
				}
				return
			}
			if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM city_hotel_recruit WHERE candidate_id=$1`, selected.CandidateId).Scan(&selectedCount); err != nil {
				t.Fatal(err)
			}
			if kind == "cross-city-capacity" {
				if after.Heroes != before.Heroes+1 || after.Books != before.Books {
					t.Fatal("cross-city exceeded capacity")
				}
				return
			}
			want := before
			if kind == "refresh-consume" {
				want.Books--
			}
			if kind != "refresh-consume" || out[1].Code == 0 {
				want.Heroes++
				want.Wallet.Gold -= selected.GoldCost
			}
			if after != want || selectedCount != 0 || count > 2 || count < 1 {
				t.Fatalf("consume resurrected/partial %+v want %+v rows=%d selected=%d", after, want, count, selectedCount)
			}
		})
	}
}

func hotelWaitForLock(t *testing.T, ctx context.Context, pool *pgxpool.Pool, pattern string) {
	t.Helper()
	for {
		var blocked bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1)`, pattern).Scan(&blocked); err != nil {
			t.Fatal(err)
		}
		if blocked {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatal("expected SQL lock not observed")
		case <-time.After(time.Millisecond):
		}
	}
}

func TestHotelAtomicPGOwnerChangeWaitsAndIsRechecked(t *testing.T) {
	for _, first := range []string{"hotel", "owner"} {
		t.Run(first, func(t *testing.T) {
			pool, s := hotelFixture(t)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if first == "owner" {
				tx, err := pool.Begin(ctx)
				if err != nil {
					t.Fatal(err)
				}
				defer tx.Rollback(context.Background())
				if _, err = tx.Exec(ctx, `UPDATE player_city SET player_id=9 WHERE city_id=1`); err != nil {
					t.Fatal(err)
				}
				before := hotelState(t, pool)
				done := make(chan *commonv1.ServerPacket, 1)
				go func() { done <- s.GatewayRouter().Dispatch(ctx, hotelPacket(hotelList, 1, 0)) }()
				hotelWaitForLock(t, ctx, pool, "SELECT player_id FROM player_city%")
				if err = tx.Commit(ctx); err != nil {
					t.Fatal(err)
				}
				if r := <-done; r.Code == 0 || hotelState(t, pool) != before {
					t.Fatalf("stale owner %+v", r)
				}
				return
			}
			locked, release := make(chan struct{}), make(chan struct{})
			defer func() {
				select {
				case <-release:
				default:
					close(release)
				}
			}()
			s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				tx, err := pool.BeginTx(ctx, opts)
				if err != nil {
					return nil, err
				}
				return &recruitObservedTx{Tx: tx, afterRow: func(q string) {
					if strings.Contains(q, "FROM player_city") {
						close(locked)
						select {
						case <-release:
						case <-ctx.Done():
						}
					}
				}}, nil
			}
			done := make(chan *commonv1.ServerPacket, 1)
			go func() { done <- s.GatewayRouter().Dispatch(ctx, hotelPacket(hotelList, 1, 0)) }()
			select {
			case <-locked:
			case <-ctx.Done():
				t.Fatal(ctx.Err())
			}
			changed := make(chan error, 1)
			go func() { _, err := pool.Exec(ctx, `UPDATE player_city SET player_id=9 WHERE city_id=1`); changed <- err }()
			hotelWaitForLock(t, ctx, pool, "UPDATE player_city SET player_id=9%")
			close(release)
			if r := <-done; r.Code != 0 {
				t.Fatalf("authorized operation %+v", r)
			}
			if err := <-changed; err != nil {
				t.Fatal(err)
			}
			s.hotel.begin = pool.BeginTx
			before := hotelState(t, pool)
			if r := s.GatewayRouter().Dispatch(ctx, hotelPacket(hotelRefresh, 1, 0)); r.Code == 0 || hotelState(t, pool) != before {
				t.Fatalf("new owner ignored %+v", r)
			}
		})
	}
}

func TestHotelAtomicPGOrdersAgainstNaturalWithoutNewCapacityRule(t *testing.T) {
	for _, first := range []string{"natural", "hotel"} {
		t.Run(first, func(t *testing.T) {
			pool, h := hotelFixture(t)
			n := hotelPeer(t, pool)
			n.sessions.Bind("recruit", PlayerContext{ServerID: 1, PlayerID: 7})
			id := hotelListReply(t, h, 1).Candidates[0].CandidateId
			recruitSQL(t, pool, `UPDATE city_building SET level=1 WHERE building_cfg_id=1`)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			locked, release := make(chan struct{}), make(chan struct{})
			defer func() {
				select {
				case <-release:
				default:
					close(release)
				}
			}()
			bind := func(pool *pgxpool.Pool) func(context.Context, pgx.TxOptions) (pgx.Tx, error) {
				return func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
					tx, err := pool.BeginTx(ctx, opts)
					if err != nil {
						return nil, err
					}
					return &recruitObservedTx{Tx: tx, afterRow: func(q string) {
						if strings.Contains(q, "SELECT food,wood,stone,iron,gold FROM player_wallet") {
							close(locked)
							select {
							case <-release:
							case <-ctx.Done():
							}
						}
					}}, nil
				}
			}
			hotelDone, naturalDone := make(chan *commonv1.ServerPacket, 1), make(chan *commonv1.ServerPacket, 1)
			if first == "natural" {
				n.recruit.begin = bind(n.players.Pool)
				go func() { naturalDone <- n.GatewayRouter().Dispatch(ctx, recruitPacket(1001)) }()
			} else {
				h.hotel.begin = bind(pool)
				go func() { hotelDone <- h.GatewayRouter().Dispatch(ctx, hotelPacket(hotelRecruit, 1, id)) }()
			}
			select {
			case <-locked:
			case <-ctx.Done():
				t.Fatal(ctx.Err())
			}
			if first == "natural" {
				go func() { hotelDone <- h.GatewayRouter().Dispatch(ctx, hotelPacket(hotelRecruit, 1, id)) }()
			} else {
				go func() { naturalDone <- n.GatewayRouter().Dispatch(ctx, recruitPacket(1001)) }()
			}
			hotelWaitForLock(t, ctx, pool, "SELECT food,wood,stone,iron,gold FROM player_wallet%")
			close(release)
			hotel, natural := <-hotelDone, <-naturalDone
			want := 2
			if first == "natural" {
				want = 1
			}
			if natural.Code != 0 || (hotel.Code == 0) != (first == "hotel") || readRecruitAssets(t, pool, 7).Heroes != want {
				t.Fatalf("ordering hotel=%+v natural=%+v", hotel, natural)
			}
		})
	}
}
