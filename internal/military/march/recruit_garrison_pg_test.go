package march

import (
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestPGRecruitReadyGarrisonSnapshot(t *testing.T) {
	catalog, _, _, _ := completionRows(t)
	pool, binding, profile := completionPG(t)
	baseSQL(t, pool, `
INSERT INTO mil_city_origin SELECT server_id,101,2,cohort_id,format_version,created_at FROM mil_city_origin WHERE city_id=100;
INSERT INTO city_troop SELECT 1,101,u,0,1 FROM generate_series(1,12) u`)
	owner, access, ctx, participant := completionParticipant(t, binding, profile, catalog)
	read := func(playerID, cityID int64, want [12]int32) {
		t.Helper()
		got, err := participant.ReadReadyGarrison(ctx, access, 1, playerID, cityID)
		baseOK(t, err)
		if got != want {
			t.Fatalf("city %d ready stock = %v, want %v", cityID, got, want)
		}
	}
	before := completionState(t, pool)
	read(1, 100, [12]int32{5, 0, 0, 0})
	read(2, 101, [12]int32{})
	if completionState(t, pool) != before {
		t.Fatal("garrison read changed committed state")
	}
	writer, err := pool.Begin(ctx)
	baseOK(t, err)
	defer func() { _ = writer.Rollback(ctx) }()
	tag, err := writer.Exec(ctx, "UPDATE city_troop SET count=10*unit_cfg_id WHERE server_id=1 AND city_id=100")
	baseOK(t, err)
	if tag.RowsAffected() != 4 {
		t.Fatal("fixture did not stage all four stock rows")
	}
	read(1, 100, [12]int32{5, 0, 0, 0}) // The separate transaction has not committed.
	baseOK(t, writer.Commit(ctx))
	committed := completionState(t, pool)
	read(1, 100, [12]int32{10, 20, 30, 40})
	read(2, 101, [12]int32{})
	baseOK(t, owner.Commit(ctx))
	if completionState(t, pool) != committed {
		t.Fatal("garrison read rewrote current stock or its evidence")
	}
}

func TestPGRecruitReadyGarrisonBadEvidence(t *testing.T) {
	for _, tc := range []struct{ name, sql string }{
		{"missing marker", "DELETE FROM mil_city_origin WHERE city_id=100"},
		{"wrong owner", "UPDATE mil_city_origin SET owner_player_id=2 WHERE city_id=100"},
		{"wrong cohort", "UPDATE mil_city_origin SET cohort_id=decode(repeat('aa',16),'hex') WHERE city_id=100"},
		{"no stock", "DELETE FROM city_troop WHERE city_id=100"},
		{"partial stock", "DELETE FROM city_troop WHERE city_id=100 AND unit_cfg_id=4"},
		{"extra unit", "INSERT INTO city_troop VALUES(1,100,13,0,0)"},
		{"replacement unit", "UPDATE city_troop SET unit_cfg_id=5 WHERE city_id=100 AND unit_cfg_id=4"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			catalog, _, _, _ := completionRows(t)
			pool, binding, profile := completionPG(t)
			baseSQL(t, pool, tc.sql)
			owner, access, ctx, participant := completionParticipant(t, binding, profile, catalog)
			completionNoWrite(t, pool, owner, ctx, func() {
				stock, err := participant.ReadReadyGarrison(ctx, access, 1, 1, 100)
				completionUnavailable(t, err)
				if stock != ([12]int32{}) {
					t.Fatalf("bad evidence returned partial stock: %v", stock)
				}
			})
		})
	}
}

func TestPGRecruitReadyGarrisonSourceGuards(t *testing.T) {
	catalog, _, _, _ := completionRows(t)
	pool, binding, profile := completionPG(t)
	owner, access, ctx := baseOwner(t, binding)
	participant, err := NewRecruitParticipant(ctx, binding, access, profile, catalog)
	baseOK(t, err)
	_, err = participant.ReadReadyGarrison(ctx, access, 1, 1, 100)
	completionUnavailable(t, err) // Constructed, but not pinned.
	baseOK(t, participant.Pin(ctx, access))
	for _, scope := range []struct {
		server       int32
		player, city int64
	}{{2, 1, 100}, {1, 0, 100}, {1, 1, 0}, {1, 1, 101}, {1, 2, 100}} {
		_, err = participant.ReadReadyGarrison(ctx, access, scope.server, scope.player, scope.city)
		completionUnavailable(t, err)
	}
	wrong, err := recruittx.NewBinding(pool)
	baseOK(t, err)
	foreignOwner, foreignAccess, foreignCtx := baseOwner(t, wrong)
	_, err = participant.ReadReadyGarrison(foreignCtx, foreignAccess, 1, 1, 100)
	completionUnavailable(t, err)
	baseOK(t, foreignOwner.Rollback(foreignCtx))
	got, err := participant.ReadReadyGarrison(ctx, access, 1, 1, 100)
	baseOK(t, err)
	if got != ([12]int32{5}) {
		t.Fatalf("valid pinned source returned %v", got)
	}
	baseOK(t, owner.Rollback(ctx))
	_, err = participant.ReadReadyGarrison(ctx, access, 1, 1, 100)
	completionUnavailable(t, err)
}
