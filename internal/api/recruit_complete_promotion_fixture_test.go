package api

import (
	"context"
	"crypto/sha256"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/jackc/pgx/v5"
)

// Frozen conditional promotion bytes at 22d77d10, never derived at test time.
const recruitPromotionSQL = `UPDATE "work_queue" SET status = 1,start_at = $5,finish_at = $6 WHERE server_id OPERATOR(pg_catalog.=) $1 AND queue_id OPERATOR(pg_catalog.=) $2 AND player_id OPERATOR(pg_catalog.=) $3 AND city_id OPERATOR(pg_catalog.=) $4 AND queue_type OPERATOR(pg_catalog.=) 3 AND status OPERATOR(pg_catalog.=) 0`

func recruitPromotionQuery(p freshsource.Profile) string {
	return strings.ReplaceAll(recruitPromotionSQL, `"work_queue"`, pgx.Identifier{p.SchemaName, "work_queue"}.Sanitize())
}

type recruitPromotionTrace struct {
	recruitNoeffectTrace
	promotion string
	args      [][]any // One completion caller writes; read only after its join.
}

func (r *recruitPromotionTrace) TraceQueryStart(ctx context.Context, conn *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx = r.recruitNoeffectTrace.TraceQueryStart(ctx, conn, data)
	if data.SQL == r.promotion {
		r.args = append(r.args, append([]any(nil), data.Args...))
	}
	return ctx
}

func recruitPromotionTimes(args [][]any, lower, upper time.Time) (time.Time, time.Time, bool) {
	if len(args) != 1 || len(args[0]) != 6 {
		return time.Time{}, time.Time{}, false
	}
	a := args[0]
	start, startOK := a[4].(time.Time)
	finish, finishOK := a[5].(time.Time)
	return start, finish, startOK && finishOK && a[0] == int32(1) && a[1] == int64(101) && a[2] == int64(1) && a[3] == int64(1) &&
		start == start.UTC().Truncate(time.Millisecond) && finish == start.Add(11*time.Second) &&
		!start.Before(lower.UTC().Truncate(time.Millisecond)) && !start.After(upper.UTC().Truncate(time.Millisecond))
}

func recruitPromotionOrder() []string {
	base := recruitCompleteOrder()
	return append(base[:len(base)-1], "promote", "commit")
}

func recruitPromotionStages(got []string, metadata int) bool {
	return metadata > 0 && reflect.DeepEqual(got, recruitPromotionOrder())
}

func recruitPromotionRecorded(events []returnPGQuery, observer uint32, p freshsource.Profile) error {
	var got []string
	var pid uint32
	reads := 0
	for _, q := range events {
		if pid == 0 {
			pid = q.pid
		}
		if q.pid == 0 || q.pid != pid || q.pid == observer || q.err != nil {
			return fmt.Errorf("promotion backend/error: pid=%d err=%v", q.pid, q.err)
		}
		stage, ok := recruitCompleteStage(q.sql, p)
		if q.sql == recruitPromotionQuery(p) {
			stage, ok = "promote", true
		}
		if !ok {
			return fmt.Errorf("unexpected promotion SQL: %q", q.sql)
		}
		if stage == "metadata" {
			if len(got) == 0 || got[len(got)-1] == "commit" {
				return fmt.Errorf("promotion metadata outside transaction")
			}
			reads++
			continue
		}
		got = append(got, stage)
	}
	if !recruitPromotionStages(got, reads) {
		return fmt.Errorf("promotion stages: %v metadata=%d", got, reads)
	}
	return nil
}

func recruitPromotionStable(t *testing.T, ctx context.Context, observer *pgx.Conn) string {
	t.Helper()
	var value string
	returnPGOK(t, observer.QueryRow(ctx, `SELECT jsonb_agg(v ORDER BY v)::text FROM (
SELECT jsonb_build_array('queue',to_jsonb(q)-'status'-'start_at'-'finish_at',CASE WHEN queue_id IN(100,101) THEN NULL ELSE status END,
CASE WHEN queue_id=101 THEN NULL ELSE start_at END,CASE WHEN queue_id=101 THEN NULL ELSE finish_at END,
CASE WHEN queue_id IN(100,101) THEN NULL ELSE xmin::text END,CASE WHEN queue_id IN(100,101) THEN NULL ELSE ctid::text END) v FROM work_queue q
UNION ALL SELECT jsonb_build_array('stock',to_jsonb(s)-'count',CASE WHEN unit_cfg_id=1 THEN NULL ELSE count END,
CASE WHEN unit_cfg_id=1 THEN NULL ELSE xmin::text END,CASE WHEN unit_cfg_id=1 THEN NULL ELSE ctid::text END) FROM city_troop s) rows`).Scan(&value))
	return value
}

func TestRecruitCompletionPromotionSQLWitness(t *testing.T) {
	if fmt.Sprintf("%x", sha256.Sum256([]byte(recruitPromotionSQL))) != "503d4095775a319e64eee4a7e9a958ba7ddadabbc00ded5bed6c0e2c368527ee" {
		t.Fatal("promotion SQL differs from frozen source bytes")
	}
	p := freshsource.Profile{SchemaName: `promotion_"Q`}
	query := recruitPromotionQuery(p)
	for _, bad := range []string{query + "; SELECT 1", query + "\n", recruitPromotionSQL, strings.ReplaceAll(query, pgx.Identifier{p.SchemaName}.Sanitize(), `"other"`)} {
		err := recruitPromotionRecorded([]returnPGQuery{{sql: bad, pid: 8}}, 7, p)
		if err == nil || !strings.HasPrefix(err.Error(), "unexpected promotion SQL:") {
			t.Fatal("suffixed/unqualified/wrong-schema promotion accepted", err)
		}
	}
	if err := recruitPromotionRecorded([]returnPGQuery{{sql: query, pid: 8}}, 7, p); err == nil || !strings.HasPrefix(err.Error(), "promotion stages:") {
		t.Fatal("exact promotion SQL was not classified", err)
	}
	valid := recruitPromotionOrder()
	if !recruitPromotionStages(valid, 1) || recruitPromotionStages(valid, 0) {
		t.Fatal("valid order or missing metadata misclassified")
	}
	swapped := append([]string(nil), valid...)
	swapped[len(swapped)-2], swapped[len(swapped)-3] = swapped[len(swapped)-3], swapped[len(swapped)-2]
	missingProof := append(append([]string(nil), valid[:17]...), valid[18:]...)
	duplicateProof := append(append([]string(nil), valid[:18]...), valid[17:]...)
	swappedProof := append([]string(nil), valid...)
	swappedProof[10], swappedProof[12] = swappedProof[12], swappedProof[10]
	for _, bad := range [][]string{valid[:len(valid)-1], recruitCompleteOrder(), swapped, missingProof, duplicateProof, swappedProof,
		append(append([]string(nil), valid...), "promote"), append(append([]string(nil), valid...), "debit")} {
		if recruitPromotionStages(bad, 1) {
			t.Fatal("missing/duplicate/reordered/extra-write stage accepted")
		}
	}
	for _, replacement := range []struct {
		at    int
		stage string
	}{{10, "account-proof"}, {17, "military-proof"}} {
		alias := append([]string(nil), valid...)
		alias[replacement.at] = replacement.stage
		if recruitPromotionStages(alias, 1) {
			t.Fatal("different port proof substituted", replacement)
		}
	}
	at := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	args := []any{int32(1), int64(101), int64(1), int64(1), at, at.Add(11 * time.Second)}
	if _, _, ok := recruitPromotionTimes([][]any{args}, at, at); !ok {
		t.Fatal("valid promotion arguments rejected")
	}
	for i, replacement := range []any{int32(2), int64(102), int64(2), int64(2), at.Add(time.Nanosecond), at.Add(12 * time.Second)} {
		bad := append([]any(nil), args...)
		bad[i] = replacement
		if _, _, ok := recruitPromotionTimes([][]any{bad}, at, at); ok {
			t.Fatal("wrong target or processing time accepted", i)
		}
	}
	for _, bad := range [][][]any{nil, {args, args}, {args[:5]}} {
		if _, _, ok := recruitPromotionTimes(bad, at, at); ok {
			t.Fatal("missing/duplicate/truncated promotion arguments accepted")
		}
	}
	if _, _, ok := recruitPromotionTimes([][]any{args}, at.Add(time.Second), at.Add(2*time.Second)); ok {
		t.Fatal("processing time outside PG observation bounds accepted")
	}
	for _, events := range [][]returnPGQuery{{{sql: query, pid: 0}}, {{sql: query, pid: 7}}, {{sql: "SELECT 1", pid: 8}}, {{sql: query, pid: 8}}} {
		if recruitPromotionRecorded(events, 7, p) == nil {
			t.Fatal("bad backend, unknown SQL or incomplete trace accepted")
		}
	}
}
