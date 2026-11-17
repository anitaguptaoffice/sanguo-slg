// SPEC-FIRST-CITY-LEDGER-ACK-LOSS-001: PG17 process restart / ACK-loss matrix; disposable only.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	realm   = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	fixCity = 88001
	mapX    = 10
	mapY    = 20
	cityLK  = 1128879193
)

var (
	ctx                         = context.Background()
	baseDir, dsn                string
	admin                       *pgxpool.Pool
	serial                      int
	cmdIns                      = `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at) VALUES ($1::uuid,1,42,$2::uuid,$3,$4,1,'t','r','c',1,$5,$6,now())`
	slotUpsert                  = `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id) VALUES ($1::uuid,1,42,$2,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`
	slotLock                    = `SELECT world_first_city_slot_advisory_lock($1::uuid,1,42)`
	headForUpdate               = `SELECT head_command_id::text FROM world_first_city_actor_slot WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 FOR UPDATE`
	headSet                     = `UPDATE world_first_city_actor_slot SET head_command_id=$2::uuid WHERE realm_id=$1::uuid AND server_id=1 AND player_id=42 AND head_command_id IS NULL`
	cmdStateForUpdate           = `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid FOR UPDATE`
	termReject                  = `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1 WHERE command_id=$1::uuid AND durable_state=1`
	termSuccess                 = `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),success_city_id=$2,success_server_id=1,success_player_id=42,success_is_capital=true,success_wall_level=1,success_morale=100 WHERE command_id=$1::uuid AND durable_state=1`
)

func must(err error) {
	if err != nil {
		panic(err)
	}
}
func assert(ok bool, msg string) {
	if !ok {
		panic(msg)
	}
}
func exec(p *pgxpool.Pool, sql string, args ...any) { _, err := p.Exec(ctx, sql, args...); must(err) }
func apply(p *pgxpool.Pool)                         { must(db.ApplySpecs(ctx, p, baseDir)) }
func c1() (c1, fct1, sha string)                   { return `\x01`, `\x` + strings.Repeat("00", 52), `\x` + strings.Repeat("ab", 32) }

func poolInSchema(schema string, max int) *pgxpool.Pool {
	cfg, err := pgxpool.ParseConfig(dsn)
	must(err)
	cfg.MaxConns = int32(max)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "8s"
	if max > 2 {
		cfg.ConnConfig.RuntimeParams["statement_timeout"] = "45s"
	}
	p, err := pgxpool.NewWithConfig(ctx, cfg)
	must(err)
	return p
}

func fresh() (pool *pgxpool.Pool, schema string, cleanup func()) {
	serial++
	schema = fmt.Sprintf("fc_ack_%x_%d", time.Now().UnixNano(), serial)
	exec(admin, "CREATE SCHEMA "+schema)
	pool = poolInSchema(schema, 6)
	return pool, schema, func() { pool.Close(); exec(admin, "DROP SCHEMA "+schema+" CASCADE") }
}

func stageSpecDir() {
	var err error
	baseDir, err = os.MkdirTemp("", "fc-ack-specs-")
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

func seedAcctMap(p *pgxpool.Pool) int64 {
	exec(p, `INSERT INTO account (login_name,password_hash,status) VALUES ('ack_u','ack_h',1)`)
	var acct int64
	must(p.QueryRow(ctx, `SELECT account_id FROM account LIMIT 1`).Scan(&acct))
	exec(p, `INSERT INTO player (server_id,player_id,account_id,display_name) VALUES (1,42,$1,'ack_p')`, acct)
	exec(p, `INSERT INTO map_cell (server_id,x,y,terrain) VALUES (1,$1,$2,4)`, mapX, mapY)
	return acct
}

func bizSum(p *pgxpool.Pool) int {
	var n int
	must(p.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=1 AND player_id=42)+(SELECT count(*) FROM player_city WHERE server_id=1)+(SELECT count(*) FROM city_troop WHERE server_id=1 AND city_id=$1)+(SELECT count(*) FROM mil_city_origin WHERE server_id=1 AND city_id=$1)+(SELECT count(*) FROM city_production_checkpoint WHERE server_id=1 AND city_id=$1)+(SELECT count(*) FROM city_building WHERE server_id=1 AND city_id=$1)`, fixCity).Scan(&n))
	return n
}

func cmdSnap(p *pgxpool.Pool, cmdID string) (state int16, sha string) {
	must(p.QueryRow(ctx, `SELECT durable_state,encode(content_sha256,'hex') FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).Scan(&state, &sha))
	return
}

func withConn(pool *pgxpool.Pool, fn func(pgx.Tx) (bool, error)) bool {
	c, err := pool.Acquire(ctx)
	must(err)
	defer c.Release()
	tx, err := c.Begin(ctx)
	must(err)
	ok, err := fn(tx)
	must(err)
	return ok
}

func prepSlot(tx pgx.Tx, acct int64) (head *string, err error) {
	if _, err = tx.Exec(ctx, slotLock, realm); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, slotUpsert, realm, acct); err != nil {
		return nil, err
	}
	err = tx.QueryRow(ctx, headForUpdate, realm).Scan(&head)
	return head, err
}

func intakeInitial(tx pgx.Tx, acct int64, cmdID string) (bool, error) {
	head, err := prepSlot(tx, acct)
	if err != nil || head != nil {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	c1, fct1, sha := c1()
	tag, err := tx.Exec(ctx, cmdIns, realm, cmdID, acct, c1, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	upd, err := tx.Exec(ctx, headSet, realm, cmdID)
	if err != nil || upd.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func intakeAbortBeforeCommit(tx pgx.Tx, acct int64, cmdID string) error {
	if _, err := prepSlot(tx, acct); err != nil {
		return err
	}
	c1, fct1, sha := c1()
	_, err := tx.Exec(ctx, cmdIns, realm, cmdID, acct, c1, fct1, sha)
	if err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	return tx.Rollback(ctx)
}

func effectBusiness(tx pgx.Tx) error {
	q := []string{
		`INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold) VALUES (1,42,1000,1000,1000,1000,100) ON CONFLICT DO NOTHING`,
		fmt.Sprintf(`SELECT pg_advisory_xact_lock(%d,1)`, cityLK),
		fmt.Sprintf(`SELECT 1 FROM map_cell WHERE server_id=1 AND x=%d AND y=%d FOR UPDATE`, mapX, mapY),
		fmt.Sprintf(`INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES (1,%d,42,'ack-city',%d,%d,true,1,100)`, fixCity, mapX, mapY),
		fmt.Sprintf(`INSERT INTO mil_city_origin (server_id,city_id,owner_player_id,cohort_id,format_version,created_at) VALUES (1,%d,42,decode(repeat('01',16),'hex'),1,now())`, fixCity),
		fmt.Sprintf(`INSERT INTO city_troop (server_id,city_id,unit_cfg_id,count) VALUES (1,%d,1,0)`, fixCity),
		fmt.Sprintf(`INSERT INTO city_production_checkpoint (server_id,city_id,player_id,settled_at) VALUES (1,%d,42,now())`, fixCity),
		fmt.Sprintf(`INSERT INTO city_building (server_id,city_id,slot_key,building_cfg_id,level) VALUES (1,%d,'town_hall',1,1)`, fixCity),
	}
	for _, sql := range q {
		if _, err := tx.Exec(ctx, sql); err != nil {
			return err
		}
	}
	return nil
}

func effectCommit(tx pgx.Tx, cmdID string) (bool, error) {
	if _, err := tx.Exec(ctx, slotLock, realm); err != nil {
		return false, err
	}
	var head *string
	if err := tx.QueryRow(ctx, headForUpdate, realm).Scan(&head); err != nil || head == nil || *head != cmdID {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	var st int16
	if err := tx.QueryRow(ctx, cmdStateForUpdate, cmdID).Scan(&st); err != nil || st != 1 {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	if err := effectBusiness(tx); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, termSuccess, cmdID, fixCity)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func finalizerReject(tx pgx.Tx, cmdID string) (bool, error) {
	if _, err := tx.Exec(ctx, slotLock, realm); err != nil {
		return false, err
	}
	var st int16
	if err := tx.QueryRow(ctx, cmdStateForUpdate, cmdID).Scan(&st); err != nil || st != 1 {
		if err == nil {
			return false, tx.Rollback(ctx)
		}
		return false, err
	}
	tag, err := tx.Exec(ctx, termReject, cmdID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, tx.Rollback(ctx)
	}
	return true, tx.Commit(ctx)
}

func main() {
	assert(os.Getenv("ALLOW_OWNED_PG17_TEST") == "1", "ALLOW_OWNED_PG17_TEST=1 required")
	dsn = os.Getenv("FIRST_CITY_LEDGER_TEST_DSN")
	assert(dsn != "", "FIRST_CITY_LEDGER_TEST_DSN required")
	stageSpecDir()
	defer func() { _ = os.RemoveAll(baseDir) }()
	var err error
	admin, err = pgxpool.New(ctx, dsn)
	must(err)
	defer admin.Close()
	var ver, major string
	must(admin.QueryRow(ctx, "SHOW server_version").Scan(&ver))
	must(admin.QueryRow(ctx, `SELECT (current_setting('server_version_num')::integer/10000)::text`).Scan(&major))
	assert(major == "17", "PG17 required; got "+ver)
	fmt.Println("PostgreSQL", ver)

	run := func(fn func(*pgxpool.Pool, string)) {
		pool, schema, done := fresh()
		defer done()
		apply(pool)
		exec(pool, `CREATE TABLE mil_city_origin (server_id int NOT NULL CHECK (server_id>0), city_id bigint NOT NULL CHECK (city_id>0), owner_player_id bigint NOT NULL CHECK (owner_player_id>0), cohort_id bytea NOT NULL CHECK (octet_length(cohort_id)=16), format_version smallint NOT NULL CHECK (format_version=1), created_at timestamptz NOT NULL, PRIMARY KEY (server_id,city_id))`)
		fn(pool, schema)
	}

	run(func(pool *pgxpool.Pool, schema string) {
		cmd := "a1111111-1111-4111-8111-111111111111"
		acct := seedAcctMap(pool)
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) { return intakeInitial(tx, acct, cmd) }), "intake commit")
		peer := poolInSchema(schema, 2)
		defer peer.Close()
		st, gotSha := cmdSnap(peer, cmd)
		assert(st == 1 && gotSha == strings.Repeat("ab", 32) && bizSum(peer) == 0, "pending")
		fmt.Println("PASS ack_loss: pending_intake_restart_readback_no_biz")
	})

	run(func(pool *pgxpool.Pool, schema string) {
		cmd := "a2222222-2222-4222-8222-222222222222"
		acct := seedAcctMap(pool)
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) {
			err := intakeAbortBeforeCommit(tx, acct, cmd)
			return err == nil, err
		}), "rollback")
		var n int
		must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&n))
		assert(n == 0, "no row")
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) { return intakeInitial(tx, acct, cmd) }), "intake")
		must(pool.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command WHERE command_id=$1::uuid`, cmd).Scan(&n))
		assert(n == 1 && bizSum(pool) == 0, "one pending")
		fmt.Println("PASS ack_loss: pre_commit_disconnect_no_partial_row")
	})

	run(func(pool *pgxpool.Pool, schema string) {
		cmd := "a3333333-3333-4333-8333-333333333333"
		acct := seedAcctMap(pool)
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) { return intakeInitial(tx, acct, cmd) }), "intake")
		peer := poolInSchema(schema, 2)
		defer peer.Close()
		st, _ := cmdSnap(peer, cmd)
		assert(st == 1 && !withConn(peer, func(tx pgx.Tx) (bool, error) { return intakeInitial(tx, acct, cmd) }), "one PENDING")
		dup := withConn(peer, func(tx pgx.Tx) (bool, error) {
			c1, fct1, sha := c1()
			_, err := tx.Exec(ctx, cmdIns, realm, cmd, acct, c1, fct1, sha)
			if err != nil {
				var pgErr *pgconn.PgError
				if errors.As(err, &pgErr) && pgErr.Code == "23505" {
					return false, tx.Rollback(ctx)
				}
				return false, err
			}
			return true, tx.Commit(ctx)
		})
		assert(!dup && bizSum(peer) == 0, "PK blocks duplicate")
		fmt.Println("PASS ack_loss: intake_commit_ack_loss_no_second_insert")
	})

	run(func(pool *pgxpool.Pool, schema string) {
		cmd := "a4444444-4444-4444-8444-444444444444"
		acct := seedAcctMap(pool)
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) { return intakeInitial(tx, acct, cmd) }), "intake")
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) { return effectCommit(tx, cmd) }), "effect commit")
		obs := poolInSchema(schema, 2)
		defer obs.Close()
		st, _ := cmdSnap(obs, cmd)
		assert(st == 2 && bizSum(obs) == 6, "one success + biz")
		assert(!withConn(obs, func(tx pgx.Tx) (bool, error) { return effectCommit(tx, cmd) }), "retry no double")
		fmt.Println("PASS ack_loss: effect_commit_ack_loss_observer_no_double")
	})

	run(func(pool *pgxpool.Pool, schema string) {
		cmdRej := "a5555555-5555-4555-8555-555555555555"
		acct := seedAcctMap(pool)
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) { return intakeInitial(tx, acct, cmdRej) }), "intake reject")
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) { return finalizerReject(tx, cmdRej) }), "finalizer reject")
		peer := poolInSchema(schema, 2)
		defer peer.Close()
		st, _ := cmdSnap(peer, cmdRej)
		assert(st == 3 && bizSum(peer) == 0, "reject persisted")
		assert(!withConn(peer, func(tx pgx.Tx) (bool, error) { return finalizerReject(tx, cmdRej) }), "reject stable")
		fmt.Println("PASS ack_loss: finalizer_reject_ack_loss_no_city")
	})

	run(func(pool *pgxpool.Pool, schema string) {
		cmdWin := "a6666666-6666-4666-8666-666666666666"
		acct := seedAcctMap(pool)
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) { return intakeInitial(tx, acct, cmdWin) }), "winner intake")
		assert(withConn(pool, func(tx pgx.Tx) (bool, error) { return effectCommit(tx, cmdWin) }), "winner effect")
		peer := poolInSchema(schema, 2)
		defer peer.Close()
		assert(!withConn(peer, func(tx pgx.Tx) (bool, error) { return effectCommit(tx, cmdWin) }), "competitor retry")
		assert(!withConn(peer, func(tx pgx.Tx) (bool, error) { return finalizerReject(tx, cmdWin) }), "finalizer blocked")
		assert(bizSum(peer) == 6, "one city bundle")
		fmt.Println("PASS ack_loss: competitor_ack_loss_no_double_success")
	})

	fmt.Println("MODE: isolated PG17 restart/ACK-loss; not WS/browser; player_city_id_seq not activated")
}
