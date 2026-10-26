package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

var hotelTestNow = time.Unix(1700000000, 0)

func hotelServer(t *testing.T, pool *pgxpool.Pool) *Server {
	t.Helper()
	hub := domestic.NewHub(func() time.Time { return hotelTestNow })
	hub.UseStore(domestic.NewPGStore(pool), 1, 0)
	s := NewServer(nil, pool, world.NewService(world.NewPGStore(pool)), hub, nil)
	if err := s.WireM4Content(context.Background()); err != nil {
		t.Fatal(err)
	}
	s.SetClock(func() time.Time { return hotelTestNow })
	s.sessions.Bind("hotel", PlayerContext{ServerID: 1, PlayerID: 7})
	return s
}

func hotelFixture(t *testing.T) (*pgxpool.Pool, *Server) {
	t.Helper()
	pool := walletBoundaryPool(t, true)
	seedRecruitActor(t, pool, 7, hero.Resources{Food: 50000, Wood: 50000, Stone: 50000, Iron: 50000, Gold: 1000000}, 3)
	recruitSQL(t, pool, `INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES
		(1,1,7,'first',1,1),(1,2,7,'second',2,2),(1,3,9,'other',3,3);
		INSERT INTO city_building(server_id,city_id,slot_key,building_cfg_id,level) VALUES
		(1,1,'hotel',8,2),(1,1,'office',1,2),(1,2,'hotel',8,2),(1,2,'office',1,2),(1,3,'hotel',8,2);
		ALTER SEQUENCE city_hotel_candidate_id_seq RESTART WITH 100;
		ALTER SEQUENCE player_hero_id_seq RESTART WITH 1000`)
	return pool, hotelServer(t, pool)
}

func hotelPacket(op hotelOperation, cityID, candidateID int64) *commonv1.ClientPacket {
	p := &commonv1.ClientPacket{SessionId: "hotel", ServerId: 1, TraceId: "hotel-tx"}
	switch op {
	case hotelList:
		p.Route, p.Payload = RouteListHotelRecruitCandidates, mustProto(&herov1.ListHotelRecruitCandidatesRequest{ServerId: 1, CityId: cityID})
	case hotelRefresh:
		p.Route, p.Payload = RouteRefreshHotelRecruitPool, mustProto(&herov1.RefreshHotelRecruitPoolRequest{ServerId: 1, CityId: cityID})
	case hotelRecruit:
		p.Route, p.Payload = RouteRecruitHotelCandidate, mustProto(&herov1.RecruitHotelCandidateRequest{ServerId: 1, CityId: cityID, CandidateId: candidateID})
	}
	return p
}

func hotelListReply(t *testing.T, s *Server, city int64) *herov1.ListHotelRecruitCandidatesResponse {
	t.Helper()
	resp := s.GatewayRouter().Dispatch(context.Background(), hotelPacket(hotelList, city, 0))
	out := new(herov1.ListHotelRecruitCandidatesResponse)
	if resp.Code != 0 {
		t.Fatalf("list: %+v", resp)
	}
	if err := proto.Unmarshal(resp.Data, out); err != nil {
		t.Fatal(err)
	}
	return out
}

// Durable fixture observation, never a production recovery receipt. Sequences
// are intentionally omitted: failed transactions may leave legitimate gaps.
func hotelState(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var state string
	err := pool.QueryRow(context.Background(), `SELECT jsonb_build_array(
		(SELECT jsonb_agg(w ORDER BY server_id,player_id) FROM player_wallet w),
		(SELECT jsonb_agg(i ORDER BY server_id,player_id,item_cfg_id) FROM player_item i),
		(SELECT jsonb_agg(h ORDER BY server_id,hero_id) FROM player_hero h),
		(SELECT jsonb_agg(c ORDER BY server_id,city_id,candidate_id) FROM city_hotel_recruit c),
		(SELECT jsonb_agg(s ORDER BY server_id,city_id) FROM city_hotel_schedule s),
		(SELECT jsonb_agg(q ORDER BY server_id,player_id,quest_cfg_id) FROM player_quest q))::text`).Scan(&state)
	if err != nil {
		t.Fatal(err)
	}
	return state
}

func TestHotelAtomicPGSnapshotCostIdentityAndRestart(t *testing.T) {
	pool, s := hotelFixture(t)
	recruitSQL(t, pool, `INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,level,loyalty,force,intel,politics,command,status)
		VALUES(1,901,7,0,1,70,1,2,3,4,6),(1,902,7,0,1,70,1,2,3,4,7)`)
	list := hotelListReply(t, s, 1)
	if len(list.Candidates) != 2 || list.HotelLevel != 2 || list.HeroCapacity != 2 || list.HeroOwned != 0 {
		t.Fatalf("snapshot %+v", list)
	}
	before := hotelState(t, pool)
	again := hotelListReply(t, s, 1)
	if !proto.Equal(list, again) || hotelState(t, pool) != before {
		t.Fatal("same-block list mutated")
	}
	candidate := list.Candidates[0]
	assets := readRecruitAssets(t, pool, 7)
	resp := s.GatewayRouter().Dispatch(context.Background(), hotelPacket(hotelRecruit, 1, candidate.CandidateId))
	var out herov1.RecruitHotelCandidateResponse
	if resp.Code != 0 || proto.Unmarshal(resp.Data, &out) != nil {
		t.Fatalf("recruit %+v", resp)
	}
	want := assets
	want.Wallet.Gold -= candidate.GoldCost
	want.Heroes++
	if got := readRecruitAssets(t, pool, 7); got != want {
		t.Fatalf("exact assets %+v want %+v", got, want)
	}
	restarted := hotelServer(t, pool)
	h, err := restarted.heroSvc.Store.GetHero(context.Background(), 1, out.HeroId)
	if err != nil || h.HeroID == candidate.CandidateId || h.HeroID < 1000 || h.TemplateCfgID != 0 || h.Status != hero.StatusIdle ||
		h.Level != candidate.Level || int32(h.Loyalty) != candidate.Loyalty || h.DisplayName != candidate.DisplayName ||
		h.Force != candidate.Attributes.Force || h.Intel != candidate.Attributes.Intel || h.Politics != candidate.Attributes.Politics || h.Command != candidate.Attributes.Command {
		t.Fatalf("persisted candidate copy %+v %v", h, err)
	}
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM city_hotel_recruit WHERE city_id=1`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("recruit refilled: %d %v", count, err)
	}
	refilled := hotelListReply(t, restarted, 1)
	if len(refilled.Candidates) != 2 || refilled.HeroOwned != 1 {
		t.Fatalf("refill snapshot %+v", refilled)
	}
	beforeAssets := readRecruitAssets(t, pool, 7)
	resp = restarted.GatewayRouter().Dispatch(context.Background(), hotelPacket(hotelRefresh, 1, 0))
	var refresh herov1.RefreshHotelRecruitPoolResponse
	if resp.Code != 0 || proto.Unmarshal(resp.Data, &refresh) != nil || len(refresh.Candidates) != 2 {
		t.Fatalf("refresh %+v", resp)
	}
	want = beforeAssets
	want.Books--
	if got := readRecruitAssets(t, pool, 7); got != want {
		t.Fatalf("refresh debit %+v want %+v", got, want)
	}
	for _, c := range refresh.Candidates {
		for _, old := range refilled.Candidates {
			if c.CandidateId == old.CandidateId {
				t.Fatal("refresh reused ID")
			}
		}
	}
}

func TestHotelAtomicPGRejectsActorScopeAndWiringBeforeWrites(t *testing.T) {
	for _, kind := range []string{"actor", "account", "wallet", "owner", "missing-city", "not-built", "payload-shard", "packet-shard", "negative-city", "candidate",
		"dependencies", "hero-service", "hero-store", "hero-pool", "candidate-store", "candidate-pool", "world-service", "world-store", "world-pool", "domestic", "domestic-pool", "domestic-shard", "content", "memory-content", "items"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := hotelFixture(t)
			id := hotelListReply(t, s, 1).Candidates[0].CandidateId
			city := int64(1)
			switch kind {
			case "actor":
				recruitSQL(t, pool, `DELETE FROM player`)
			case "account":
				s.sessions.Bind("hotel", PlayerContext{ServerID: 1, PlayerID: 7, AccountID: 99999})
			case "wallet":
				recruitSQL(t, pool, `DELETE FROM player_wallet`)
			case "owner":
				city = 3
			case "missing-city":
				city = 99
			case "not-built":
				recruitSQL(t, pool, `DELETE FROM city_building WHERE building_cfg_id=8`)
			case "negative-city":
				city = -1
			case "candidate":
				id = -1
			case "dependencies":
				s.hotel = nil
			case "hero-service":
				s.heroSvc = hero.NewService()
			case "hero-store":
				s.heroSvc.Store = hero.NewPGStore(pool)
			case "hero-pool":
				s.hotel.heroes.Pool = nil
			case "candidate-store":
				s.heroSvc.HotelStore = hero.NewPGHotelStore(pool)
			case "candidate-pool":
				s.hotel.candidates.Pool = nil
			case "world-service":
				s.world = world.NewService(s.world.Store)
			case "world-store":
				s.world.Store = world.NewPGStore(pool)
			case "world-pool":
				s.hotel.owner.Pool = nil
			case "domestic":
				s.domestic = domestic.NewHub(nil)
			case "domestic-pool":
				s.domestic.UseStore(domestic.NewPGStore(nil), 1, 0)
			case "domestic-shard":
				s.domestic.UseStore(domestic.NewPGStore(pool), 2, 0)
			case "content":
				cat, _ := content.EmbeddedCatalog()
				s.contentSvc = content.NewService(cat)
			case "memory-content":
				s.contentSvc.UseStore(nil)
			case "items":
				s.hotel.itemStore.Pool = nil
			}
			before := hotelState(t, pool)
			for _, op := range []hotelOperation{hotelList, hotelRefresh, hotelRecruit} {
				if kind == "candidate" && op != hotelRecruit {
					continue
				}
				pkt := hotelPacket(op, city, id)
				if kind == "packet-shard" {
					pkt.ServerId = 2
				}
				if kind == "payload-shard" {
					// All three request messages use field 1 for server_id.
					pkt.Payload[1] = 2
				}
				resp := s.GatewayRouter().Dispatch(context.Background(), pkt)
				if resp.Code == 0 || hotelState(t, pool) != before {
					t.Fatalf("%s wrote state: %+v", op, resp)
				}
			}
		})
	}
}

func TestHotelErrorsSanitizeAndMemoryIsNotPG(t *testing.T) {
	for _, err := range []error{errors.New("private SQL schema"), errHotelOutcome, hero.ErrInvalidHotelState} {
		resp := hotelErr("trace", err)
		if resp.Code == 0 || strings.Contains(resp.Msg, "SQL") || strings.Contains(resp.Msg, "rollback") || strings.Contains(resp.Msg, "not charged") {
			t.Fatalf("unsafe error %+v", resp)
		}
	}
	s := &Server{heroSvc: hero.NewService()}
	if _, err := s.hotelAtomic(context.Background(), PlayerContext{ServerID: 1, PlayerID: 7}, 1, 0, hotelList); !errors.Is(err, hero.ErrHotelTransactionRequired) {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(s.heroSvc.Store, hero.NewMemStore()) {
		t.Fatal("memory fixture changed")
	}
}
