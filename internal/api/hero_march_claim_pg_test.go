package api

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"testing"
	"time"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func claimPGCheck(t *testing.T, ok bool, details ...any) {
	t.Helper()
	if !ok {
		t.Fatal(details...)
	}
}

func claimPGExec(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	_, err := pool.Exec(ctx, sql, args...)
	claimPGCheck(t, err == nil, "fixture SQL:", err)
}

func claimPGPeer(t *testing.T, ctx context.Context, pool *pgxpool.Pool, name string) *pgxpool.Pool {
	t.Helper()
	cfg := pool.Config()
	cfg.MaxConns, cfg.MinConns = 1, 0
	cfg.ConnConfig.RuntimeParams["application_name"] = name
	peer, err := pgxpool.NewWithConfig(ctx, cfg)
	claimPGCheck(t, err == nil, "peer:", err)
	t.Cleanup(peer.Close)
	return peer
}

type claimPGSnapshot struct {
	other   string // Every player_hero column except the expected status transition.
	status  int16
	current int32 // -1 represents an absent force row, not a zero-force row.
	at      time.Time
}

func claimPGState(t *testing.T, ctx context.Context, pool *pgxpool.Pool, id int64) claimPGSnapshot {
	t.Helper()
	var got claimPGSnapshot
	err := pool.QueryRow(ctx, `SELECT (to_jsonb(h)-'status')::text, h.status,
		COALESCE(f.current_force,-1), COALESCE(f.last_regen_at,'epoch'::timestamptz)
		FROM player_hero h LEFT JOIN hero_march_force f USING(server_id,hero_id)
		WHERE h.server_id=1 AND h.hero_id=$1`, id).Scan(&got.other, &got.status, &got.current, &got.at)
	claimPGCheck(t, err == nil, "committed snapshot:", err)
	return got
}

func claimPGWant(t *testing.T, ctx context.Context, pool *pgxpool.Pool, id int64, want claimPGSnapshot) {
	t.Helper()
	got := claimPGState(t, ctx, pool, id)
	claimPGCheck(t, got.other == want.other && got.status == want.status && got.current == want.current && got.at.Equal(want.at), "committed state:", got, "want:", want)
}

func TestHeroMarchClaimPGGateway(t *testing.T) {
	for _, absent := range []bool{false, true} {
		t.Run(fmt.Sprintf("force_absent_%t", absent), func(t *testing.T) {
			s, pool, now, _ := registrationServer(t) // Actual NewServer/wireM3, no Store wrapper.
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			now = now.Truncate(time.Microsecond)
			created, err := s.handleCreateCity(ctx, registrationPacket(t, 1))
			var city worldv1.CreateCityResponse
			claimPGCheck(t, err == nil && created != nil && created.Code == 0 && unmarshal(created.Data, &city) == nil && city.City != nil, "city:", created, err)
			h := originHero(t, s, now)
			h.DisplayName, h.Exp, h.Loyalty = "claim fixture", 123, 87
			h.Force, h.Intel, h.Politics, h.Command = 11, 12, 13, 14
			h.ForceAdd, h.IntelAdd, h.PoliticsAdd = 2, 3, 4
			claimPGCheck(t, s.heroSvc.Store.SaveHero(ctx, h) == nil, "save unrelated fields")
			if absent {
				claimPGExec(t, ctx, pool, "DELETE FROM hero_march_force WHERE server_id=1 AND hero_id=$1", h.HeroID)
			} else {
				claimPGExec(t, ctx, pool, "UPDATE hero_march_force SET last_regen_at=$1 WHERE server_id=1 AND hero_id=$2", now.Add(-time.Minute), h.HeroID)
			}
			peer := claimPGPeer(t, ctx, pool, "claim_gateway_observer")
			before := claimPGState(t, ctx, peer, h.HeroID)
			s.SeedCityTroopsForTest(city.City.CityId, 1, 20)
			// Only the status write can emit this exact error, and only after the
			// transaction sees the staged debit and timestamp. Constraints stay intact.
			claimPGExec(t, ctx, pool, `CREATE FUNCTION reject_claim_status() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
			 IF NEW.status=3 AND OLD.status=1 AND EXISTS (
			  SELECT 1 FROM hero_march_force WHERE server_id=NEW.server_id AND hero_id=NEW.hero_id
			  AND current_force=14 AND last_regen_at=NEW.created_at) THEN
			  RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='claim_force_staged', CONSTRAINT='claim_status_probe';
			 END IF;
			 RETURN NEW;
			END $$;
			CREATE TRIGGER reject_claim_status BEFORE UPDATE OF status ON player_hero
			FOR EACH ROW EXECUTE FUNCTION reject_claim_status()`)
			pkt := originPacket(city.City.CityId, h.HeroID)
			out := s.GatewayRouter().Dispatch(ctx, pkt)
			claimPGCheck(t, out.Code == int32(commonv1.ErrorCode_COMMON_INTERNAL) && out.Msg == "ERROR: claim_force_staged (SQLSTATE P0001)" && out.TraceId == pkt.TraceId && len(out.Data) == 0, "exact staged-status error:", out)
			claimPGWant(t, ctx, peer, h.HeroID, before)
			// Separate explicit service call preserves structured PostgreSQL evidence.
			err = s.heroSvc.ClaimForMarch(ctx, hero.PlayerRef{ServerID: 1, PlayerID: 55}, h.HeroID)
			var pgErr *pgconn.PgError
			claimPGCheck(t, errors.As(err, &pgErr) && pgErr.Code == "P0001" && pgErr.ConstraintName == "claim_status_probe" && pgErr.Message == "claim_force_staged", "status-write SQL evidence:", err)
			t.Logf("Observed %s, constraint=%s after staged force", pgErr.Code, pgErr.ConstraintName)
			claimPGWant(t, ctx, peer, h.HeroID, before)
			var armies int
			err = peer.QueryRow(ctx, `SELECT (SELECT count(*) FROM field_army)+(SELECT count(*) FROM march_order)+(SELECT count(*) FROM army_troop)`).Scan(&armies)
			order, _ := s.military.SnapshotMarch(1)
			claimPGCheck(t, err == nil && armies == 0 && order == nil && s.nextArmyID == 0 && len(s.playerMarches) == 0 && len(s.marchHeroByID) == 0 && s.military.SnapshotCity(city.City.CityId).Troops[1] == 20, "failed claim registered army:", armies, err)
			assertInflightEmpty(t, s)
			claimPGExec(t, ctx, pool, "DROP TRIGGER reject_claim_status ON player_hero; DROP FUNCTION reject_claim_status()")
			want := before
			want.status, want.current, want.at = hero.StatusMarch, 14, now
			for attempt := 1; attempt <= 2; attempt++ {
				out = s.GatewayRouter().Dispatch(ctx, pkt) // Explicit later request, never automatic retry.
				var response militaryv1.StartMarchResponse
				claimPGCheck(t, out.Code == 0 && unmarshal(out.Data, &response) == nil && response.March != nil, "explicit claim:", out)
				claimPGWant(t, ctx, peer, h.HeroID, want)
				claimPGCheck(t, s.nextArmyID == int64(attempt) && len(s.playerMarches[55]) == attempt && s.military.SnapshotCity(city.City.CityId).Troops[1] == int32(20-5*attempt), "successful army registration")
				if attempt == 1 {
					order, _ = s.military.SnapshotMarch(response.March.MarchId)
					claimPGCheck(t, order != nil && s.military.Scheduler().PollDue(order.ArriveAt) == 1, "actual arrival release")
					want.status = hero.StatusIdle
					claimPGWant(t, ctx, peer, h.HeroID, want)
					claimPGCheck(t, len(s.marchHeroByID) == 0, "release retained binding")
					want.status, want.current = hero.StatusMarch, 4
				}
			}
			fresh := hero.NewService()
			fresh.UseStore(hero.NewPGStore(peer))
			h.Status = hero.StatusMarch
			loaded, err := fresh.Store.GetHero(ctx, 1, h.HeroID)
			claimPGCheck(t, err == nil && reflect.DeepEqual(loaded, h), "fresh service hero:", loaded, err)
			force, err := fresh.Store.GetMarchForceState(ctx, 1, h.HeroID)
			claimPGCheck(t, err == nil && force != nil && force.Current == 4 && force.LastRegenAt.Equal(now), "fresh service force:", force, err)
		})
	}
}

func TestHeroMarchClaimPGEligibilityAndRegen(t *testing.T) {
	s, pool, now, _ := registrationServer(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now = now.Truncate(time.Microsecond)
	h := originHero(t, s, now)
	peer := claimPGPeer(t, ctx, pool, "claim_eligibility_observer")
	for _, tc := range []struct {
		name    string
		sid     int32
		pid, id int64
		status  int16
		force   int32
		age     time.Duration
		want    error
	}{
		{"missing", 1, 55, h.HeroID + 1, hero.StatusIdle, 24, 0, hero.ErrHeroNotFound},
		{"foreign", 1, 56, h.HeroID, hero.StatusIdle, 24, 0, hero.ErrHeroNotFound},
		{"cross_shard", 2, 55, h.HeroID, hero.StatusIdle, 24, 0, hero.ErrHeroNotFound},
		{"chief", 1, 55, h.HeroID, hero.StatusCityChief, 24, 0, hero.ErrHeroBusy},
		{"march", 1, 55, h.HeroID, hero.StatusMarch, 24, 0, hero.ErrHeroNotIdle},
		{"garrison", 1, 55, h.HeroID, hero.StatusGarrison, 24, 0, hero.ErrHeroNotIdle},
		{"expr", 1, 55, h.HeroID, hero.StatusExpr, 24, 0, hero.ErrHeroNotIdle},
		{"captive", 1, 55, h.HeroID, hero.StatusCaptive, 24, 0, hero.ErrHeroNotIdle},
		{"coming", 1, 55, h.HeroID, hero.StatusComing, 24, 0, hero.ErrHeroNotIdle},
		{"canceled", 1, 55, h.HeroID, hero.StatusIdle, 24, 0, context.Canceled},
		{"partial_regen_rejected", 1, 55, h.HeroID, hero.StatusIdle, 6, 6*time.Minute + time.Second, hero.ErrInsufficientMarchForce},
		{"regen_success", 1, 55, h.HeroID, hero.StatusIdle, 8, 6*time.Minute + time.Second, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claimPGExec(t, ctx, pool, "UPDATE player_hero SET status=$1 WHERE server_id=1 AND hero_id=$2", tc.status, h.HeroID)
			claimPGCheck(t, s.heroSvc.Store.SaveMarchForceState(ctx, hero.MarchForceState{ServerID: 1, HeroID: h.HeroID, Current: tc.force, LastRegenAt: now.Add(-tc.age)}) == nil, "force fixture")
			before := claimPGState(t, ctx, peer, h.HeroID)
			request, stop := context.WithCancel(ctx)
			defer stop()
			if tc.name == "canceled" {
				stop()
			}
			err := s.heroSvc.ClaimForMarch(request, hero.PlayerRef{ServerID: tc.sid, PlayerID: tc.pid}, tc.id)
			claimPGCheck(t, errors.Is(err, tc.want), "claim:", err, "want:", tc.want)
			if tc.want == nil {
				before.status, before.current, before.at = hero.StatusMarch, 0, now.Add(-time.Second)
			}
			claimPGWant(t, ctx, peer, h.HeroID, before)
		})
	}
}

// Embed the concrete PG store deliberately: embedding only hero.Store hides the
// private transactional capability and tests the legacy fallback instead.
type claimPGPreflight struct {
	*hero.PGStore
	entered chan<- *hero.Hero
	resume  <-chan struct{}
}

func (p *claimPGPreflight) GetHero(ctx context.Context, sid int32, id int64) (*hero.Hero, error) {
	h, err := p.PGStore.GetHero(ctx, sid, id)
	if err != nil {
		return h, err
	}
	select {
	case p.entered <- h:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	select {
	case <-p.resume:
		return h, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func TestHeroMarchClaimPGContention(t *testing.T) {
	for _, absent := range []bool{false, true} {
		t.Run(fmt.Sprintf("force_absent_%t", absent), func(t *testing.T) {
			s, pool, now, _ := registrationServer(t)
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			now = now.Truncate(time.Microsecond)
			h := originHero(t, s, now)
			if absent {
				claimPGExec(t, ctx, pool, "DELETE FROM hero_march_force WHERE server_id=1 AND hero_id=$1", h.HeroID)
			}
			before := claimPGState(t, ctx, pool, h.HeroID)
			entered, resume := make(chan *hero.Hero, 2), make(chan struct{})
			results := make(chan error, 2)
			var workers sync.WaitGroup
			var once sync.Once
			var barrier pgx.Tx
			defer func() {
				cancel()
				once.Do(func() { close(resume) })
				if barrier != nil {
					cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
					defer stop()
					_ = barrier.Rollback(cleanup)
				}
				workers.Wait() // Join even on Fatal before any pool/schema cleanup.
			}()
			var pids [2]int32
			var names [2]string
			for i := range pids {
				names[i] = fmt.Sprintf("claim_%s_%d", pool.Config().ConnConfig.RuntimeParams["search_path"], i)
				peer := claimPGPeer(t, ctx, pool, names[i]) // MaxConns=1 also detects in-transaction pool calls.
				err := peer.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&pids[i])
				claimPGCheck(t, err == nil, "claimant PID:", err)
				svc := hero.NewService()
				svc.SetClock(func() time.Time { return now })
				svc.UseStore(&claimPGPreflight{hero.NewPGStore(peer), entered, resume})
				workers.Add(1)
				go func() {
					defer workers.Done()
					results <- svc.ClaimForMarch(ctx, hero.PlayerRef{ServerID: 1, PlayerID: 55}, h.HeroID)
				}()
			}
			for range pids {
				select {
				case seen := <-entered:
					claimPGCheck(t, seen != nil && seen.Status == hero.StatusIdle && seen.HeroID == h.HeroID, "preflight did not observe idle:", seen)
				case <-ctx.Done():
					t.Fatal("both initial preflights did not finish:", ctx.Err())
				}
			}
			// Install only AFTER both reads: GetHero's lazy ALTER TABLE would
			// otherwise serialize before the service precheck and false-pass.
			var err error
			barrier, err = pool.Begin(ctx)
			claimPGCheck(t, err == nil, "barrier:", err)
			var blocker int32
			err = barrier.QueryRow(ctx, "SELECT pg_backend_pid() FROM player_hero WHERE server_id=1 AND hero_id=$1 FOR UPDATE", h.HeroID).Scan(&blocker)
			claimPGCheck(t, err == nil, "hero lock:", err)
			once.Do(func() { close(resume) })
			ticker := time.NewTicker(10 * time.Millisecond)
			defer ticker.Stop()
			for {
				var waiters int
				var reachesBarrier bool
				err = pool.QueryRow(ctx, `SELECT count(*), COALESCE(bool_or($5=ANY(pg_blocking_pids(pid))),false)
				 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'
				 AND ((application_name=$1 AND pid=$2) OR (application_name=$3 AND pid=$4))
				 AND regexp_replace(trim(query), '\s+', ' ', 'g') =
				 'SELECT level, status FROM player_hero WHERE server_id=$1 AND player_id=$2 AND hero_id=$3 FOR UPDATE'
				 AND cardinality(pg_blocking_pids(pid))>0
				 AND pg_blocking_pids(pid) <@ ARRAY[$5,$2,$4]::int[]`, names[0], pids[0], names[1], pids[1], blocker).Scan(&waiters, &reachesBarrier)
				claimPGCheck(t, err == nil, "waiter observation:", err)
				if waiters == 2 && reachesBarrier {
					t.Logf("Both atomic claim waiters observed: apps=%v PIDs=%v barrier=%d", names, pids, blocker)
					break
				}
				select {
				case <-ticker.C:
				case <-ctx.Done():
					t.Fatal("both atomic SELECT FOR UPDATE waiters not observed:", waiters, reachesBarrier)
				}
			}
			claimPGCheck(t, barrier.Rollback(ctx) == nil, "unlock barrier")
			barrier = nil
			success, busy := 0, 0
			for range pids {
				select {
				case err := <-results:
					switch {
					case err == nil:
						success++
					case errors.Is(err, hero.ErrHeroNotIdle):
						busy++
					default:
						t.Fatal("unexpected claimant result:", err)
					}
				case <-ctx.Done():
					t.Fatal("claimants did not complete:", ctx.Err())
				}
			}
			workers.Wait()
			claimPGCheck(t, success == 1 && busy == 1, "claim outcomes:", success, busy)
			before.status, before.current, before.at = hero.StatusMarch, 14, now
			claimPGWant(t, ctx, pool, h.HeroID, before)
		})
	}
}
