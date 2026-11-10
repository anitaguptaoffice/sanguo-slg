package api

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const forcePGHeroLock = "SELECT level, status FROM player_hero WHERE server_id=$1 AND player_id=$2 AND hero_id=$3 FOR UPDATE"

type forcePGTrace struct {
	insert  bool
	reached chan string
	release chan struct{}
	once    sync.Once
}

func (g *forcePGTrace) TraceQueryStart(ctx context.Context, _ *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	return context.WithValue(ctx, g, strings.Join(strings.Fields(d.SQL), " "))
}

func (g *forcePGTrace) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, d pgx.TraceQueryEndData) {
	sql, _ := ctx.Value(g).(string)
	match := strings.HasPrefix(sql, "SELECT ") && strings.Contains(sql, "FROM hero_march_force")
	if g.insert {
		match = strings.HasPrefix(sql, "INSERT INTO hero_march_force ")
	}
	if d.Err != nil || !match {
		return
	}
	// Successful empty SELECT ends here with Err=nil, before Scan's ErrNoRows.
	// This callback still owns its connection: signal only, never run SQL here.
	g.once.Do(func() {
		g.reached <- sql
		select {
		case <-g.release:
		case <-ctx.Done():
		}
	})
}

func forcePGActor(t *testing.T, ctx context.Context, pool *pgxpool.Pool, name string, g *forcePGTrace) (*pgxpool.Pool, int32) {
	t.Helper()
	cfg := pool.Config()
	cfg.MaxConns, cfg.MinConns, cfg.ConnConfig.Tracer = 1, 0, g
	cfg.ConnConfig.RuntimeParams["application_name"] = name
	peer, err := pgxpool.NewWithConfig(ctx, cfg)
	claimPGCheck(t, err == nil, "actor pool:", err)
	t.Cleanup(peer.Close)
	var pid int32
	err = peer.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&pid)
	claimPGCheck(t, err == nil, "actor PID:", err)
	return peer, pid
}

func forcePGAwait[T any](t *testing.T, ctx context.Context, ch <-chan T) T {
	t.Helper()
	select {
	case v := <-ch:
		return v
	case <-ctx.Done():
		t.Fatal("gate/result timeout:", ctx.Err())
	}
	var zero T
	return zero
}

func forcePGWaitLock(t *testing.T, ctx context.Context, observer *pgxpool.Pool, pid, blocker int32, app string) {
	t.Helper()
	tick := time.NewTicker(10 * time.Millisecond)
	defer tick.Stop()
	for {
		var found bool
		err := observer.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity
   WHERE datname=current_database() AND pid=$1 AND application_name=$2 AND wait_event_type='Lock'
   AND trim(regexp_replace(query, '\s+', ' ', 'g'))=$3 AND pg_blocking_pids(pid)=ARRAY[$4]::int[])`, pid, app, forcePGHeroLock, blocker).Scan(&found)
		claimPGCheck(t, err == nil, "lock observer:", err)
		if found {
			t.Logf("hero lock: app=%s PID=%d blocker=%d SQL=%s", app, pid, blocker, forcePGHeroLock)
			return
		}
		select {
		case <-tick.C:
		case <-ctx.Done():
			t.Fatal("actual hero lock wait absent:", pid, blocker)
		}
	}
}

func forcePGCall(ctx context.Context, svc *hero.Service, op string, id int64) (hero.MarchForceView, error) {
	actor := hero.PlayerRef{ServerID: 1, PlayerID: 55}
	if op == "claim" {
		return hero.MarchForceView{}, svc.ClaimForMarch(ctx, actor, id)
	}
	if op == "rest" {
		return svc.RestHero(ctx, actor, id)
	}
	d, err := svc.GetHeroDetail(ctx, actor, id)
	return hero.MarchForceView{Current: d.MarchForce, Max: d.MarchForceMax}, err
}

type forcePGResult struct {
	view hero.MarchForceView
	err  error
}

func TestHeroMarchForcePGInterleavings(t *testing.T) {
	for _, op := range []string{"detail", "rest"} {
		for _, absent := range []bool{false, true} {
			for _, claimFirst := range []bool{false, true} {
				for _, mode := range []string{"repaired", "fallback", "cancel"} {
					t.Run(fmt.Sprintf("%s/absent_%t/claim_first_%t/%s", op, absent, claimFirst, mode), func(t *testing.T) {
						s, pool, now, _ := registrationServer(t)
						ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
						defer cancel()
						now = now.Truncate(time.Microsecond)
						h := originHero(t, s, now)
						if absent {
							claimPGExec(t, ctx, pool, "DELETE FROM hero_march_force WHERE hero_id=$1", h.HeroID)
						}
						before := claimPGState(t, ctx, pool, h.HeroID)
						observer := claimPGPeer(t, ctx, pool, "force_observer")
						entered := make(chan *hero.Hero, 2)
						var workers sync.WaitGroup
						gates := [2]*forcePGTrace{{insert: true, reached: make(chan string, 1), release: make(chan struct{})}, {reached: make(chan string, 1), release: make(chan struct{})}}
						starts := [2]chan struct{}{make(chan struct{}), make(chan struct{})}
						var releases [4]sync.Once
						release := func(i int) {
							releases[i].Do(func() {
								if i < 2 {
									close(starts[i])
								} else {
									close(gates[i-2].release)
								}
							})
						}
						defer func() {
							cancel()
							for i := range releases {
								release(i)
							}
							workers.Wait()
						}()
						var peers [2]*pgxpool.Pool
						var pids [2]int32
						var names [2]string
						var results [2]chan forcePGResult
						request, stop := context.WithCancel(ctx)
						defer stop()
						later := now.Add(30*time.Minute + time.Second) // Ten regen ticks expose stale-idle recovery.
						for i, operation := range []string{"claim", op} {
							names[i] = fmt.Sprintf("force_%s_%d", pool.Config().ConnConfig.RuntimeParams["search_path"], i)
							peers[i], pids[i] = forcePGActor(t, ctx, pool, names[i], gates[i])
							svc := hero.NewService()
							actorNow, callCtx := now, ctx
							if i == 1 {
								actorNow, callCtx = later, request
							}
							svc.SetClock(func() time.Time { return actorNow })
							var store hero.Store = &claimPGPreflight{hero.NewPGStore(peers[i]), entered, starts[i]}
							if i == 1 && mode == "fallback" {
								store = struct{ hero.Store }{store}
							}
							svc.UseStore(store)
							results[i] = make(chan forcePGResult, 1)
							workers.Add(1)
							go func(i int) {
								defer workers.Done()
								v, e := forcePGCall(callCtx, svc, operation, h.HeroID)
								results[i] <- forcePGResult{v, e}
							}(i)
						}
						for range starts {
							seen := forcePGAwait(t, ctx, entered)
							claimPGCheck(t, seen.Status == hero.StatusIdle, "initial preflight:", seen)
						}
						leader, follower := 1, 0
						if claimFirst {
							leader, follower = 0, 1
						}
						release(leader)
						leaderSQL := forcePGAwait(t, ctx, gates[leader].reached)
						t.Logf("leader app=%s PID=%d SQL=%s", names[leader], pids[leader], leaderSQL)
						release(follower)
						if mode == "fallback" {
							// Claim remains concrete PG. Only detail/rest hides the capability.
							controlSQL := leaderSQL
							if claimFirst {
								controlSQL = forcePGAwait(t, ctx, gates[1].reached)
							}
							release(2)
							claimPGCheck(t, forcePGAwait(t, ctx, results[0]).err == nil, "negative-control claim")
							debit := before
							debit.status, debit.current, debit.at = hero.StatusMarch, 14, now
							claimPGWant(t, ctx, observer, h.HeroID, debit) // Committed 14 BEFORE stale writer resumes.
							var unlocked bool
							err := observer.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity
                             WHERE pid=$1 AND application_name=$2 AND trim(regexp_replace(query, '\s+', ' ', 'g'))=$3
                             AND cardinality(pg_blocking_pids(pid))=0)`, pids[1], names[1], controlSQL).Scan(&unlocked)
							claimPGCheck(t, err == nil && unlocked, "fallback SELECT evidence:", err)
							t.Logf("fallback app=%s PID=%d blockers=[] SQL=%s; committed debit=14", names[1], pids[1], controlSQL)
							release(3)
						} else {
							forcePGWaitLock(t, ctx, observer, pids[follower], pids[leader], names[follower])
							if mode == "cancel" {
								stop()
							}
							release(2)
							release(3)
							claimPGCheck(t, forcePGAwait(t, ctx, results[0]).err == nil, "serialized claim")
						}
						result := forcePGAwait(t, ctx, results[1])
						var wantErr error
						if mode == "cancel" {
							wantErr = context.Canceled
						} else if claimFirst && op == "rest" && mode == "repaired" {
							wantErr = hero.ErrHeroNotInCity
						}
						claimPGCheck(t, errors.Is(result.err, wantErr), "writer result:", result.err, "want:", wantErr)
						want := before
						want.status, want.current, want.at = hero.StatusMarch, 14, now
						if mode == "fallback" {
							want.current, want.at = 24, later
						}
						if wantErr == nil {
							expected := int32(24)
							if claimFirst && mode == "repaired" {
								expected = 14
							}
							claimPGCheck(t, result.view == (hero.MarchForceView{Current: expected, Max: 24}), "view:", result.view)
						}
						workers.Wait()
						claimPGWant(t, ctx, observer, h.HeroID, want)
						// Fresh service on the same one-connection actor pool also proves cleanup.
						fresh := hero.NewService()
						fresh.UseStore(hero.NewPGStore(peers[1]))
						fresh.SetClock(func() time.Time { return later })
						got, err := forcePGCall(ctx, fresh, "detail", h.HeroID)
						claimPGCheck(t, err == nil && got.Current == want.current, "fresh reload:", got, err)
						claimPGWant(t, ctx, observer, h.HeroID, want)
					})
				}
			}
		}
	}
}

func TestHeroMarchForcePGLockedStateAndWriteFailure(t *testing.T) {
	for _, op := range []string{"detail", "rest"} {
		for _, absent := range []bool{false, true} {
			for _, change := range []string{"level", "owner", "write"} {
				t.Run(fmt.Sprintf("%s/absent_%t/%s", op, absent, change), func(t *testing.T) {
					s, pool, now, _ := registrationServer(t)
					ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
					defer cancel()
					now = now.Truncate(time.Microsecond)
					h := originHero(t, s, now)
					if absent {
						claimPGExec(t, ctx, pool, "DELETE FROM hero_march_force WHERE hero_id=$1", h.HeroID)
					}
					observer := claimPGPeer(t, ctx, pool, "force_state_observer")
					entered, resume := make(chan *hero.Hero, 1), make(chan struct{})
					done := make(chan forcePGResult, 1)
					var workers sync.WaitGroup
					var once sync.Once
					defer func() {
						cancel()
						once.Do(func() { close(resume) })
						workers.Wait()
					}()
					peer, _ := forcePGActor(t, ctx, pool, "force_state_actor", &forcePGTrace{reached: make(chan string, 1), release: resume})
					svc := hero.NewService()
					svc.SetClock(func() time.Time { return now })
					svc.UseStore(&claimPGPreflight{hero.NewPGStore(peer), entered, resume})
					workers.Add(1)
					go func() {
						defer workers.Done()
						v, e := forcePGCall(ctx, svc, op, h.HeroID)
						done <- forcePGResult{v, e}
					}()
					claimPGCheck(t, forcePGAwait(t, ctx, entered).Level == 1, "initial level")
					switch change {
					case "level":
						claimPGExec(t, ctx, pool, "UPDATE player_hero SET level=3 WHERE hero_id=$1", h.HeroID)
						claimPGExec(t, ctx, pool, "UPDATE hero_march_force SET current_force=40 WHERE hero_id=$1", h.HeroID)
					case "owner":
						claimPGExec(t, ctx, pool, "UPDATE player_hero SET player_id=56 WHERE hero_id=$1", h.HeroID)
					case "write":
						claimPGExec(t, ctx, pool, "UPDATE hero_march_force SET last_regen_at=$1 WHERE hero_id=$2", now.Add(-3*time.Minute), h.HeroID)
						claimPGExec(t, ctx, pool, `CREATE FUNCTION reject_force_write() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN IF NEW.current_force=24 THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='force_write_24', CONSTRAINT='force_write_probe';
       END IF; RETURN NEW; END $$;
       CREATE TRIGGER reject_force_write AFTER INSERT OR UPDATE ON hero_march_force
       FOR EACH ROW EXECUTE FUNCTION reject_force_write()`)
					}
					before := claimPGState(t, ctx, observer, h.HeroID)
					once.Do(func() { close(resume) })
					result := forcePGAwait(t, ctx, done)
					switch change {
					case "level":
						claimPGCheck(t, result.err == nil && result.view == (hero.MarchForceView{Current: 32, Max: 32}), "latest level:", result)
						before.current, before.at = 32, now
					case "owner":
						claimPGCheck(t, errors.Is(result.err, hero.ErrHeroNotFound), "latest owner:", result.err)
					case "write":
						var pgErr *pgconn.PgError
						claimPGCheck(t, errors.As(result.err, &pgErr) && pgErr.Code == "P0001" && pgErr.ConstraintName == "force_write_probe" && pgErr.Message == "force_write_24", "real write error:", result.err)
						t.Logf("force write witness: %s %s %s", pgErr.Code, pgErr.ConstraintName, pgErr.Message)
					}
					workers.Wait()
					claimPGWant(t, ctx, observer, h.HeroID, before)
					if change == "write" {
						claimPGExec(t, ctx, pool, "DROP TRIGGER reject_force_write ON hero_march_force; DROP FUNCTION reject_force_write()")
					}
					if change == "owner" {
						claimPGExec(t, ctx, pool, "UPDATE player_hero SET player_id=55 WHERE hero_id=$1", h.HeroID)
					}
					fresh := hero.NewService()
					fresh.UseStore(hero.NewPGStore(peer))
					fresh.SetClock(func() time.Time { return now })
					before = claimPGState(t, ctx, observer, h.HeroID)
					got, err := forcePGCall(ctx, fresh, op, h.HeroID)
					max := int32(24)
					if change == "level" {
						max = 32
					}
					claimPGCheck(t, err == nil && got == (hero.MarchForceView{Current: max, Max: max}), "explicit later call:", got, err)
					before.current, before.at = max, now
					claimPGWant(t, ctx, observer, h.HeroID, before)
				})
			}
		}
	}
}

func TestHeroMarchForcePGGateway(t *testing.T) {
	for _, template := range []int32{1001, hero.TemplateCfgIDHotelRandom} {
		t.Run(fmt.Sprintf("template_%d", template), func(t *testing.T) {
			s, pool, now, _ := registrationServer(t)
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			err := s.WireM4Content(ctx)
			claimPGCheck(t, err == nil, "production M4 route wiring:", err)
			now = now.Truncate(time.Microsecond)
			created, err := s.handleCreateCity(ctx, registrationPacket(t, 1))
			var city worldv1.CreateCityResponse
			claimPGCheck(t, err == nil && created != nil && created.Code == 0 && unmarshal(created.Data, &city) == nil && city.City != nil, "city:", created, err)
			h := originHero(t, s, now)
			_, concrete := s.heroSvc.Store.(*hero.PGStore)
			claimPGCheck(t, concrete, "NewServer must wire concrete PGStore")
			claimPGExec(t, ctx, pool, "UPDATE player_hero SET template_cfg_id=$1 WHERE hero_id=$2", template, h.HeroID)
			claimPGExec(t, ctx, pool, "UPDATE hero_march_force SET current_force=3,last_regen_at=$1 WHERE hero_id=$2", now.Add(-3*time.Minute), h.HeroID)
			observer := claimPGPeer(t, ctx, pool, "force_gateway_observer")
			want := claimPGState(t, ctx, observer, h.HeroID)
			pkt := &commonv1.ClientPacket{Route: RouteGetHeroDetail, SessionId: "owner", ServerId: 1, TraceId: "force-route", Payload: mustProto(&herov1.GetHeroDetailRequest{HeroId: h.HeroID})}
			out := s.GatewayRouter().Dispatch(ctx, pkt)
			var detail herov1.GetHeroDetailResponse
			claimPGCheck(t, out.Code == 0 && out.TraceId == pkt.TraceId && unmarshal(out.Data, &detail) == nil && detail.MarchForce == 4 && detail.MarchForceMax == 24, "detail route:", out)
			claimPGCheck(t, detail.TemplateCfgId == template && (template != hero.TemplateCfgIDHotelRandom || detail.TemplateCode == "hotel_random"), "detail template branch:", detail.TemplateCode)
			want.current, want.at = 4, now
			claimPGWant(t, ctx, observer, h.HeroID, want)
			pkt.Route, pkt.Payload = RouteRestHero, mustProto(&herov1.RestHeroRequest{HeroId: h.HeroID})
			out = s.GatewayRouter().Dispatch(ctx, pkt)
			var rest herov1.RestHeroResponse
			claimPGCheck(t, out.Code == 0 && unmarshal(out.Data, &rest) == nil && rest.MarchForce == 24 && rest.MarchForceMax == 24, "rest route:", out)
			want.current = 24
			claimPGWant(t, ctx, observer, h.HeroID, want)
			s.SeedCityTroopsForTest(city.City.CityId, 1, 20)
			out = s.GatewayRouter().Dispatch(ctx, originPacket(city.City.CityId, h.HeroID))
			claimPGCheck(t, out.Code == 0 && s.nextArmyID == 1 && len(s.playerMarches[55]) == 1, "claim route:", out)
			want.status, want.current = hero.StatusMarch, 14
			claimPGWant(t, ctx, observer, h.HeroID, want)
		})
	}
}
