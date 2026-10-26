package api

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
)

func registrationServer(t *testing.T) (*Server, *pgxpool.Pool, time.Time, *bytes.Buffer) {
	t.Helper()
	ctx := context.Background()
	pool := walletBoundaryPool(t, true)
	now := time.Unix(1700000000, 123456789)
	seedRegistrationPlayer(t, pool, 55, domestic.Resources{Food: 1000})
	if _, err := pool.Exec(ctx, "UPDATE player_wallet SET updated_at=$1", now.Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	store := world.NewPGStore(pool)
	// Use the real deterministic map; this test does not redefine terrain.
	if err := store.SaveChunk(ctx, 1, world.GenerateChunk(1, 0, 0)); err != nil {
		t.Fatal(err)
	}
	h := domestic.NewHub(func() time.Time { return now })
	h.UseStore(domestic.NewPGStore(pool), 1, 0)
	log := &bytes.Buffer{}
	s := NewServer(slog.New(slog.NewJSONHandler(log, nil)), pool, world.NewService(store), h, march.NewHub(nil))
	s.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: 55})
	return s, pool, now, log
}

func seedRegistrationPlayer(t *testing.T, pool *pgxpool.Pool, playerID int64, w domestic.Resources) {
	t.Helper()
	ctx := context.Background()
	var accountID int64
	if err := pool.QueryRow(ctx, "INSERT INTO account(login_name,password_hash) VALUES ('registration','test') RETURNING account_id").Scan(&accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "INSERT INTO player(server_id,player_id,account_id,display_name) VALUES (1,$1,$2,'registration')", playerID, accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "INSERT INTO player_wallet(server_id,player_id,food,wood,stone,iron) VALUES (1,$1,$2,$3,$4,$5)", playerID, w.Food, w.Wood, w.Stone, w.Iron); err != nil {
		t.Fatal(err)
	}
}

func registrationPacket(t *testing.T, serverID int32) *commonv1.ClientPacket {
	t.Helper()
	for _, c := range world.GenerateChunk(1, 0, 0) {
		if c.Buildable() && c.X > 0 && c.Y > 0 {
			return &commonv1.ClientPacket{SessionId: "owner", TraceId: "registration", Payload: mustProto(&worldv1.CreateCityRequest{ServerId: serverID, Name: "NewCity", X: int32(c.X), Y: int32(c.Y)})}
		}
	}
	t.Fatal("no buildable tile")
	return nil
}

func assertRegistrationRows(t *testing.T, pool *pgxpool.Pool, cities, checkpoints, buildings int) {
	t.Helper()
	for table, want := range map[string]int{"player_city": cities, "city_production_checkpoint": checkpoints, "city_building": buildings, "work_queue": 0} {
		var got int
		if err := pool.QueryRow(context.Background(), "SELECT count(*) FROM "+table).Scan(&got); err != nil || got != want {
			t.Fatalf("%s rows=%d want=%d err=%v", table, got, want, err)
		}
	}
}

func assertRegistrationUnavailable(t *testing.T, s *Server) {
	t.Helper()
	if len(s.cachedCityIDs()) != 0 || len(s.cityCoords) != 0 || s.citySnapshot(1) != nil || s.military.SnapshotCity(1) != nil {
		t.Fatal("failed registration published API/domestic/military readiness")
	}
}

func TestCreateCityRegistrationShardGuard(t *testing.T) {
	s, pool, _, log := registrationServer(t)
	for _, sid := range []int32{2, -1} {
		out, err := s.handleCreateCity(context.Background(), registrationPacket(t, sid))
		if err != nil || out == nil || out.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || out.Msg != "server_id mismatch" {
			t.Fatalf("shard %d: %+v %v", sid, out, err)
		}
	}
	assertRegistrationRows(t, pool, 0, 0, 0)
	assertRegistrationUnavailable(t, s)
	if strings.Contains(log.String(), "create_city") {
		t.Fatal("rejected shard emitted create success")
	}
}

func TestCreateCityRegistrationReload(t *testing.T) {
	for _, sid := range []int32{0, 1} {
		t.Run(string(rune('0'+sid)), func(t *testing.T) {
			s, pool, now, _ := registrationServer(t)
			out, err := s.handleCreateCity(context.Background(), registrationPacket(t, sid))
			if err != nil || out == nil || out.Code != 0 {
				t.Fatalf("create: %+v %v", out, err)
			}
			var response worldv1.CreateCityResponse
			if err := unmarshal(out.Data, &response); err != nil || response.GetCity().GetCityId() != 1 {
				t.Fatalf("response: %+v %v", &response, err)
			}
			assertRegistrationRows(t, pool, 1, 1, 2)
			if len(s.cachedCityIDs()) != 1 || len(s.cityCoords) != 1 || s.military.SnapshotCity(1) == nil {
				t.Fatal("committed registration not published")
			}
			// A new pool and Hub must recover the operation's exact clock, not
			// the old wallet timestamp or an in-memory copy.
			freshPool, err := pgxpool.NewWithConfig(context.Background(), pool.Config())
			if err != nil {
				t.Fatal(err)
			}
			defer freshPool.Close()
			h := domestic.NewHub(func() time.Time { return now.Add(30 * time.Second) })
			h.UseStore(domestic.NewPGStore(freshPool), 1, 0)
			fresh := NewServer(nil, freshPool, world.NewService(world.NewPGStore(freshPool)), h, march.NewHub(nil))
			fresh.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: 55})
			listed, err := fresh.handleListPlayerCities(context.Background(), &commonv1.ClientPacket{SessionId: "owner"})
			var list worldv1.ListPlayerCitiesResponse
			if err != nil || listed.Code != 0 || unmarshal(listed.Data, &list) != nil || len(list.Cities) != 1 {
				t.Fatalf("lost-reply recovery list: %+v %v", listed, err)
			}
			fresh.hydratePlayerCities(context.Background(), PlayerContext{ServerID: 1, PlayerID: 55})
			c := fresh.citySnapshot(1)
			if c == nil || !c.LastSettleAt.Equal(now) || c.Wallet.Food != 1000 || fresh.military.SnapshotCity(1) == nil {
				t.Fatalf("reloaded city: %+v", c)
			}
			if _, err := h.SettleCity(context.Background(), 1); err != nil || fresh.citySnapshot(1).Wallet.Food != 1001 {
				t.Fatalf("post-restart production: %+v %v", fresh.citySnapshot(1), err)
			}
		})
	}
}

func TestCreateCityRegistrationCommitFailureBoundary(t *testing.T) {
	ctx := context.Background()
	s, pool, _, log := registrationServer(t)
	if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_registration() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'injected registration commit failure'; END $$;
 CREATE CONSTRAINT TRIGGER reject_registration AFTER INSERT ON city_production_checkpoint
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_registration();`); err != nil {
		t.Fatal(err)
	}
	pkt := registrationPacket(t, 1)
	out, err := s.handleCreateCity(ctx, pkt)
	if err != nil || out == nil || out.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || strings.Contains(out.Msg, "injected") || !strings.Contains(log.String(), "injected registration commit failure") {
		t.Fatalf("failed registration: %+v %v", out, err)
	}
	assertRegistrationRows(t, pool, 0, 0, 0)
	assertRegistrationUnavailable(t, s)
	var food int64
	if err := pool.QueryRow(ctx, "SELECT food FROM player_wallet").Scan(&food); err != nil || food != 1000 {
		t.Fatalf("wallet rollback: %d %v", food, err)
	}
	if strings.Contains(log.String(), "create_city") {
		t.Fatal("failed registration emitted success")
	}
	if _, err := pool.Exec(ctx, "DROP TRIGGER reject_registration ON city_production_checkpoint"); err != nil {
		t.Fatal(err)
	}
	// A confirmed deferred-constraint rejection rolled back both domains.
	out, err = s.handleCreateCity(ctx, pkt)
	if err != nil || out == nil || out.Code != 0 {
		t.Fatalf("confirmed-failure retry: %+v %v", out, err)
	}
	assertRegistrationRows(t, pool, 1, 1, 2)
}

func TestCreateCityRegistrationLegacyOrphanFailClosed(t *testing.T) {
	ctx := context.Background()
	s, pool, _, log := registrationServer(t)
	pkt := registrationPacket(t, 1)
	var req worldv1.CreateCityRequest
	if err := unmarshal(pkt.Payload, &req); err != nil {
		t.Fatal(err)
	}
	// Independently seed a preexisting orphan, not a failed atomic creation.
	if err := world.NewPGStore(pool).CreateCity(ctx, world.City{ServerID: 1, CityID: 1, PlayerID: 55, Name: "legacy", X: int(req.X), Y: int(req.Y)}); err != nil {
		t.Fatal(err)
	}
	out, err := s.handleCreateCity(ctx, pkt)
	if err != nil || out == nil || out.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || out.Msg != "coordinate occupied" {
		t.Fatalf("legacy orphan retry: %+v %v", out, err)
	}
	if _, err := s.domestic.LoadCity(ctx, 1, 55); !errors.Is(err, domestic.ErrProductionCheckpointMissing) {
		t.Fatalf("existing missing checkpoint did not fail closed: %v", err)
	}
	s.hydratePlayerCities(ctx, PlayerContext{ServerID: 1, PlayerID: 55})
	assertRegistrationUnavailable(t, s)
	assertRegistrationRows(t, pool, 1, 0, 0)
	if !strings.Contains(log.String(), "city hydrate failed") {
		t.Fatal("hydrate failure not surfaced")
	}
}
