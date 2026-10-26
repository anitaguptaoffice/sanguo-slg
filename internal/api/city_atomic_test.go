package api

import (
	"context"
	"errors"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type atomicCityWorld struct {
	world.Store
	insert func(context.Context, pgx.Tx, world.City) (world.City, error)
}

func (w *atomicCityWorld) CreateCityInTx(ctx context.Context, tx pgx.Tx, c world.City) (world.City, error) {
	return w.insert(ctx, tx, c)
}

func TestCreateCityAtomicDependenciesFailClosed(t *testing.T) {
	for _, mode := range []string{"nil-hub", "memory-hub", "nil-api-pool", "distinct-pool", "wrong-shard", "nil-world", "memory-world"} {
		t.Run(mode, func(t *testing.T) {
			s, pool, _, _ := registrationServer(t)
			switch mode {
			case "nil-hub":
				s.domestic = nil
			case "memory-hub":
				s.domestic = domestic.NewHub(nil)
			case "nil-api-pool":
				s.players.Pool = nil
			case "distinct-pool":
				other, err := pgxpool.NewWithConfig(context.Background(), pool.Config())
				if err != nil {
					t.Fatal(err)
				}
				defer other.Close()
				s.domestic.UseStore(domestic.NewPGStore(other), 1, 0)
			case "wrong-shard":
				s.domestic.UseStore(domestic.NewPGStore(pool), 2, 0)
			case "nil-world":
				s.world = nil
			case "memory-world":
				s.world = world.NewService(&cityOwnershipStore{})
			}
			out, err := s.handleCreateCity(context.Background(), registrationPacket(t, 1))
			if err != nil || out == nil || out.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) {
				t.Fatalf("%s: %+v %v", mode, out, err)
			}
			assertRegistrationRows(t, pool, 0, 0, 0)
			assertRegistrationUnavailable(t, s)
		})
	}
}

func TestCreateCityAtomicDefaultsAndParticipantFailure(t *testing.T) {
	s, pool, _, _ := registrationServer(t)
	if _, err := pool.Exec(context.Background(), "DELETE FROM player_wallet"); err != nil {
		t.Fatal(err)
	}
	calls := 0
	s.world = world.NewService(&atomicCityWorld{insert: func(ctx context.Context, tx pgx.Tx, c world.City) (world.City, error) {
		calls++
		if tx == nil || c.CityID != 0 || c.ServerID != 1 || c.PlayerID != 55 || c.Name != "MainCity" || c.X != 50 || c.Y != 50 || !c.IsCapital || c.WallLevel != 1 || c.Morale != 100 {
			t.Fatalf("world request defaults: %+v", c)
		}
		return world.City{}, errors.New("private participant SQL failure")
	}})
	out, err := s.handleCreateCity(context.Background(), &commonv1.ClientPacket{SessionId: "owner", Payload: mustProto(&worldv1.CreateCityRequest{})})
	if err != nil || out == nil || out.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || out.Msg != "city creation failed; reload cities before retry" || calls != 1 {
		t.Fatalf("participant boundary: %+v %v calls=%d", out, err, calls)
	}
	assertRegistrationRows(t, pool, 0, 0, 0)
	assertRegistrationUnavailable(t, s)
	var wallets int
	if err := pool.QueryRow(context.Background(), "SELECT count(*) FROM player_wallet").Scan(&wallets); err != nil || wallets != 0 {
		t.Fatalf("initial wallet escaped rollback: %d %v", wallets, err)
	}
}

func TestCreateCityAtomicDOMFailureAndCancellation(t *testing.T) {
	for _, mode := range []string{"domestic-sql", "canceled", "bounds"} {
		t.Run(mode, func(t *testing.T) {
			s, pool, _, _ := registrationServer(t)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			pkt := registrationPacket(t, 1)
			switch mode {
			case "domestic-sql":
				if _, err := pool.Exec(ctx, "ALTER TABLE city_building ADD CONSTRAINT reject_atomic_api CHECK(level < 0)"); err != nil {
					t.Fatal(err)
				}
			case "canceled":
				cancel()
			case "bounds":
				pkt.Payload = mustProto(&worldv1.CreateCityRequest{X: world.MapSize, Y: 1})
			}
			out, err := s.handleCreateCity(ctx, pkt)
			if err != nil || out == nil || out.Code == 0 {
				t.Fatalf("%s: %+v %v", mode, out, err)
			}
			assertRegistrationRows(t, pool, 0, 0, 0)
			assertRegistrationUnavailable(t, s)
			if mode == "domestic-sql" {
				if _, err := pool.Exec(context.Background(), "ALTER TABLE city_building DROP CONSTRAINT reject_atomic_api"); err != nil {
					t.Fatal(err)
				}
			}
			out, err = s.handleCreateCity(context.Background(), registrationPacket(t, 1))
			if err != nil || out == nil || out.Code != 0 {
				t.Fatalf("confirmed failure retry: %+v %v", out, err)
			}
			assertRegistrationRows(t, pool, 1, 1, 2)
		})
	}
}

func atomicCityPacket(t *testing.T, index int) *commonv1.ClientPacket {
	t.Helper()
	for _, c := range world.GenerateChunk(1, 0, 0) {
		if !c.Buildable() || c.X == 0 || c.Y == 0 {
			continue
		}
		if index == 0 {
			return &commonv1.ClientPacket{SessionId: "owner", Payload: mustProto(&worldv1.CreateCityRequest{X: int32(c.X), Y: int32(c.Y)})}
		}
		index--
	}
	t.Fatal("no buildable tile")
	return nil
}

func TestCreateCityAtomicStarterWalletOnlyOnce(t *testing.T) {
	s, pool, _, _ := registrationServer(t)
	if _, err := pool.Exec(context.Background(), "DELETE FROM player_wallet"); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		out, err := s.handleCreateCity(context.Background(), atomicCityPacket(t, i))
		if err != nil || out == nil || out.Code != 0 {
			t.Fatalf("create %d: %+v %v", i, out, err)
		}
		c := s.citySnapshot(int64(i + 1))
		if c == nil || c.Wallet != (domestic.Resources{Food: 8000, Wood: 8000, Stone: 5000, Iron: 5000}) || len(c.Buildings) != 2 || *c.Buildings["hall"] != (domestic.BuildingInstance{CfgID: 1, Level: 1}) || *c.Buildings["farm"] != (domestic.BuildingInstance{CfgID: 2, Level: 1}) {
			t.Fatalf("starter state: %+v", c)
		}
	}
	assertRegistrationRows(t, pool, 2, 2, 4)
}
