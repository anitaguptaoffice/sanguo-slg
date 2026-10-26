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
	"github.com/jackc/pgx/v5/pgxpool"
)

func familyFailureFixture(t *testing.T, op string) (*pgxpool.Pool, *Server, *commonv1.ClientPacket) {
	t.Helper()
	pool, s := hotelFixture(t)
	route, status := RouteSureAcceptComing, hero.StatusComing
	switch op {
	case "reject":
		route = RouteRejectComing
	case "preview":
		route, status = RouteTrySummonCaptive, hero.StatusCaptive
	case "summon":
		route, status = RouteSureSummonCaptive, hero.StatusCaptive
	case "release":
		route, status = RouteReleaseCaptive, hero.StatusCaptive
	case "befriend", "hire", "persuade":
		npc := hero.DefaultPersuadeTargets()[0].NpcCfgID
		if op != "befriend" {
			friend := hero.LionizeInitialFriend
			if op == "hire" {
				friend = hero.LionizeHireFriendMin
			}
			recruitSQL(t, pool, `INSERT INTO player_hero_lionize(server_id,player_id,npc_cfg_id,friend,state) VALUES(1,7,$1,$2,1)`, npc, friend)
		}
		recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,7,$1,10) ON CONFLICT(server_id,player_id,item_cfg_id) DO UPDATE SET quantity=10`, hero.PersuadeItemCfgID)
		route = RouteLionizeHero
		if op == "persuade" {
			route = RoutePersuadeHero
		}
		return pool, s, familyPacket(route, 1, 0, npc)
	}
	h := familySeed(t, s, status, 1, 60)
	if status == hero.StatusCaptive {
		familyCaptiveItemCatalog(t, s)
	}
	recruitSQL(t, pool, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES(1,7,$1,10) ON CONFLICT(server_id,player_id,item_cfg_id) DO UPDATE SET quantity=10`, hero.CaptiveSummonItemCfgID)
	return pool, s, familyPacket(route, 0, h.HeroID, 0)
}

func TestFamilyAtomicPGAllWriteFailuresRollback(t *testing.T) {
	for _, tc := range []struct{ op, stage, sql string }{
		{"accept", "consume", `CREATE TRIGGER fail AFTER DELETE ON player_hero_coming FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"accept", "status", `CREATE TRIGGER fail AFTER UPDATE ON player_hero FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"accept", "commit", `CREATE CONSTRAINT TRIGGER fail AFTER UPDATE ON player_hero DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"reject", "hero-delete", `CREATE TRIGGER fail AFTER DELETE ON player_hero FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"preview", "metadata-update", `CREATE TRIGGER fail AFTER UPDATE ON player_hero_captive FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"summon", "item", `CREATE TRIGGER fail AFTER UPDATE ON player_item FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"summon", "gold", `CREATE TRIGGER fail AFTER UPDATE ON player_wallet FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"summon", "consume", `CREATE TRIGGER fail AFTER DELETE ON player_hero_captive FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"summon", "status", `CREATE TRIGGER fail AFTER UPDATE ON player_hero FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"summon", "commit", `CREATE CONSTRAINT TRIGGER fail AFTER UPDATE ON player_hero DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"release", "consume", `CREATE TRIGGER fail AFTER DELETE ON player_hero_captive FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"release", "delete", `CREATE TRIGGER fail AFTER DELETE ON player_hero FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"befriend", "gold", `CREATE TRIGGER fail AFTER UPDATE ON player_wallet FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"befriend", "insert-progress", `CREATE TRIGGER fail AFTER INSERT ON player_hero_lionize FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"persuade", "item", `CREATE TRIGGER fail AFTER UPDATE ON player_item FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"persuade", "progress", `CREATE TRIGGER fail AFTER UPDATE ON player_hero_lionize FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"hire", "hero-insert", `CREATE TRIGGER fail AFTER INSERT ON player_hero FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"hire", "terminal-progress", `CREATE TRIGGER fail AFTER UPDATE ON player_hero_lionize FOR EACH ROW EXECUTE FUNCTION fail_family()`},
		{"hire", "commit", `CREATE CONSTRAINT TRIGGER fail AFTER UPDATE ON player_hero_lionize DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_family()`},
	} {
		t.Run(tc.op+"/"+tc.stage, func(t *testing.T) {
			pool, s, pkt := familyFailureFixture(t, tc.op)
			recruitSQL(t, pool, `CREATE SEQUENCE family_fault_seen; CREATE FUNCTION fail_family() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('family_fault_seen'); RAISE EXCEPTION 'private schema SQL failure'; END $$`)
			recruitSQL(t, pool, tc.sql)
			before, invalidations := familyState(t, pool), 0
			s.hotel.invalidate = func(context.Context, content.PlayerRef) error { invalidations++; return nil }
			r := s.GatewayRouter().Dispatch(context.Background(), pkt)
			var hit bool
			if e := pool.QueryRow(context.Background(), `SELECT is_called FROM family_fault_seen`).Scan(&hit); e != nil {
				t.Fatal(e)
			}
			if !hit {
				t.Fatalf("fault stage never reached: %+v", r)
			}
			if r.Code == 0 || len(r.Data) != 0 || strings.Contains(r.Msg, "SQL") || invalidations != 0 || familyState(t, pool) != before {
				t.Fatalf("partial effect %+v invalidations=%d", r, invalidations)
			}
		})
	}
}

func TestFamilyAtomicPGCancellationRollsBackEveryPhase(t *testing.T) {
	for _, stage := range []string{"before-begin", "after-item", "after-gold", "after-consume", "after-status", "before-commit"} {
		t.Run(stage, func(t *testing.T) {
			pool, s, pkt := familyFailureFixture(t, "summon")
			before := familyState(t, pool)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				tx, e := pool.BeginTx(ctx, opts)
				if e != nil {
					return nil, e
				}
				return &recruitObservedTx{Tx: tx, afterExec: func(q string) {
					if stage == "after-gold" && strings.Contains(q, "UPDATE player_wallet") || stage == "after-consume" && strings.Contains(q, "DELETE FROM player_hero_captive") || stage == "after-status" && strings.Contains(q, "UPDATE player_hero SET") {
						cancel()
					}
				}, afterRow: func(q string) {
					if stage == "after-item" && strings.Contains(q, "UPDATE player_item") {
						cancel()
					}
				}, beforeCommit: func() {
					if stage == "before-commit" {
						cancel()
					}
				}}, nil
			}
			if stage == "before-begin" {
				cancel()
			}
			if r := s.GatewayRouter().Dispatch(ctx, pkt); r.Code == 0 || ctx.Err() == nil || familyState(t, pool) != before {
				t.Fatalf("cancellation effects %+v", r)
			}
		})
	}
}

func TestFamilyAtomicPGLostAcknowledgementNeverReplaysOrPublishes(t *testing.T) {
	for _, op := range []string{"accept", "reject", "preview", "summon", "release", "befriend", "persuade", "hire"} {
		t.Run(op, func(t *testing.T) {
			pool, s, pkt := familyFailureFixture(t, op)
			before := familyState(t, pool)
			begins, commits, invalidations := 0, 0, 0
			s.hotel.invalidate = func(context.Context, content.PlayerRef) error { invalidations++; return nil }
			var committed string
			s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				begins++
				tx, e := pool.BeginTx(ctx, opts)
				if e != nil {
					return nil, e
				}
				return &recruitObservedTx{Tx: tx, commits: &commits, afterCommit: func() error { committed = familyState(t, pool); return errors.New("private lost acknowledgement") }}, nil
			}
			r := s.GatewayRouter().Dispatch(context.Background(), pkt)
			if r.Code != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) || r.Msg != "hero outcome unavailable; reload state" || len(r.Data) != 0 || begins != 1 || commits != 1 || invalidations != 0 || committed == "" || familyState(t, pool) != committed {
				t.Fatalf("unknown %+v begin=%d commit=%d invalidate=%d", r, begins, commits, invalidations)
			}
			if op != "preview" && committed == before {
				t.Fatal("fault did not follow a real committed transition")
			}
		})
	}
}

func TestFamilyAtomicPGPostcommitFailureAndReloadRemainSuccess(t *testing.T) {
	for _, op := range []string{"summon", "befriend", "persuade"} {
		t.Run(op, func(t *testing.T) {
			pool, s, pkt := familyFailureFixture(t, op)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			commits, invalidations := 0, 0
			s.hotel.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
				tx, e := pool.BeginTx(ctx, opts)
				if e != nil {
					return nil, e
				}
				return &recruitObservedTx{Tx: tx, commits: &commits, afterCommit: func() error { cancel(); return nil }}, nil
			}
			s.hotel.invalidate = func(ctx context.Context, _ content.PlayerRef) error {
				invalidations++
				if ctx.Err() != nil {
					t.Fatal("canceled postcommit context")
				}
				return errors.New("private cache failure")
			}
			r := s.GatewayRouter().Dispatch(ctx, pkt)
			if r.Code != 0 || commits != 1 || invalidations != 1 {
				t.Fatalf("confirmed commit lost %+v %d %d", r, commits, invalidations)
			}
			recruitSQL(t, pool, `ALTER TABLE player_hero_lionize RENAME TO inaccessible_progress`)
			reload := s.GatewayRouter().Dispatch(context.Background(), familyPacket(RouteListPersuadeTargets, 0, 0, 0))
			if reload.Code == 0 || r.Code != 0 {
				t.Fatal("later reload rewrote success")
			}
		})
	}
}
