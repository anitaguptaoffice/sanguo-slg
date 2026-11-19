package api

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

func firstCityPreparedObjectNames() []string {
	names := make([]string, 0, 40)
	names = append(names, worldSourceNamesForPrepared()...)
	names = append(names, domesticFreshSourceNamesForPrepared()...)
	names = append(names, marchFreshSourceNamesForPrepared()...)
	return names
}

func worldSourceNamesForPrepared() []string {
	return []string{"map_cell", "map_cell_pkey", "player_city", "player_city_pkey", "player_city_server_id_x_y_key", "idx_player_city_owner", "player_city_id_seq"}
}

func domesticFreshSourceNamesForPrepared() []string {
	return []string{"player_wallet", "player_wallet_pkey", "city_production_checkpoint", "city_production_checkpoint_pkey",
		"idx_city_production_player", "city_building", "city_building_pkey", "idx_city_building_cfg"}
}

func marchFreshSourceNamesForPrepared() []string {
	return []string{
		"mil_city_origin", "mil_city_origin_pkey", "city_troop", "city_troop_pkey",
		"work_queue", "work_queue_pkey", "idx_work_queue_due", "idx_work_queue_player",
		"mil_recruit_origin", "mil_recruit_receipt", "mil_recruit_origin_pkey",
		"mil_recruit_origin_server_id_player_id_operation_command_id_key", "mil_recruit_receipt_pkey",
		"work_queue_id_seq",
	}
}

func queryFreshProfile(t *testing.T, pool *pgxpool.Pool, objectNames []string) freshsource.Profile {
	t.Helper()
	ctx := context.Background()
	doc := []byte(nil)
	err := pool.QueryRow(ctx, `SELECT pg_catalog.json_build_object('DatabaseName',d.datname,'DatabaseOID',d.oid::pg_catalog.int8,
 'SchemaName',n.nspname,'SchemaOID',n.oid::pg_catalog.int8,'SchemaOwnerOID',n.nspowner::pg_catalog.int8,
 'CurrentRoleName',current_user,'CurrentRoleOID',r.oid::pg_catalog.int8,'SessionRoleName',session_user,
 'SessionRoleOID',s.oid::pg_catalog.int8,'ServerID',1::pg_catalog.int4,'Objects',(SELECT pg_catalog.json_object_agg(relname,
 pg_catalog.json_build_object('OID',oid::pg_catalog.int8,'OwnerOID',relowner::pg_catalog.int8))
 FROM pg_catalog.pg_class WHERE relnamespace=n.oid AND relname=ANY($1)))
 FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s
 WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`,
		objectNames).Scan(&doc)
	if err != nil {
		t.Fatal(err)
	}
	var p freshsource.Profile
	if err := json.Unmarshal(doc, &p); err != nil {
		t.Fatal(err)
	}
	p.ReleaseDigest = [32]byte{1}
	p.EvidenceDigest = [32]byte{2}
	p.ClusterRef = "first-city-prepared-pg"
	p.EvidenceRef = "not-production-evidence"
	p.Cohort = [16]byte{3}
	return p
}

func profileSubset(t *testing.T, base freshsource.Profile, names []string) freshsource.Profile {
	t.Helper()
	p := base
	p.ServerID = 1
	p.Objects = make(map[string]freshsource.ObjectIdentity, len(names))
	for _, name := range names {
		o, ok := base.Objects[name]
		if !ok {
			t.Fatalf("missing fresh object %q in schema %q", name, base.SchemaName)
		}
		p.Objects[name] = o
	}
	return p
}

func applyFirstCityPreparedMilExtras(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	if err := EnsureFirstCityPreparedMilDDL(context.Background(), pool); err != nil {
		t.Fatal(err)
	}
}

func wireFirstCityPreparedPG(t *testing.T, s *Server, pool *pgxpool.Pool) {
	t.Helper()
	base := queryFreshProfile(t, pool, firstCityPreparedObjectNames())
	binding, err := recruittx.NewBinding(pool)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	owner, err := binding.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	access := owner.Access()
	if err := firstCityPreparedTxnPath(ctx, access, binding, base.SchemaName); err != nil {
		t.Fatal(err)
	}
	worldProfile := profileSubset(t, base, worldSourceNamesForPrepared())
	milProfile := profileSubset(t, base, marchFreshSourceNamesForPrepared())
	domProfile := profileSubset(t, base, domesticFreshSourceNamesForPrepared())
	worldFresh, err := world.NewFreshCityParticipant(ctx, binding, access, worldProfile)
	if err != nil {
		t.Fatal("world fresh", err)
	}
	milFresh, err := march.NewFreshCityParticipant(ctx, binding, access, milProfile)
	if err != nil {
		t.Fatal("mil fresh", err)
	}
	domFresh, err := domestic.NewFreshCityParticipant(ctx, binding, access, domProfile, s.domestic)
	if err != nil {
		t.Fatal("dom fresh", err)
	}
	if err := owner.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	s.WireFirstCityPreparedCreation(&FirstCityPreparedCreationSource{
		Dom: domFresh, World: worldFresh, Mil: milFresh, Binding: binding, Profile: base,
	})
}

func TestFirstCitySubmitCreatesCityPreparedPG(t *testing.T) {
	if os.Getenv("SANGUO_FIRST_CITY_PREPARED_PG_TEST") != "1" {
		t.Skip("optional; make test-fc-prepared-pg (after test-pg-warm-mil)")
	}
	pool := walletBoundarySharedPool(t)
	applyFirstCityPreparedMilExtras(t, pool)
	s, _, _, _ := registrationServerOnPool(t, pool)
	wireFirstCityPreparedPG(t, s, pool)
	ctx := context.Background()
	var accountID int64
	if err := pool.QueryRow(ctx, "SELECT account_id FROM player WHERE server_id=1 AND player_id=55").Scan(&accountID); err != nil {
		t.Fatal(err)
	}
	s.sessions.Bind("owner", PlayerContext{ServerID: 1, PlayerID: 55, AccountID: accountID})
	s.EnableFirstCityV2Routes(func(PlayerContext) (string, bool) { return testFirstCityRealmUUID, true })
	s.WireFirstCityV2Ledger(NewPGFirstCityLedger(pool), fixedTemplateIntake{ref: FirstCityTemplateRef("DATA-002")})
	s.WireFirstCityV2Effect(s.FirstCityCreationEffect())

	var buildable *world.Cell
	for _, c := range world.GenerateChunk(1, 0, 0) {
		if c.Buildable() && c.X > 0 && c.Y > 0 {
			buildable = &c
			break
		}
	}
	if buildable == nil {
		t.Fatal("no buildable tile")
	}
	scope := &worldv1.FirstCityScope{RealmId: testFirstCityRealmUUID, ServerId: 1, PlayerId: 55, AccountId: accountID}
	proposal := &worldv1.FirstCityProposal{
		CommandId:   testFirstCityCommand,
		Predecessor: &worldv1.FirstCityPredecessor{Value: &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}},
		Name:        proto.String("首城"),
		X:           proto.Int32(int32(buildable.X)),
		Y:           proto.Int32(int32(buildable.Y)),
	}
	pkt := &commonv1.ClientPacket{SessionId: "owner", TraceId: "first-city-prepared", ServerId: 1,
		Payload: mustProto(&worldv1.SubmitFirstCityRequest{ExpectedScope: scope, Proposal: proposal})}
	out, err := s.handleSubmitFirstCity(ctx, pkt)
	if err != nil || out.GetCode() != 0 {
		t.Fatalf("submit: err=%v code=%d msg=%s", err, out.GetCode(), out.GetMsg())
	}
	var resp worldv1.SubmitFirstCityResponse
	if err := proto.Unmarshal(out.GetData(), &resp); err != nil {
		t.Fatal(err)
	}
	success := resp.GetOutcome().GetCommand().GetSucceeded()
	if success == nil || success.GetCityId() <= 0 {
		t.Fatalf("outcome = %+v", resp.GetOutcome())
	}
	cityID := success.GetCityId()
	var cities, checkpoints, buildings, origins int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM player_city WHERE server_id=1 AND player_id=55").Scan(&cities); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM city_production_checkpoint WHERE server_id=1 AND city_id=$1", cityID).Scan(&checkpoints); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM city_building WHERE server_id=1 AND city_id=$1", cityID).Scan(&buildings); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM mil_city_origin WHERE server_id=1 AND owner_player_id=55").Scan(&origins); err != nil {
		t.Fatal(err)
	}
	if cities != 1 || checkpoints != 1 || buildings < 1 || origins != 1 {
		t.Fatalf("rows city=%d checkpoint=%d building=%d origin=%d", cities, checkpoints, buildings, origins)
	}
	var cmdState int
	if err := pool.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=1 AND player_id=55 AND command_id=$2::uuid`,
		testFirstCityRealmUUID, testFirstCityCommand).Scan(&cmdState); err != nil {
		t.Fatal(err)
	}
	if cmdState != 2 {
		t.Fatalf("ledger durable_state = %d", cmdState)
	}
}
