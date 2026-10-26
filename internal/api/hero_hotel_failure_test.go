package api

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
)

func TestHotelAtomicPGAllWriteFailuresRollback(t *testing.T) {
	for _, tc := range []struct {
		op          hotelOperation
		stage, fail string
	}{
		{hotelList, "allocation", `ALTER SEQUENCE city_hotel_candidate_id_seq RENAME TO unavailable_candidates`},
		{hotelList, "tick", `CREATE TRIGGER fail BEFORE INSERT ON city_hotel_schedule FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
		{hotelRefresh, "allocation-after-item", `ALTER SEQUENCE city_hotel_candidate_id_seq RENAME TO unavailable_candidates`},
		{hotelRefresh, "replacement-delete", `CREATE TRIGGER fail AFTER DELETE ON city_hotel_recruit FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
		{hotelRefresh, "replacement-insert", `CREATE TRIGGER fail AFTER INSERT ON city_hotel_recruit FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
		{hotelRefresh, "tick", `CREATE TRIGGER fail BEFORE INSERT ON city_hotel_schedule FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
		{hotelRefresh, "commit", `CREATE CONSTRAINT TRIGGER fail AFTER UPDATE ON city_hotel_schedule DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
		{hotelRecruit, "gold", `CREATE TRIGGER fail AFTER UPDATE ON player_wallet FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
		{hotelRecruit, "consume", `CREATE TRIGGER fail AFTER DELETE ON city_hotel_recruit FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
		{hotelRecruit, "insert", `CREATE TRIGGER fail BEFORE INSERT ON player_hero FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
		{hotelRecruit, "after-insert", `CREATE TRIGGER fail AFTER INSERT ON player_hero FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
		{hotelRecruit, "commit", `CREATE CONSTRAINT TRIGGER fail AFTER INSERT ON player_hero DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_hotel()`},
	} {
		t.Run(string(tc.op)+"/"+tc.stage, func(t *testing.T) {
			pool, s := hotelFixture(t)
			id := hotelListReply(t, s, 1).Candidates[0].CandidateId
			s.SetClock(func() time.Time { return hotelTestNow.Add(24 * time.Hour) })
			recruitSQL(t, pool, `CREATE FUNCTION fail_hotel() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private schema SQL failure'; END $$`)
			recruitSQL(t, pool, tc.fail)
			before := hotelState(t, pool)
			invalidations := 0
			s.hotel.invalidate = func(context.Context, content.PlayerRef) error { invalidations++; return nil }
			resp := s.GatewayRouter().Dispatch(context.Background(), hotelPacket(tc.op, 1, id))
			if resp.Code == 0 || strings.Contains(resp.Msg, "SQL") || invalidations != 0 {
				t.Fatalf("error/publication %+v count=%d", resp, invalidations)
			}
			if after := hotelState(t, pool); after != before {
				t.Fatalf("partial effects\nbefore %s\nafter %s", before, after)
			}
		})
	}
}

func TestHotelAtomicPGInsufficientAssetsCapacityAndSelectedRow(t *testing.T) {
	for _, kind := range []string{"gold", "item", "capacity", "missing-candidate", "negative-cost", "zero-cost"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := hotelFixture(t)
			id, op := hotelListReply(t, s, 1).Candidates[0].CandidateId, hotelRecruit
			switch kind {
			case "gold":
				recruitSQL(t, pool, `UPDATE player_wallet SET gold=0`)
			case "item":
				recruitSQL(t, pool, `UPDATE player_item SET quantity=0`)
				op = hotelRefresh
			case "capacity":
				recruitSQL(t, pool, `UPDATE city_building SET level=0 WHERE building_cfg_id=1`)
			case "missing-candidate":
				id = 9999
			case "negative-cost":
				recruitSQL(t, pool, `UPDATE city_hotel_recruit SET gold_cost=-1`)
			case "zero-cost":
				recruitSQL(t, pool, `UPDATE city_hotel_recruit SET gold_cost=0; UPDATE player_wallet SET gold=0`)
			}
			before, assets := hotelState(t, pool), readRecruitAssets(t, pool, 7)
			resp := s.GatewayRouter().Dispatch(context.Background(), hotelPacket(op, 1, id))
			if kind == "zero-cost" {
				assets.Heroes++
				if got := readRecruitAssets(t, pool, 7); resp.Code != 0 || got != assets {
					t.Fatalf("zero cost %+v %+v", resp, got)
				}
			} else if resp.Code == 0 || hotelState(t, pool) != before {
				t.Fatalf("failed rejection %+v", resp)
			}
		})
	}
}

func TestHotelAtomicPGCancellationHasNoPartialEffects(t *testing.T) {
	for _, tc := range []struct {
		op    hotelOperation
		stage string
	}{
		{hotelRefresh, "before-begin"}, {hotelRefresh, "after-item"}, {hotelRefresh, "after-replace"},
		{hotelRecruit, "after-gold"}, {hotelRecruit, "after-consume"}, {hotelRecruit, "after-hero"}, {hotelRecruit, "before-commit"},
	} {
		t.Run(tc.stage, func(t *testing.T) {
			pool, s := hotelFixture(t)
			id := hotelListReply(t, s, 1).Candidates[0].CandidateId
			before := hotelState(t, pool)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				tx, err := pool.BeginTx(ctx, opts)
				if err != nil {
					return nil, err
				}
				return &recruitObservedTx{Tx: tx,
					afterExec: func(q string) {
						if tc.stage == "after-gold" && strings.Contains(q, "UPDATE player_wallet") ||
							tc.stage == "after-consume" && strings.Contains(q, "DELETE FROM city_hotel_recruit") ||
							tc.stage == "after-replace" && strings.Contains(q, "INSERT INTO city_hotel_recruit") {
							cancel()
						}
					},
					afterRow: func(q string) {
						if tc.stage == "after-item" && strings.Contains(q, "UPDATE player_item") ||
							tc.stage == "after-hero" && strings.Contains(q, "INSERT INTO player_hero") {
							cancel()
						}
					},
					beforeCommit: func() {
						if tc.stage == "before-commit" {
							cancel()
						}
					},
				}, nil
			}
			if tc.stage == "before-begin" {
				cancel()
			}
			resp := s.GatewayRouter().Dispatch(ctx, hotelPacket(tc.op, 1, id))
			if resp.Code == 0 || hotelState(t, pool) != before {
				t.Fatalf("cancel effects %+v", resp)
			}
		})
	}
}

func TestHotelAtomicPGLostCommitAcknowledgementNeverReplays(t *testing.T) {
	for _, op := range []hotelOperation{hotelList, hotelRefresh, hotelRecruit} {
		t.Run(string(op), func(t *testing.T) {
			pool, s := hotelFixture(t)
			id := hotelListReply(t, s, 1).Candidates[0].CandidateId
			s.SetClock(func() time.Time { return hotelTestNow.Add(24 * time.Hour) })
			before := readRecruitAssets(t, pool, 7)
			begins, commits, invalidations := 0, 0, 0
			s.hotel.invalidate = func(context.Context, content.PlayerRef) error { invalidations++; return nil }
			s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				begins++
				tx, err := pool.BeginTx(ctx, opts)
				if err != nil {
					return nil, err
				}
				return &recruitObservedTx{Tx: tx, commits: &commits, afterCommit: func() error { return errors.New("private lost acknowledgement") }}, nil
			}
			var cost int64
			if err := pool.QueryRow(context.Background(), `SELECT gold_cost FROM city_hotel_recruit WHERE candidate_id=$1`, id).Scan(&cost); err != nil {
				t.Fatal(err)
			}
			resp := s.GatewayRouter().Dispatch(context.Background(), hotelPacket(op, 1, id))
			if resp.Code != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) || resp.Msg != "hotel outcome unavailable; reload state" || len(resp.Data) != 0 || begins != 1 || commits != 1 || invalidations != 0 {
				t.Fatalf("unknown %+v begin=%d commits=%d invalidations=%d", resp, begins, commits, invalidations)
			}
			want := before
			if op == hotelRefresh {
				want.Books--
			}
			if op == hotelRecruit {
				want.Wallet.Gold -= cost
				want.Heroes++
			}
			if got := readRecruitAssets(t, pool, 7); got != want {
				t.Fatalf("replay/compensation %+v want %+v", got, want)
			}
			var quests int
			if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM player_quest`).Scan(&quests); err != nil || quests != 0 {
				t.Fatalf("unknown quest %d %v", quests, err)
			}
		})
	}
}

func TestHotelAtomicPGPostcommitFailureRemainsSuccess(t *testing.T) {
	for _, op := range []hotelOperation{hotelRefresh, hotelRecruit} {
		t.Run(string(op), func(t *testing.T) {
			pool, s := hotelFixture(t)
			id := hotelListReply(t, s, 1).Candidates[0].CandidateId
			before := readRecruitAssets(t, pool, 7)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			commits, invalidations := 0, 0
			s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				tx, err := pool.BeginTx(ctx, opts)
				if err != nil {
					return nil, err
				}
				return &recruitObservedTx{Tx: tx, commits: &commits, afterCommit: func() error { cancel(); return nil }}, nil
			}
			s.hotel.invalidate = func(context.Context, content.PlayerRef) error {
				invalidations++
				if got := readRecruitAssets(t, pool, 7); got == before {
					t.Fatal("precommit invalidation")
				}
				return errors.New("injected postcommit cache failure")
			}
			// Force existing quest event/reconciliation storage to fail postcommit.
			recruitSQL(t, pool, `ALTER TABLE player_quest RENAME TO inaccessible_quests`)
			resp := s.GatewayRouter().Dispatch(ctx, hotelPacket(op, 1, id))
			if resp.Code != 0 || commits != 1 || invalidations != 1 {
				t.Fatalf("committed purchase failed %+v %d %d", resp, commits, invalidations)
			}
			// A later read failure cannot undo/replace the confirmed result.
			recruitSQL(t, pool, `ALTER TABLE city_hotel_recruit RENAME TO inaccessible_pool`)
			reload := s.GatewayRouter().Dispatch(context.Background(), hotelPacket(hotelList, 1, 0))
			if reload.Code == 0 || resp.Code != 0 || readRecruitAssets(t, pool, 7) == before {
				t.Fatal("lost confirmed outcome")
			}
		})
	}
}
