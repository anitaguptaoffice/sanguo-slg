package api

import (
	"crypto/sha256"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
)

// Frozen DoneHistory bytes at 259ddf2d, not learned from runtime traces.
var recruitHistorySQL = map[string]string{
	"68d25534c0b86c6c8336a95ae5eec20c3eeb59b0f03e5dfe3ae4745d86b012ba": "done-queue",
	"0b9a29b1f47a0dc89f73281f41d5b8b13873c555824527a6a242dc6b9977a1fd": "done-receipt",
}

func recruitHistoryStage(sql string, p freshsource.Profile) (string, bool) {
	if stage, ok := recruitCompleteStage(sql, p); ok {
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
	stage, ok := recruitHistorySQL[fmt.Sprintf("%x", sha256.Sum256([]byte(normal)))]
	return stage, ok
}

func recruitHistoryOrder() []string {
	want := []string{"begin isolation level read committed"}
	for _, name := range recruitPGPinNames {
		want = append(want, "pin:"+name)
	}
	return append(want, strings.Fields("account-hint-proof account-hint account-proof actor player wallet-proof wallet completion-proof candidate completion-proof done-queue completion-proof done-receipt commit")...)
}

func recruitHistoryRecorded(events []returnPGQuery, observer uint32, p freshsource.Profile) error {
	var got []string
	var pid uint32
	reads := 0
	for _, q := range events {
		if pid == 0 {
			pid = q.pid
		}
		if q.pid == 0 || q.pid != pid || q.pid == observer || q.err != nil {
			return fmt.Errorf("history backend/error: pid=%d err=%v", q.pid, q.err)
		}
		stage, ok := recruitHistoryStage(q.sql, p)
		if !ok {
			return fmt.Errorf("unexpected history SQL: %q", q.sql)
		}
		if stage == "metadata" {
			if len(got) == 0 || got[len(got)-1] == "commit" {
				return fmt.Errorf("history metadata outside transaction")
			}
			reads++
			continue
		}
		got = append(got, stage)
	}
	if !recruitHistoryStages(got, reads) {
		return fmt.Errorf("history stages: %v metadata=%d", got, reads)
	}
	return nil
}

func recruitHistoryStages(got []string, metadata int) bool {
	return metadata > 0 && reflect.DeepEqual(got, recruitHistoryOrder())
}

func TestRecruitCompletionHistorySQLWitness(t *testing.T) {
	p := freshsource.Profile{SchemaName: `history_"Q`}
	candidate := `SELECT q.*,o.player_id,o.operation,o.command_id,r.* FROM "work_queue" q JOIN "mil_recruit_origin" o ON o.server_id OPERATOR(pg_catalog.=) q.server_id AND o.queue_id OPERATOR(pg_catalog.=) q.queue_id JOIN "mil_recruit_receipt" r ON r.server_id OPERATOR(pg_catalog.=) q.server_id AND r.queue_id OPERATOR(pg_catalog.=) q.queue_id WHERE q.server_id OPERATOR(pg_catalog.=) $1 AND q.queue_id OPERATOR(pg_catalog.=) $2`
	for _, name := range recruitPGPinNames {
		candidate = strings.ReplaceAll(candidate, pgx.Identifier{name}.Sanitize(), pgx.Identifier{p.SchemaName, name}.Sanitize())
	}
	for suffix, want := range map[string]string{" FOR UPDATE OF q": "done-queue", " FOR UPDATE OF r": "done-receipt"} {
		sql := candidate + suffix
		if stage, ok := recruitHistoryStage(sql, p); !ok || stage != want {
			t.Fatal("exact DoneHistory SQL rejected", want, stage)
		}
		for _, bad := range []string{sql + "; SELECT 1", sql + "\n", strings.ReplaceAll(sql, pgx.Identifier{p.SchemaName}.Sanitize()+".", ""), strings.ReplaceAll(sql, pgx.Identifier{p.SchemaName}.Sanitize(), `"other"`)} {
			if stage, ok := recruitHistoryStage(bad, p); ok {
				t.Fatal("suffixed or unqualified history SQL accepted", stage)
			}
		}
	}
	valid := recruitHistoryOrder()
	if !recruitHistoryStages(valid, 1) || recruitHistoryStages(valid, 0) {
		t.Fatal("valid history stages or missing metadata misclassified")
	}
	swapped := append([]string(nil), valid...)
	swapped[20], swapped[22] = swapped[22], swapped[20]
	for _, invalid := range [][]string{valid[:len(valid)-1], append(append([]string(nil), valid...), "commit"),
		append(append([]string(nil), valid[:20]...), valid[21:]...), append(append([]string(nil), valid[:21]...), valid[20:]...), swapped,
		append(append([]string(nil), valid[:20]...), append([]string{"stock"}, valid[20:]...)...)} {
		if recruitHistoryStages(invalid, 1) {
			t.Fatal("missing/extra/reordered/write history stages accepted")
		}
	}
	for _, replacement := range []struct {
		at    int
		stage string
	}{{10, "account-proof"}, {17, "military-proof"}} {
		alias := append([]string(nil), valid...)
		alias[replacement.at] = replacement.stage
		if recruitHistoryStages(alias, 1) {
			t.Fatal("different port proof substituted", replacement)
		}
	}
	for _, events := range [][]returnPGQuery{{{sql: "commit", pid: 0}}, {{sql: "commit", pid: 7}}, {{sql: "SELECT 1", pid: 8}}, {{sql: candidate + " FOR UPDATE OF q", pid: 8}}} {
		if recruitHistoryRecorded(events, 7, p) == nil {
			t.Fatal("invalid backend, unknown SQL or incomplete history accepted")
		}
	}
}
