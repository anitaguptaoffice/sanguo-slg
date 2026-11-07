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
	return append(want, strings.Fields("account-proof account-hint account-proof actor player wallet-proof wallet military-proof candidate city-proof city military-proof marker stock pending receipt-lock evidence military-proof candidate clock credit done commit")...)
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
	for _, invalid := range [][]string{valid[1:], valid[:len(valid)-1], append(append([]string(nil), valid...), "commit"), swapped} {
		if recruitCompleteStagesValid(invalid, 1) {
			t.Fatal("missing/extra/out-of-order completion stage accepted")
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
