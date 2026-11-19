package api

import (
	"context"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db/pgfixture"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
)

func TestPGArrivalOccupiesFieldWithinLimit(t *testing.T) {
	pool := pgfixture.OpenFullSpecDB(t)
	ctx := context.Background()
	var schema string
	if err := pool.QueryRow(ctx, `SELECT current_schema()`).Scan(&schema); err != nil {
		t.Fatal(err)
	}
	profile := freshsource.Profile{
		ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2},
		ClusterRef: "t", EvidenceRef: "t", DatabaseName: "t", SchemaName: schema,
		CurrentRoleName: "t", SessionRoleName: "t",
		DatabaseOID: 1, SchemaOID: 1, SchemaOwnerOID: 1, CurrentRoleOID: 1, SessionRoleOID: 1,
		ServerID: 1, Cohort: [16]byte{3},
		Objects: map[string]freshsource.ObjectIdentity{"march_order": {OID: 1, OwnerOID: 1}},
	}
	transition, err := march.NewMarchTransition(report.NewService(report.NewPGStore(pool)), profile)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO player_city(server_id, city_id, player_id, name, x, y) VALUES (1, 100, 7, '主城', 60, 60);
		INSERT INTO map_cell(server_id, x, y, terrain, level, max_level, province_id, owner_city_id)
			VALUES (1, 31, 40, 3, 2, 10, 1, 100),
			       (1, 30, 40, 3, 2, 10, 1, NULL),
			       (1, 32, 40, 1, 2, 10, 1, NULL);
		INSERT INTO field_army(server_id, army_id, owner_player_id, status, x, y) VALUES
			(1, 500, 7, 2, 30, 40), (1, 501, 7, 2, 32, 40);
		INSERT INTO march_order(server_id, march_id, army_id, from_x, from_y, to_x, to_y, purpose, depart_at, arrive_at, status, origin_city_id)
			VALUES (1, 500, 500, 60, 60, 30, 40, 4, now() - interval '1 hour', now() - interval '30 minutes', 1, 100),
			       (1, 501, 501, 60, 60, 32, 40, 4, now() - interval '1 hour', now() - interval '30 minutes', 1, 100);
		INSERT INTO army_troop(server_id, army_id, unit_cfg_id, count) VALUES (1, 500, 1, 10), (1, 501, 1, 10)`); err != nil {
		t.Fatal(err)
	}
	commit := func(marchID, armyID int64, x, y int32, limit int) {
		t.Helper()
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		_, err = transition.Commit(ctx, tx, march.ArrivalCommit{
			ServerID: 1, MarchID: marchID, ArmyID: armyID, ToX: x, ToY: y,
			Survivors: []march.TroopStack{{UnitCfgID: 1, Count: 10}},
			ReturnAt:  time.Now().Add(time.Minute),
			Occupy:    &march.OccupyRequest{CityID: 100, Limit: limit},
		})
		if err != nil {
			_ = tx.Rollback(ctx)
			t.Fatal(err)
		}
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
	}
	owned := func(x, y int) bool {
		var city *int64
		if err := pool.QueryRow(ctx, `SELECT owner_city_id FROM map_cell WHERE server_id=1 AND x=$1 AND y=$2`, x, y).Scan(&city); err != nil {
			t.Fatal(err)
		}
		return city != nil && *city == 100
	}

	commit(500, 500, 30, 40, 2)
	if !owned(30, 40) {
		t.Fatal("winning occupy march did not take the tile")
	}
	commit(501, 501, 32, 40, 2)
	if owned(32, 40) {
		t.Fatal("occupation ignored the field cap")
	}
}
