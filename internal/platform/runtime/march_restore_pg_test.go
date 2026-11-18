package runtime

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/config"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

func TestPGPreparedMarchRestoreStartup(t *testing.T) {
	pool, profile := preparedProfilePG(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	preparedCheck(t, db.SeedDevServer(ctx, pool, 1, "restore-test"))
	app := &App{DB: pool, Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Config: config.Config{PreparedFirstCity: true, HTTPAddr: "127.0.0.1:0",
			MILFreshProfileFile: writeMilProfile(t, milFile(profile))}}
	request := func(handler http.Handler, path string, code int, body string) {
		t.Helper()
		reply := httptest.NewRecorder()
		handler.ServeHTTP(reply, httptest.NewRequest(http.MethodGet, path, nil))
		if reply.Code != code || !strings.Contains(reply.Body.String(), body) {
			t.Fatalf("%s returned %d %s", path, reply.Code, reply.Body)
		}
	}
	assertFailure := func(app *App, message string) {
		t.Helper()
		server, err := app.NewAPIServer(ctx)
		if server != nil || err == nil || !strings.Contains(err.Error(), message) {
			t.Fatalf("expected startup refusal containing %q: srv=%p err=%v", message, server, err)
		}
	}
	exec := func(sql string) {
		t.Helper()
		_, err := pool.Exec(ctx, sql)
		preparedCheck(t, err)
	}
	releases := func(want string) {
		t.Helper()
		var actual string
		preparedCheck(t, pool.QueryRow(ctx, `SELECT string_agg(status::text,'' ORDER BY hero_id) FROM player_hero`).Scan(&actual))
		if actual != want {
			t.Fatalf("hero status by ID = %s, want %s", actual, want)
		}
	}
	request(app.HTTPHandler(ctx, nil), "/healthz", http.StatusServiceUnavailable, `"march_restore":"unavailable"`)
	request(app.HTTPHandler(ctx, nil), "/ws", http.StatusNotFound, "")
	exec(`INSERT INTO player_city(server_id,city_id,player_id,name,x,y) VALUES(1,99,70,'Home',1,1);
		INSERT INTO player_hero(server_id,hero_id,player_id,template_cfg_id,status)
		VALUES(1,11,70,11,3),(1,12,70,12,3),(1,14,70,14,3),(1,17,70,17,3),(1,18,70,18,3);
		INSERT INTO field_army(server_id,army_id,owner_player_id,status,x,y,hero_ids)
		VALUES(1,500,70,2,1,1,'{11,12}'),(1,501,70,3,2,2,'{14}');
		INSERT INTO army_troop VALUES(1,500,1,5),(1,501,2,3);
		INSERT INTO march_order(server_id,march_id,army_id,from_x,from_y,to_x,to_y,purpose,depart_at,arrive_at,status,origin_city_id,return_finish_at)
		VALUES(1,600,500,1,1,2,2,1,'2020-01-01','2020-01-02',2,99,NULL),
			(1,601,501,1,1,2,2,1,'2020-01-01','2020-01-02',3,99,'2020-01-03')`)
	legacy := *app
	legacy.Config.PreparedFirstCity = false
	legacyCtx, stopLegacy := context.WithCancel(ctx)
	legacyAPI, err := legacy.NewAPIServer(legacyCtx)
	preparedCheck(t, err)
	request(legacy.HTTPHandler(legacyCtx, legacyAPI), "/healthz", http.StatusOK, `{"status":"ok"}`)
	stopLegacy()
	assertFailure(app, "invalid durable march state")
	releases("33333")
	exec("UPDATE march_order SET status=1 WHERE server_id=1 AND march_id=600 AND status=2")

	owner, err := pool.Begin(ctx)
	preparedCheck(t, err)
	defer func() { _ = owner.Rollback(ctx) }()
	_, err = owner.Exec(ctx, "SELECT pg_advisory_xact_lock($1,$2)", 0x4d415243, int32(profile.SchemaOID))
	preparedCheck(t, err)
	assertFailure(app, "recovery already in progress")
	preparedCheck(t, owner.Rollback(ctx))
	shadow := pgx.Identifier{profile.SchemaName + "_march_shadow"}.Sanitize()
	exec("CREATE SCHEMA " + shadow + "; CREATE TABLE " + shadow + ".player_hero (id bigint)")
	defer exec("DROP SCHEMA " + shadow + " CASCADE")
	cfg := pool.Config()
	cfg.ConnConfig.RuntimeParams["search_path"] = shadow + "," + profile.SchemaName
	shadowPool, err := pgxpool.NewWithConfig(ctx, cfg)
	preparedCheck(t, err)
	defer shadowPool.Close()
	mismatch := *app
	mismatch.DB = shadowPool
	assertFailure(&mismatch, "HERO relation does not match")
	releases("33333")

	exec(`CREATE SEQUENCE restore_attempt_17; CREATE SEQUENCE restore_attempt_18;
		CREATE FUNCTION check_release() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
		  IF (NEW.hero_id=17 AND nextval('restore_attempt_17')=1)
		     OR (NEW.hero_id=18 AND nextval('restore_attempt_18')<=2)
		  THEN RAISE EXCEPTION 'fixture release failure'; END IF;
		  RETURN NEW;
		END $$;
		CREATE TRIGGER restore_release BEFORE UPDATE ON player_hero FOR EACH ROW EXECUTE FUNCTION check_release()`)
	assertFailure(app, "release restored orphan hero 18")
	releases("33313")
	for range 2 {
		run, stop := context.WithCancel(ctx)
		srv, err := app.NewAPIServer(run)
		preparedCheck(t, err)
		request(app.HTTPHandler(run, srv), "/healthz", http.StatusOK, `"march_restore":"ready"`)
		for _, player := range []int64{70, 71} {
			srv.BindSession("restored", 1, player, 0)
			reply := srv.GatewayRouter().Dispatch(run, &commonv1.ClientPacket{Route: api.RouteListMarches, SessionId: "restored", ServerId: 1})
			var out militaryv1.ListMarchesResponse
			preparedCheck(t, proto.Unmarshal(reply.GetData(), &out))
			if reply.GetCode() != 0 || player == 71 && out.GetTotal() != 0 || player == 70 &&
				(out.GetTotal() != 2 || len(out.GetMarches()) != 2 ||
					out.GetMarches()[0].GetMarchId() != 600 || out.GetMarches()[0].GetOriginCityId() != 99 ||
					out.GetMarches()[0].GetPhase() != militaryv1.MarchPhase_MARCH_PHASE_MARCHING ||
					out.GetMarches()[1].GetPhase() != militaryv1.MarchPhase_MARCH_PHASE_RETURNING ||
					len(out.GetMarches()[1].GetTroops()) != 1 ||
					out.GetMarches()[1].GetTroops()[0].GetCount() != 3) {
				t.Fatalf("player %d: %v %v", player, reply, &out)
			}
		}
		stop()
	}
	releases("33311")
	var tries17, tries18, reports, stock int32
	preparedCheck(t, pool.QueryRow(ctx, `SELECT (SELECT last_value FROM restore_attempt_17), (SELECT last_value FROM restore_attempt_18),
		(SELECT count(*) FROM battle_report), (SELECT count(*) FROM city_troop)`).Scan(&tries17, &tries18, &reports, &stock))
	if tries17 != 2 || tries18 != 3 || reports != 0 || stock != 0 {
		t.Fatalf("attempts=%d/%d, reports=%d, stock=%d", tries17, tries18, reports, stock)
	}
}
