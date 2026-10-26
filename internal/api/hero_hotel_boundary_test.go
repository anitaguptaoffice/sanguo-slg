package api

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestHotelAtomicPGSingleConnectionAndTransactionOptions(t *testing.T) {
	base, _ := hotelFixture(t)
	cfg := base.Config()
	cfg.MaxConns = 1
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	s := hotelServer(t, pool)
	commits := 0
	s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
		if opts.IsoLevel != pgx.ReadCommitted {
			t.Fatalf("isolation %+v", opts)
		}
		tx, err := pool.BeginTx(ctx, opts)
		if err != nil {
			return nil, err
		}
		count := pool.Stat().AcquireCount()
		return &recruitObservedTx{Tx: tx, commits: &commits, beforeCommit: func() {
			if pool.Stat().AcquireCount() != count || pool.Stat().AcquiredConns() != 1 {
				t.Fatal("nested acquisition")
			}
		}}, nil
	}
	id := hotelListReply(t, s, 1).Candidates[0].CandidateId
	for _, op := range []hotelOperation{hotelRecruit, hotelRefresh} {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		resp := s.GatewayRouter().Dispatch(ctx, hotelPacket(op, 1, id))
		cancel()
		if resp.Code != 0 {
			t.Fatalf("nested-pool timeout %+v", resp)
		}
	}
	if commits != 3 {
		t.Fatalf("commit decisions %d", commits)
	}
}

func TestHotelAtomicPGDistinctParticipantPoolsFailClosed(t *testing.T) {
	for _, kind := range []string{"api", "hero", "candidate", "world", "domestic", "item"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := hotelFixture(t)
			peer := hotelPeer(t, pool).players.Pool // Same database/schema is still a distinct capability.
			switch kind {
			case "api":
				s.players.Pool = peer
			case "hero":
				s.hotel.heroes.Pool = peer
			case "candidate":
				s.hotel.candidates.Pool = peer
			case "world":
				s.hotel.owner.Pool = peer
			case "domestic":
				s.domestic.UseStore(domestic.NewPGStore(peer), 1, 0)
			case "item":
				s.hotel.itemStore.Pool = peer
			}
			before := hotelState(t, pool)
			for _, op := range []hotelOperation{hotelList, hotelRefresh, hotelRecruit} {
				resp := s.GatewayRouter().Dispatch(context.Background(), hotelPacket(op, 1, 100))
				if resp.Code != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) || hotelState(t, pool) != before {
					t.Fatalf("distinct participant accepted %+v", resp)
				}
			}
		})
	}
}

// The exposed content service is a postcommit cache only. Its private store is
// not introspectable here: same-object UseStore(otherPG) is not called detected.
// These assertions prove it cannot retarget the private transaction participant.
func TestHotelAtomicPGExposedCacheStoreCannotRedirectTransaction(t *testing.T) {
	for _, kind := range []string{"other-pg", "memory"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := hotelFixture(t)
			other, _ := hotelFixture(t)
			before, otherBefore := readRecruitAssets(t, pool, 7), hotelState(t, other)
			if kind == "other-pg" {
				s.contentSvc.UseStore(content.NewPGStore(other))
			} else {
				s.contentSvc.UseStore(nil)
			}
			acquires := other.Stat().AcquireCount()
			resp := s.GatewayRouter().Dispatch(context.Background(), hotelPacket(hotelRefresh, 1, 0))
			if other.Stat().AcquireCount() != acquires {
				t.Fatal("coordinator queried exposed cache store")
			}
			want := before
			if kind == "other-pg" {
				want.Books--
				if resp.Code != 0 {
					t.Fatalf("private participant failed %+v", resp)
				}
			} else if resp.Code != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) {
				t.Fatalf("memory fallback %+v", resp)
			}
			if readRecruitAssets(t, pool, 7) != want || hotelState(t, other) != otherBefore {
				t.Fatal("redirected debit")
			}
		})
	}
}

func TestHotelAtomicPGSnapshotNotPostcommitReload(t *testing.T) {
	pool, s := hotelFixture(t)
	s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
		tx, err := pool.BeginTx(ctx, opts)
		if err != nil {
			return nil, err
		}
		return &recruitObservedTx{Tx: tx, afterCommit: func() error {
			recruitSQL(t, pool, `UPDATE city_building SET level=7;
				INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,level,loyalty,force,intel,politics,command,status)
				VALUES(1,999999,7,0,1,70,1,2,3,4,0)`)
			return nil
		}}, nil
	}
	out := hotelListReply(t, s, 1)
	if len(out.Candidates) != 2 || out.HotelLevel != 2 || out.HeroCapacity != 2 || out.HeroOwned != 0 {
		t.Fatalf("unlocked reread response %+v", out)
	}
}

func TestHotelAtomicPGDoesNotWaitForHubWhileHoldingWallet(t *testing.T) {
	pool, s := hotelFixture(t)
	recruitSQL(t, pool, `INSERT INTO city_production_checkpoint(server_id,city_id,player_id,settled_at) VALUES(1,1,7,$1)`, hotelTestNow)
	if _, err := s.domestic.LoadCity(context.Background(), 1, 7); err != nil {
		t.Fatal(err)
	}
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
	s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
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
	hotelDone := make(chan *commonv1.ServerPacket, 1)
	go func() { hotelDone <- s.GatewayRouter().Dispatch(ctx, hotelPacket(hotelList, 1, 0)) }()
	select {
	case <-locked:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	writer := make(chan error, 1)
	go func() { _, err := s.domestic.SettleCity(ctx, 1); writer <- err }()
	hotelWaitForLock(t, ctx, pool, "SELECT food,wood,stone,iron FROM player_wallet%")
	close(release)
	if out := <-hotelDone; out.Code != 0 {
		t.Fatalf("Hub-wallet cycle %+v", out)
	}
	if err := <-writer; err != nil {
		t.Fatal("DOM writer did not resume", err)
	}
}
