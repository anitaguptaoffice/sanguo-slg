package api

import (
	"context"
	"crypto/sha256"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
)

// Frozen source b5c14218, schema qualifier removed. These are reviewed bytes,
// never learned from a runtime trace or generated from source by the tests.
var recruitCompleteSQL = map[string]string{
	"2889a3e527cd491fe8fd2f3ec2c60afef166755da69d6c2c4de987f5fe218453": "account-hint-proof",
	"5c70b8e256d9b5e41ee6e0f55273ab4af129d9bbe77203d3310778ceb0279732": "completion-proof",
	"4235480dc2dbad1b5b4b81f36e525bd8ed97ee54a5715fd31193136786a5b370": "account-hint",
	"430fd70026111f86d4b74ab595d8bc93f85a531078ca1d190afa740a6a538b8b": "candidate",
	"2f7e37be61acbfef29a3aa2e09ec71ef5e86363adb4822ea2aadb3ceea12f0af": "receipt-lock",
	"b307846c8b00294b5c501e89ab737a8e8f5247cfcfe803597064506fecdbd2ff": "evidence",
	"15799f02e3b6714ca9b005f53d337a17bd18a1582fde7cbc93b425df021926c9": "credit",
	"c54b34a511a09cca098738576fdb224e45bc0ac221c72453f7aa22c54d5f128c": "done",
}

func recruitCompleteStage(sql string, p freshsource.Profile) (string, bool) {
	if stage, ok := recruitAttemptPGStage(sql, p); ok {
		return stage, true
	}
	normal := strings.ReplaceAll(sql, pgx.Identifier{p.SchemaName}.Sanitize()+".", "")
	qualified := normal
	for _, name := range recruitPGPinNames {
		qualified = strings.ReplaceAll(qualified, pgx.Identifier{name}.Sanitize(), pgx.Identifier{p.SchemaName, name}.Sanitize())
	}
	if qualified != sql {
		return "", false
	}
	stage, ok := recruitCompleteSQL[fmt.Sprintf("%x", sha256.Sum256([]byte(normal)))]
	return stage, ok
}

func recruitCompleteOrder() []string {
	want := []string{"begin isolation level read committed"}
	for _, name := range recruitPGPinNames {
		want = append(want, "pin:"+name)
	}
	return append(want, strings.Fields("account-hint-proof account-hint account-proof actor player wallet-proof wallet completion-proof candidate city-proof city completion-proof marker stock pending receipt-lock evidence completion-proof candidate clock credit done commit")...)
}

func recruitCompleteRecorded(events []returnPGQuery, observer uint32, p freshsource.Profile) error {
	var got []string
	var pid uint32
	reads := 0
	for _, q := range events {
		if pid == 0 {
			pid = q.pid
		}
		if q.pid == 0 || q.pid != pid || q.pid == observer || q.err != nil {
			return fmt.Errorf("completion backend/error: pid=%d err=%v", q.pid, q.err)
		}
		stage, ok := recruitCompleteStage(q.sql, p)
		if !ok {
			return fmt.Errorf("unexpected completion SQL: %q", q.sql)
		}
		if stage == "metadata" {
			if len(got) == 0 || got[len(got)-1] == "commit" {
				return fmt.Errorf("completion metadata outside transaction")
			}
			reads++
			continue
		}
		got = append(got, stage)
	}
	if !recruitCompleteStagesValid(got, reads) {
		return fmt.Errorf("completion stages: %v metadata=%d", got, reads)
	}
	return nil
}

func recruitCompleteStagesValid(got []string, metadata int) bool {
	return metadata > 0 && reflect.DeepEqual(got, recruitCompleteOrder())
}

// Preserve every field and physical identity except the two intended target
// updates. Whole-table snapshots separately require both relations to change.
func recruitCompleteStable(t *testing.T, ctx context.Context, observer *pgx.Conn) string {
	t.Helper()
	var value string
	returnPGOK(t, observer.QueryRow(ctx, `SELECT jsonb_agg(v ORDER BY v)::text FROM (
SELECT jsonb_build_array('queue',to_jsonb(q)-'status',CASE WHEN queue_id=100 THEN NULL ELSE status END,
CASE WHEN queue_id=100 THEN NULL ELSE xmin::text END,CASE WHEN queue_id=100 THEN NULL ELSE ctid::text END) v FROM work_queue q
UNION ALL SELECT jsonb_build_array('stock',to_jsonb(s)-'count',CASE WHEN unit_cfg_id=1 THEN NULL ELSE count END,
CASE WHEN unit_cfg_id=1 THEN NULL ELSE xmin::text END,CASE WHEN unit_cfg_id=1 THEN NULL ELSE ctid::text END) FROM city_troop s) rows`).Scan(&value))
	return value
}

func TestRecruitCompletionSQLWitness(t *testing.T) {
	p := freshsource.Profile{SchemaName: `complete_"Q`}
	hintProof := `SELECT pg_catalog.count(DISTINCT relation) OPERATOR(pg_catalog.=) 2 FROM pg_catalog.pg_locks
 WHERE pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
 AND database OPERATOR(pg_catalog.=) (SELECT oid FROM pg_catalog.pg_database WHERE datname OPERATOR(pg_catalog.=) pg_catalog.current_database())
 AND locktype OPERATOR(pg_catalog.=) 'relation' AND mode OPERATOR(pg_catalog.=) 'RowShareLock' AND granted
 AND relation IN ($1,$2)`
	actorProof := `SELECT count(DISTINCT relation)=2 FROM pg_catalog.pg_locks
 WHERE pid=pg_catalog.pg_backend_pid() AND database=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())
 AND locktype='relation' AND mode='RowShareLock' AND granted AND relation IN ($1,$2)`
	completionProof := `SELECT pg_catalog.count(*) FROM pg_catalog.unnest($1::pg_catalog.oid[]) e(oid) WHERE EXISTS(SELECT FROM pg_catalog.pg_locks l WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid() AND l.granted AND l.locktype OPERATOR(pg_catalog.=) 'relation' AND l.relation OPERATOR(pg_catalog.=) e.oid AND l.mode OPERATOR(pg_catalog.=) 'RowExclusiveLock')`
	admissionProof := `SELECT pg_catalog.count(*) FROM pg_catalog.unnest($1::pg_catalog.oid[]) e(oid)
 WHERE EXISTS(SELECT FROM pg_catalog.pg_locks l WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
 AND l.granted AND l.locktype OPERATOR(pg_catalog.=) 'relation' AND l.relation OPERATOR(pg_catalog.=) e.oid
 AND l.mode OPERATOR(pg_catalog.=) 'RowExclusiveLock')`
	for sql, want := range map[string]string{hintProof: "account-hint-proof", actorProof: "account-proof", completionProof: "completion-proof", admissionProof: "military-proof"} {
		if stage, ok := recruitCompleteStage(sql, p); !ok || stage != want {
			t.Fatal("distinct frozen proof misclassified", want, stage)
		}
		for _, suffix := range []string{"; SELECT 1", "\n"} {
			if stage, ok := recruitCompleteStage(sql+suffix, p); ok {
				t.Fatal("altered proof bytes accepted", want, stage)
			}
		}
	}
	hint := "SELECT account_id FROM " + pgx.Identifier{p.SchemaName, "player"}.Sanitize() + " WHERE server_id OPERATOR(pg_catalog.=) $1 AND player_id OPERATOR(pg_catalog.=) $2"
	if stage, ok := recruitCompleteStage(hint, p); !ok || stage != "account-hint" {
		t.Fatal("exact account hint rejected", stage)
	}
	for _, sql := range []string{hint + "; SELECT 1", "commit; SELECT 1", "SELECT 1", "rollback",
		strings.ReplaceAll(hint, pgx.Identifier{p.SchemaName}.Sanitize()+".", ""),
		strings.ReplaceAll(hint, pgx.Identifier{p.SchemaName}.Sanitize(), `"other"`)} {
		if stage, ok := recruitCompleteStage(sql, p); ok {
			t.Fatal("unknown/suffixed/wrong-schema SQL accepted", sql, stage)
		}
	}
	// Negative controls exercise the checker, never a business coordinator.
	valid := recruitCompleteOrder()
	if !recruitCompleteStagesValid(valid, 1) || recruitCompleteStagesValid(valid, 0) {
		t.Fatal("valid stages or missing metadata misclassified")
	}
	swapped := append([]string(nil), valid...)
	swapped[len(swapped)-2], swapped[len(swapped)-3] = swapped[len(swapped)-3], swapped[len(swapped)-2]
	swappedProof := append([]string(nil), valid...)
	swappedProof[10], swappedProof[12] = swappedProof[12], swappedProof[10]
	missingProof := append(append([]string(nil), valid[:10]...), valid[11:]...)
	duplicateProof := append(append([]string(nil), valid[:11]...), valid[10:]...)
	for _, invalid := range [][]string{valid[1:], valid[:len(valid)-1], append(append([]string(nil), valid...), "commit"), swapped, swappedProof, missingProof, duplicateProof} {
		if recruitCompleteStagesValid(invalid, 1) {
			t.Fatal("missing/extra/out-of-order completion stage accepted")
		}
	}
	for _, replacement := range []struct {
		at    int
		stage string
	}{{10, "account-proof"}, {17, "military-proof"}} {
		alias := append([]string(nil), valid...)
		alias[replacement.at] = replacement.stage
		if recruitCompleteStagesValid(alias, 1) {
			t.Fatal("different port proof substituted", replacement)
		}
	}
	for _, pid := range []uint32{0, 7} {
		err := recruitCompleteRecorded([]returnPGQuery{{sql: hint, pid: pid}}, 7, p)
		if err == nil || !strings.HasPrefix(err.Error(), "completion backend/error:") {
			t.Fatal("zero backend or observer reuse not rejected at backend boundary", err)
		}
	}
	if recruitCompleteRecorded([]returnPGQuery{{sql: "begin isolation level read committed", pid: 8}}, 7, p) == nil {
		t.Fatal("incomplete SQL trace accepted")
	}
}
