// SPEC-FIRST-CITY-LEDGER-PLAYER-CITY-ID-SEQ-001: disposable PG17 player_city_id_seq contract.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	migration  = "m4_014_first_city_ledger_player_city_id_seq.sql"
	gucHarness = "sanguo.first_city_ledger_player_city_id_seq_harness"
	gucFixture = "sanguo.first_city_ledger_player_city_id_fixture_highwater"
	maxInt64   = int64(9223372036854775807)
)

var (
	ctx     = context.Background()
	body    string
	baseDir string
	dsn     string
	admin   *pgxpool.Pool
	serial  int
)

func must(err error)             { if err != nil { panic(err) } }
func assert(ok bool, msg string) { if !ok { panic(msg) } }
func exec(p *pgxpool.Pool, sql string, a ...any) { _, e := p.Exec(ctx, sql, a...); must(e) }

type seqSnap struct{ L int64; C bool }

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-pcis-specs-")
	must(err)
	var paths []string
	for _, pat := range []string{"00*.sql", "m3_*.sql", "m4_*.sql"} {
		m, err := filepath.Glob("spec/db/" + pat)
		must(err)
		paths = append(paths, m...)
	}
	sort.Strings(paths)
	for _, path := range paths {
		data, err := os.ReadFile(path)
		must(err)
		must(os.WriteFile(filepath.Join(baseDir, filepath.Base(path)), data, 0o600))
	}
}

func fresh() (*pgxpool.Pool, func()) {
	serial++
	schema := fmt.Sprintf("fc_pcis_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = 8
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return pool, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func apply(p *pgxpool.Pool) { must(db.ApplySpecs(ctx, p, baseDir)) }

func runHarnessSQL(p *pgxpool.Pool, fixtureH string) {
	tx, err := p.Begin(ctx)
	must(err)
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, "SET LOCAL "+gucHarness+"='true'")
	must(err)
	if fixtureH != "" {
		_, err = tx.Exec(ctx, "SET LOCAL "+gucFixture+"='"+fixtureH+"'")
		must(err)
	}
	_, err = tx.Exec(ctx, body)
	must(err)
	must(tx.Commit(ctx))
}

func readSeq(p *pgxpool.Pool) seqSnap {
	var s seqSnap
	must(p.QueryRow(ctx, `SELECT last_value, is_called FROM player_city_id_seq`).Scan(&s.L, &s.C))
	return s
}

func nextCandidate(s seqSnap) (int64, bool) {
	if !s.C {
		return s.L, true
	}
	if s.L == maxInt64 {
		return 0, false
	}
	return s.L + 1, true
}

func observerSnap(p *pgxpool.Pool) string {
	var b strings.Builder
	var n int64
	for _, rel := range []string{"player_city", "player_wallet"} {
		must(p.QueryRow(ctx, "SELECT count(*) FROM "+rel).Scan(&n))
		b.WriteString(rel + "=" + fmt.Sprint(n) + ";")
	}
	var s seqSnap
	if err := p.QueryRow(ctx, `SELECT last_value, is_called FROM player_city_id_seq`).Scan(&s.L, &s.C); err != nil {
		b.WriteString("seq=absent"); return b.String()
	}
	b.WriteString(fmt.Sprintf("seq=%d:%v", s.L, s.C))
	return b.String()
}

func seqShapeOK(p *pgxpool.Pool) bool {
	var typ string
	var inc, minv, maxv, cache, start int64
	var cycle bool
	err := p.QueryRow(ctx, `SELECT data_type, increment_by::bigint, min_value::bigint, max_value::bigint,
 cycle, cache_size::bigint, start_value::bigint FROM pg_sequences WHERE sequencename='player_city_id_seq'`).Scan(
		&typ, &inc, &minv, &maxv, &cycle, &cache, &start)
	return err == nil && typ == "bigint" && inc == 1 && minv == 1 && maxv == maxInt64 && !cycle && cache == 1 && start == 1
}

func provisionDefaultNoOp(p *pgxpool.Pool) {
	before := observerSnap(p)
	_, err := p.Exec(ctx, body)
	must(err)
	assert(observerSnap(p) == before, "default ApplySpecs path must not create seq")
	fmt.Println("PASS pcis: apply_specs_default_no_op_no_sequence")
}

func scenarioShapeAndEmptyFirst(p *pgxpool.Pool) {
	runHarnessSQL(p, "")
	assert(seqShapeOK(p), "pg_sequences shape")
	s := readSeq(p)
	assert(s.L == 1 && !s.C, "empty history L=1,C=false")
	var id int64
	must(p.QueryRow(ctx, `SELECT nextval('player_city_id_seq')`).Scan(&id))
	assert(id == 1, "first nextval is 1")
	fmt.Println("PASS pcis: object_shape_empty_history_first_allocation_1")
}

func scenarioIsCalledSemantics(p *pgxpool.Pool) {
	exec(p, `SELECT setval('player_city_id_seq', 41, false)`)
	cand, ok := nextCandidate(readSeq(p))
	assert(ok && cand == 41, "C=false -> L")
	var id int64
	must(p.QueryRow(ctx, `SELECT nextval('player_city_id_seq')`).Scan(&id))
	assert(id == 41, "nextval consumed L when C=false")
	cand, ok = nextCandidate(readSeq(p))
	assert(ok && cand == 42, "after call C=true -> L+1")
	fmt.Println("PASS pcis: next_value_is_called_semantics")
}

func scenarioFixtureHighwater(p *pgxpool.Pool) {
	runHarnessSQL(p, "100")
	cand, ok := nextCandidate(readSeq(p))
	assert(ok && cand == 101, "setval(H,true) yields H+1 next")
	var id int64
	must(p.QueryRow(ctx, `SELECT nextval('player_city_id_seq')`).Scan(&id))
	assert(id == 101, "nextval after forward")
	fmt.Println("PASS pcis: fixture_highwater_setval_forward")
}

func scenarioPreserveGreaterState(p *pgxpool.Pool) {
	exec(p, `SELECT setval('player_city_id_seq', 250, true)`)
	before := readSeq(p)
	runHarnessSQL(p, "100")
	after := readSeq(p)
	assert(after == before, "must not lower when next > fixture H")
	fmt.Println("PASS pcis: preserve_greater_sequence_state")
}

func scenarioMaxInt64Exhausted(p *pgxpool.Pool) {
	pool, done := fresh()
	defer done()
	apply(pool)
	runHarnessSQL(pool, "")
	exec(pool, fmt.Sprintf(`SELECT setval('player_city_id_seq', %d, true)`, maxInt64))
	_, ok := nextCandidate(readSeq(pool))
	assert(!ok, "exhausted without overflow add")
	_, err := pool.Exec(ctx, `SELECT nextval('player_city_id_seq')`)
	assert(err != nil, "nextval at exhaustion must error")
	fmt.Println("PASS pcis: maxint64_exhausted_no_overflow")
}

func scenarioRejectSetvalZero(p *pgxpool.Pool) {
	_, err := p.Exec(ctx, `SELECT setval('player_city_id_seq', 0, true)`)
	assert(err != nil, "setval(0) rejected")
	fmt.Println("PASS pcis: reject_setval_zero")
}

func scenarioWrongKindFailClosed(p *pgxpool.Pool) {
	pool, done := fresh()
	defer done()
	apply(pool)
	exec(pool, `CREATE TABLE player_city_id_seq (dummy int)`)
	tx, err := pool.Begin(ctx)
	must(err)
	_, err = tx.Exec(ctx, "SET LOCAL "+gucHarness+"='true'")
	must(err)
	_, err = tx.Exec(ctx, body)
	assert(err != nil && strings.Contains(err.Error(), "wrong kind"), "wrong kind fail-closed")
	must(tx.Rollback(ctx))
	var n int64
	must(pool.QueryRow(ctx, `SELECT count(*) FROM player_city`).Scan(&n))
	assert(n == 0, "no player_city write on failure")
	fmt.Println("PASS pcis: wrong_kind_fail_closed_no_business_write")
}

func scenarioRollbackAdvancesNoCompensation(p *pgxpool.Pool) {
	before := readSeq(p)
	tx, err := p.Begin(ctx)
	must(err)
	var id int64
	must(tx.QueryRow(ctx, `SELECT nextval('player_city_id_seq')`).Scan(&id))
	must(tx.Rollback(ctx))
	after := readSeq(p)
	assert(after.L >= before.L && (after.L > before.L || (after.C && !before.C)), "rollback does not undo nextval")
	var citiesBefore, citiesAfter int64
	must(p.QueryRow(ctx, `SELECT count(*) FROM player_city`).Scan(&citiesBefore))
	runHarnessSQL(p, fmt.Sprint(before.L))
	assert(readSeq(p).L >= after.L, "fixture forward must not lower after rollback advance")
	must(p.QueryRow(ctx, `SELECT count(*) FROM player_city`).Scan(&citiesAfter))
	assert(citiesBefore == citiesAfter, "no player_city row as allocation success")
	fmt.Println("PASS pcis: rollback_advances_no_lower_compensation")
}

func main() {
	if os.Getenv("ALLOW_OWNED_PG17_TEST") != "1" {
		fmt.Println("SKIP: ALLOW_OWNED_PG17_TEST=1 not set")
		return
	}
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	if dsn == "" {
		fmt.Println("SKIP: FIRST_CITY_LEDGER_TEST_DSN not set")
		return
	}
	data, err := os.ReadFile("spec/db/" + migration)
	must(err)
	body = string(data)
	stageSpecDir()
	defer func() { _ = os.RemoveAll(baseDir) }()
	admin, err = pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	var ver, major string
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	must(admin.QueryRow(ctx, "SELECT (current_setting('server_version_num')::integer/10000)::text").Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver)

	pool, done := fresh()
	defer done()
	apply(pool)
	provisionDefaultNoOp(pool)

	pool2, done2 := fresh()
	defer done2()
	apply(pool2)

	scenarioShapeAndEmptyFirst(pool2)
	scenarioIsCalledSemantics(pool2)
	scenarioFixtureHighwater(pool2)
	scenarioPreserveGreaterState(pool2)
	scenarioMaxInt64Exhausted(pool)
	scenarioRejectSetvalZero(pool2)
	scenarioWrongKindFailClosed(pool)
	scenarioRollbackAdvancesNoCompensation(pool2)

	fmt.Println("MODE: isolated PG17 player_city_id_seq contract; not production activation; not realm-enrolled")
}
