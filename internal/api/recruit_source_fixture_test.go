package api

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Independent PORTS inventory, never obtained from the implementation under test.
var recruitPGNames = strings.Fields(`account account_pkey uq_account_login_name account_account_id_seq
account_session account_session_pkey idx_account_session_account player player_pkey uq_player_account_per_server idx_player_account
player_wallet player_wallet_pkey map_cell map_cell_pkey player_city player_city_pkey player_city_server_id_x_y_key idx_player_city_owner player_city_id_seq
mil_city_origin mil_city_origin_pkey city_troop city_troop_pkey work_queue work_queue_pkey idx_work_queue_due idx_work_queue_player
mil_recruit_origin mil_recruit_receipt mil_recruit_origin_pkey mil_recruit_origin_server_id_player_id_operation_command_id_key mil_recruit_receipt_pkey work_queue_id_seq`)

var recruitPGPinNames = strings.Fields("account player player_wallet player_city mil_city_origin city_troop work_queue mil_recruit_origin mil_recruit_receipt")

func recruitPGFixture(t *testing.T, trace *returnPGTrace, configure ...func(*pgxpool.Config)) (*pgx.Conn, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	// Bootstrap only: this helper never constructs a return generation. Discard
	// its 43-object profile and query the independent 34-object Recruit inventory.
	_, observer, binding, _ := returnPGFixture(t, trace, configure...)
	ctx := returnPGContext(t)
	var version int
	returnPGOK(t, observer.QueryRow(ctx, "SELECT current_setting('server_version_num')::int").Scan(&version))
	if version < 170000 || version >= 180000 {
		t.Fatalf("PostgreSQL 17 required, got %d", version)
	}
	p := freshsource.Profile{ReleaseDigest: [32]byte{1}, EvidenceDigest: [32]byte{2}, ClusterRef: "owned-fixture", EvidenceRef: "not-production-evidence", ServerID: 1, Cohort: [16]byte{3}, Objects: map[string]freshsource.ObjectIdentity{}}
	returnPGOK(t, observer.QueryRow(ctx, `SELECT d.datname,d.oid,n.nspname,n.oid,n.nspowner,current_user,r.oid,session_user,s.oid
FROM pg_catalog.pg_database d,pg_catalog.pg_namespace n,pg_catalog.pg_roles r,pg_catalog.pg_roles s
WHERE d.datname=current_database() AND n.nspname=current_schema() AND r.rolname=current_user AND s.rolname=session_user`).Scan(
		&p.DatabaseName, &p.DatabaseOID, &p.SchemaName, &p.SchemaOID, &p.SchemaOwnerOID, &p.CurrentRoleName, &p.CurrentRoleOID, &p.SessionRoleName, &p.SessionRoleOID))
	seen := make(map[uint32]bool)
	for _, name := range recruitPGNames {
		var id freshsource.ObjectIdentity
		returnPGOK(t, observer.QueryRow(ctx, "SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname=$2", p.SchemaOID, name).Scan(&id.OID, &id.OwnerOID))
		if seen[id.OID] {
			t.Fatal("duplicate independently captured object", name)
		}
		seen[id.OID], p.Objects[name] = true, id
	}
	if len(recruitPGNames) != 34 || len(p.Objects) != 34 {
		t.Fatal("fixture is not the independent 34-object Recruit inventory")
	}
	return observer, binding, p
}

// Frozen exact SQL bytes at approved source d4ec3d7, not learned from a trace or
// regenerated from production source during tests. Changes require review.
var recruitPGReadDigests = map[string]bool{
	"c868434fb93eb0d9dfd10e8fdb2c7ce69666117ea49571210b33b40a0cddfb43": true, // freshActorHeader / freshBaseHeader
	"461c4fd26da66b0dec6ea8f089279c9b6204e809078cc9803399bdc7e179e81e": true, // freshActorTableCatalog
	"5628e86db71472d0bbd53abd74a8fe3859caeee08bed4b1044f838d5023b6cf4": true, // freshActorFKCatalog
	"a9b81d9ed68f2daa2c75405a3791fe4e58a399b9e71b93ce076edfd88cf1d91d": true, // freshActorIndexCatalog
	"2f124b9d58ab83dfa80e3c5a49c389f2651e449c35dd07c2afb6291a520ebd92": true, // freshActorIdentityCatalog
	"9cd3fda5e0207a9ade628b5b693323fb1f321240dea73430673934f78254967c": true, // recruitWalletCatalog
	"2cc8f943b9baaeee3772eb23e48850fa1696b8c8619e2ac549284c217629e2a4": true, // citySequenceMetadata
	"63da00f9d0b79e696cb3127f9bbb1c8ac71da97acaf06b979dce7f5c750c7996": true, // freshSourceCatalog
	"7dd5ac247a98852de20e85cd2173d940915bd516319bbe980fca402acbe06d6c": true, // freshBaseCatalog
	"20249087131a4f2f6f974ec1fda22d289bef173ded7e8a282902cd8b2e15891f": true, // freshQueueCatalog
	"4960631e879bd98a19d0f033d50632c24ae648b68c386573a414ab996b25a30b": true, // freshRetainedCatalog
	"5b8e8ab3548be3515785a398beafa551a8babb840ee19bdec2326b343b8cb60b": true, // freshRetainedFK
	"be11812c914fdf1d181e4e612f5d3c27c570f57f6e2ff9b57abf9c85e85f398a": true, // freshMilitarySequence
	"a18658fff5cd577db0273468e4607e4ce443eb2b11a1fe6ee74e06abd6f94f9d": true, // WORLD current_schemas read
	"766fb493a7fded01caccd677d7ec37c110c35fb92832fc1208654a689e8fca05": true, // Recruit privilege read
}

// Zero rejects every SQL byte string outside the closed set, including suffixes.
func recruitPGSQLKind(sql string, p freshsource.Profile) int {
	if sql == "begin isolation level read committed" {
		return 1
	}
	if sql == "rollback" {
		return 2
	}
	for i, name := range recruitPGPinNames {
		prefix, mode := "LOCK TABLE ", "ROW EXCLUSIVE"
		if i >= 4 {
			prefix = "LOCK TABLE ONLY "
		}
		if i < 2 || i == 3 {
			mode = "ROW SHARE"
		}
		pin := prefix + pgx.Identifier{p.SchemaName, name}.Sanitize() + " IN " + mode + " MODE"
		if sql == pin {
			return 3
		}
	}
	sequenceRead := "SELECT last_value,is_called FROM " + pgx.Identifier{p.SchemaName, "work_queue_id_seq"}.Sanitize()
	if sql == sequenceRead || recruitPGReadDigests[fmt.Sprintf("%x", sha256.Sum256([]byte(sql)))] {
		return 4
	}
	return 0
}

// Checks the no-write transaction boundary, not the separate pin-order barriers.
func recruitPGRecorded(t *testing.T, trace *returnPGTrace, observer *pgx.Conn, p freshsource.Profile, wantPins int) {
	t.Helper()
	begin, rollback, reads, pins := 0, 0, 0, 0
	var pid uint32
	for _, q := range trace.events() {
		if pid == 0 {
			pid = q.pid
		}
		if q.pid != pid || q.pid == observer.PgConn().PID() || q.err != nil {
			t.Fatal("unexpected backend, observer reuse or SQL error", q.pid, q.err)
		}
		switch recruitPGSQLKind(q.sql, p) {
		case 1:
			begin++
		case 2:
			rollback++
		case 3:
			pins++
		case 4:
			reads++
		default:
			t.Fatal("unexpected validation SQL", q.sql)
		}
	}
	if begin != 1 || rollback != 1 || reads == 0 || pins != wantPins {
		t.Fatalf("begin=%d rollback=%d reads=%d pins=%d, want pins=%d", begin, rollback, reads, pins, wantPins)
	}
}

func recruitPGReleased(t *testing.T, ctx context.Context, observer *pgx.Conn, p freshsource.Profile) {
	t.Helper()
	var tables []string
	for _, name := range recruitPGPinNames {
		tables = append(tables, pgx.Identifier{p.SchemaName, name}.Sanitize())
	}
	returnPGExec(t, ctx, observer, "BEGIN; LOCK TABLE "+strings.Join(tables, ",")+" IN ACCESS EXCLUSIVE MODE NOWAIT; ROLLBACK")
}
