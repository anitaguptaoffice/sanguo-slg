package api

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// These wrappers only inject failure timing around real PG operations. Production
// wiring and participants remain unchanged; no alternate inventory is simulated.
type recruitObservedTx struct {
	pgx.Tx
	afterExec    func(string)
	afterRow     func(string)
	beforeCommit func()
	afterCommit  func() error
	commits      *int
}

func (tx *recruitObservedTx) Exec(ctx context.Context, q string, args ...any) (pgconn.CommandTag, error) {
	tag, err := tx.Tx.Exec(ctx, q, args...)
	if err == nil && tx.afterExec != nil {
		tx.afterExec(q)
	}
	return tag, err
}
func (tx *recruitObservedTx) QueryRow(ctx context.Context, q string, args ...any) pgx.Row {
	return recruitObservedRow{Row: tx.Tx.QueryRow(ctx, q, args...), after: func() {
		if tx.afterRow != nil {
			tx.afterRow(q)
		}
	}}
}
func (tx *recruitObservedTx) Commit(ctx context.Context) error {
	if tx.commits != nil {
		*tx.commits++
	}
	if tx.beforeCommit != nil {
		tx.beforeCommit()
	}
	if err := tx.Tx.Commit(ctx); err != nil {
		return err
	}
	if tx.afterCommit != nil {
		return tx.afterCommit()
	}
	return nil
}

type recruitObservedRow struct {
	pgx.Row
	after func()
}

func (r recruitObservedRow) Scan(dest ...any) error {
	err := r.Row.Scan(dest...)
	if err == nil {
		r.after()
	}
	return err
}

func TestRecruitAtomicPGCancellationBoundaries(t *testing.T) {
	for _, stage := range []string{"before-begin", "after-wallet", "after-item", "after-insert", "before-commit"} {
		t.Run(stage, func(t *testing.T) {
			pool := walletBoundaryPool(t, true)
			seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 56}, 2)
			s := recruitServer(t, pool, 7)
			before := readRecruitAssets(t, pool, 7)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			invalidations := 0
			s.recruit.invalidate = func(context.Context, content.PlayerRef) error { invalidations++; return nil }
			s.recruit.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				tx, err := pool.BeginTx(ctx, opts)
				if err != nil {
					return nil, err
				}
				return &recruitObservedTx{Tx: tx,
					afterExec: func(q string) {
						if stage == "after-wallet" && strings.Contains(q, "UPDATE player_wallet") {
							cancel()
						}
					},
					afterRow: func(q string) {
						if stage == "after-item" && strings.Contains(q, "UPDATE player_item") || stage == "after-insert" && strings.Contains(q, "INSERT INTO player_hero") {
							cancel()
						}
					},
					beforeCommit: func() {
						if stage == "before-commit" {
							cancel()
						}
					},
				}, nil
			}
			if stage == "before-begin" {
				cancel()
			}
			resp := s.GatewayRouter().Dispatch(ctx, recruitPacket(1001))
			if resp.Code == 0 || invalidations != 0 {
				t.Fatalf("cancel publication: %+v invalidations=%d", resp, invalidations)
			}
			if after := readRecruitAssets(t, pool, 7); after != before {
				t.Fatalf("cancel assets: %+v -> %+v", before, after)
			}
		})
	}
}

func TestRecruitAtomicPGPostCommitInvalidationFailureStillSuccess(t *testing.T) {
	for _, kind := range []string{"error", "canceled-context"} {
		t.Run(kind, func(t *testing.T) {
			pool := walletBoundaryPool(t, true)
			seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 56}, 2)
			s := recruitServer(t, pool, 7)
			p := content.PlayerRef{ServerID: 1, PlayerID: 7}
			if err := s.contentSvc.LoadPlayer(context.Background(), p); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			commits, invalidations := 0, 0
			invalidate := s.recruit.invalidate
			s.recruit.invalidate = func(ctx context.Context, p content.PlayerRef) error {
				invalidations++
				if assets := readRecruitAssets(t, pool, 7); assets.Heroes != 1 || assets.Books != 1 {
					t.Fatalf("early invalidation %+v", assets)
				}
				if kind == "error" {
					return errors.New("injected invalidation failure")
				}
				return invalidate(ctx, p)
			}
			s.recruit.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				tx, err := pool.BeginTx(ctx, opts)
				if err != nil {
					return nil, err
				}
				return &recruitObservedTx{Tx: tx, commits: &commits,
					afterRow: func(q string) {
						if strings.Contains(q, "INSERT INTO player_hero") && s.contentSvc.List(p)[0].Quantity != 2 {
							t.Fatal("precommit cache publication")
						}
					},
					afterCommit: func() error {
						if kind == "canceled-context" {
							cancel()
						}
						return nil
					},
				}, nil
			}
			out := recruitReply(t, s.GatewayRouter().Dispatch(ctx, recruitPacket(1001)))
			if commits != 1 || invalidations != 1 || out.HeroId <= 0 {
				t.Fatalf("postcommit: commits=%d invalidations=%d out=%+v", commits, invalidations, out)
			}
			if err := s.contentSvc.LoadPlayer(context.Background(), p); err != nil {
				t.Fatal(err)
			}
			if bag := s.contentSvc.List(p); len(bag) != 1 || bag[0].Quantity != 1 {
				t.Fatalf("next read not durable: %+v", bag)
			}
		})
	}
}

func TestRecruitAtomicPGUnconfirmedCommitNeverReplays(t *testing.T) {
	pool := walletBoundaryPool(t, true)
	seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 56}, 2)
	s := recruitServer(t, pool, 7)
	begins, commits, invalidations := 0, 0, 0
	s.recruit.invalidate = func(context.Context, content.PlayerRef) error { invalidations++; return nil }
	s.recruit.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
		begins++
		tx, err := pool.BeginTx(ctx, opts)
		if err != nil {
			return nil, err
		}
		// The server has committed, but the client cannot confirm it. A rollback call
		// cannot undo this state, and returning an error must never cause a retry.
		return &recruitObservedTx{Tx: tx, commits: &commits, afterCommit: func() error { return errors.New("lost commit acknowledgement") }}, nil
	}
	before := readRecruitAssets(t, pool, 7)
	resp := s.GatewayRouter().Dispatch(context.Background(), recruitPacket(1001))
	if resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || begins != 1 || commits != 1 || invalidations != 0 || strings.Contains(resp.Msg, "rollback") {
		t.Fatalf("unknown outcome: %+v begins=%d commits=%d invalidations=%d", resp, begins, commits, invalidations)
	}
	want := before
	want.Wallet.Sub(s.heroSvc.Catalog[1001].RecruitCost)
	want.Books--
	want.Heroes++
	if after := readRecruitAssets(t, pool, 7); after != want {
		t.Fatalf("unknown outcome replay/compensation: %+v want %+v", after, want)
	}
}
