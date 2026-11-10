package account

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func freshGuardFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, *ActorGuard) {
	t.Helper()
	pool, b, p := actorIndexFixture(t)
	actorSQL(t, pool, `INSERT INTO account(account_id,login_name,password_hash,status) OVERRIDING SYSTEM VALUE
 VALUES (1,'one','fixture',1),(2,'two','fixture',2),(3,'three','fixture',1),(4,'four','fixture',1);
 INSERT INTO player(server_id,player_id,account_id,display_name) VALUES
 (1,10,1,'p10'),(1,11,2,'p11'),(1,12,3,'p12'),(2,13,1,'other shard')`)
	o, a, ctx := actorOwner(t, b)
	g, err := NewActorGuard(ctx, b, a, p)
	actorOK(t, err)
	// A later caller mutation must not change source identity or captured shard.
	p.ServerID = 2
	delete(p.Objects, "player")
	actorOK(t, o.Rollback(ctx))
	return pool, b, g
}

func TestPGFreshActorGuardConstruction(t *testing.T) {
	pool, b, p := actorIndexFixture(t)
	o, a, ctx := actorOwner(t, b)
	for name, change := range map[string]func(*freshsource.Profile){
		"missing":   func(p *freshsource.Profile) { delete(p.Objects, "player") },
		"extra":     func(p *freshsource.Profile) { p.Objects["extra"] = p.Objects["player"] },
		"duplicate": func(p *freshsource.Profile) { p.Objects["player"] = p.Objects["account"] },
		"database":  func(p *freshsource.Profile) { p.DatabaseOID++ },
		"owner": func(p *freshsource.Profile) {
			id := p.Objects["account"]
			id.OwnerOID++
			p.Objects["account"] = id
		},
		"shard": func(p *freshsource.Profile) { p.ServerID = 0 },
	} {
		t.Run(name, func(t *testing.T) {
			bad, err := freshsource.Snapshot(p)
			actorOK(t, err)
			change(&bad)
			if g, err := NewActorGuard(ctx, b, a, bad); err == nil || g != nil {
				t.Fatal("invalid source accepted")
			}
		})
	}
	wrong, err := recruittx.NewBinding(pool)
	actorOK(t, err)
	if g, err := NewActorGuard(ctx, wrong, a, p); err == nil || g != nil {
		t.Fatal("wrong binding accepted")
	}
	actorOK(t, o.Rollback(ctx))
	if g, err := NewActorGuard(ctx, b, a, p); err == nil || g != nil {
		t.Fatal("ended access accepted")
	}
	actorSQL(t, pool, "ALTER TABLE account ADD COLUMN unexpected integer")
	_, a, ctx = actorOwner(t, b)
	if g, err := NewActorGuard(ctx, b, a, p); err == nil || g != nil {
		t.Fatal("catalog drift accepted")
	}
}

func TestPGFreshActorGuardScopeAndLifetime(t *testing.T) {
	pool, b, g := freshGuardFixture(t)
	o, a, ctx := actorOwner(t, b)
	if g.LockActor(ctx, a, 1, 10) == nil {
		t.Fatal("unpinned actor accepted")
	}
	actorOK(t, g.Pin(ctx, a))
	const snapshot = `SELECT pg_catalog.jsonb_build_array(
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY account_id) FROM account x),
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY server_id,player_id) FROM player x),
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY session_id) FROM account_session x),
 (SELECT pg_catalog.jsonb_build_array(last_value,log_cnt,is_called) FROM account_account_id_seq),
 current_setting('search_path'),current_setting('TimeZone'),current_setting('DateStyle'))`
	var before, after []byte
	actorOK(t, a.Scan(ctx, b, snapshot, nil, &before))
	for _, pair := range [][2]int64{{0, 10}, {-1, 10}, {1, 0}, {1, -1}, {9, 10}, {2, 11}, {1, 12}, {1, 13}, {1, 99}} {
		if g.LockActor(ctx, a, pair[0], pair[1]) == nil {
			t.Fatal("invalid actor accepted", pair)
		}
	}
	actorOK(t, g.LockActor(ctx, a, 1, 10))
	actorOK(t, a.Scan(ctx, b, snapshot, nil, &after))
	if !bytes.Equal(before, after) {
		t.Fatal("guard changed rows, sequence or settings")
	}
	_, other, otherCtx := actorOwner(t, b)
	copyGuard := *g
	actorOK(t, copyGuard.Pin(otherCtx, other))
	actorOK(t, copyGuard.LockActor(otherCtx, other, 1, 10))
	wrong, err := recruittx.NewBinding(pool)
	actorOK(t, err)
	_, foreign, foreignCtx := actorOwner(t, wrong)
	if g.Pin(foreignCtx, foreign) == nil || g.LockActor(foreignCtx, foreign, 1, 10) == nil {
		t.Fatal("foreign access accepted")
	}
	actorOK(t, o.Rollback(ctx))
	if g.Pin(ctx, a) == nil || g.LockActor(ctx, a, 1, 10) == nil {
		t.Fatal("ended access accepted")
	}
	canceled, cancel := context.WithCancel(otherCtx)
	cancel()
	if g.Pin(canceled, other) == nil || g.LockActor(canceled, other, 1, 10) == nil {
		t.Fatal("canceled access accepted")
	}
}

func TestPGFreshActorGuardPinOrderAndRetirement(t *testing.T) {
	pool, b, g := freshGuardFixture(t)
	profile := g.guard.s.profile
	o, a, ctx := actorOwner(t, b)
	var pid int
	actorOK(t, a.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &pid))
	blockOwner, block, blockCtx := actorOwner(t, b)
	_, err := block.Exec(blockCtx, b, "LOCK TABLE "+pgx.Identifier{profile.SchemaName, "player"}.Sanitize()+" IN ACCESS EXCLUSIVE MODE")
	actorOK(t, err)
	done := make(chan error, 1)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() { defer wg.Done(); done <- g.Pin(ctx, a) }()
	defer func() { _ = blockOwner.Rollback(blockCtx); wg.Wait() }()
	var ordered bool
	for deadline := time.Now().Add(5 * time.Second); !ordered && time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		actorOK(t, pool.QueryRow(ctx, `SELECT
 EXISTS(SELECT FROM pg_catalog.pg_locks WHERE pid=$1 AND relation=$2 AND mode='RowShareLock' AND granted)
 AND EXISTS(SELECT FROM pg_catalog.pg_locks WHERE pid=$1 AND relation=$3 AND mode='RowShareLock' AND NOT granted)`,
			pid, profile.Objects["account"].OID, profile.Objects["player"].OID).Scan(&ordered))
	}
	if !ordered {
		t.Fatal("account pin must precede blocked player pin")
	}
	actorOK(t, blockOwner.Rollback(blockCtx))
	actorOK(t, <-done)
	actorOK(t, o.Rollback(ctx))
	copyGuard := *g
	actorSQL(t, pool, "CREATE INDEX fresh_guard_drift ON player(power)")
	end, next, nextCtx := actorOwner(t, b)
	if g.Pin(nextCtx, next) == nil || copyGuard.Pin(nextCtx, next) == nil {
		t.Fatal("source drift accepted")
	}
	actorOK(t, end.Rollback(nextCtx))
	actorSQL(t, pool, "DROP INDEX fresh_guard_drift")
	_, next, nextCtx = actorOwner(t, b)
	if g.Pin(nextCtx, next) == nil || copyGuard.Pin(nextCtx, next) == nil || copyGuard.LockActor(nextCtx, next, 1, 10) == nil {
		t.Fatal("retired guard revived after source restoration")
	}
}

func TestPGFreshActorGuardAccountBeforePlayer(t *testing.T) {
	pool, b, g := freshGuardFixture(t)
	o, a, ctx := actorOwner(t, b)
	actorOK(t, g.Pin(ctx, a))
	var pid, blockerPID int
	actorOK(t, a.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &pid))
	blockOwner, block, blockCtx := actorOwner(t, b)
	actorOK(t, block.Scan(blockCtx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &blockerPID))
	_, err := block.Exec(blockCtx, b, "UPDATE player SET display_name='blocked' WHERE server_id=1 AND player_id=10")
	actorOK(t, err)
	var wg sync.WaitGroup
	wg.Add(1)
	done := make(chan error, 1)
	go func() { defer wg.Done(); done <- g.LockActor(ctx, a, 1, 10) }()
	defer func() { _ = blockOwner.Rollback(blockCtx); wg.Wait() }()
	var blocked bool
	for deadline := time.Now().Add(5 * time.Second); !blocked && time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		actorOK(t, pool.QueryRow(ctx, "SELECT $1=ANY(pg_catalog.pg_blocking_pids($2))", blockerPID, pid).Scan(&blocked))
	}
	if !blocked {
		t.Fatal("guard did not wait for player row")
	}
	probeOwner, probe, probeCtx := actorOwner(t, b)
	_, err = probe.Exec(probeCtx, b, "SELECT account_id FROM account WHERE account_id=1 FOR UPDATE NOWAIT")
	var pgerr *pgconn.PgError
	if !errors.As(err, &pgerr) || pgerr.Code != "55P03" {
		t.Fatal("account was not locked before the blocked player", err)
	}
	actorOK(t, probeOwner.Rollback(probeCtx))
	actorOK(t, blockOwner.Rollback(blockCtx))
	actorOK(t, <-done)
	actorOK(t, o.Rollback(ctx))
}

func TestPGFreshActorGuardBlocksWriters(t *testing.T) {
	for _, target := range []struct {
		name, update, query string
		want                int64
	}{
		{"status", "UPDATE account SET status=2 WHERE account_id=1", "SELECT status::bigint FROM account WHERE account_id=1", 2},
		{"owner", "UPDATE player SET account_id=4 WHERE server_id=1 AND player_id=10", "SELECT account_id FROM player WHERE server_id=1 AND player_id=10", 4},
	} {
		for _, commit := range []bool{true, false} {
			t.Run(fmt.Sprintf("%s/%t", target.name, commit), func(t *testing.T) {
				pool, b, g := freshGuardFixture(t)
				o, a, ctx := actorOwner(t, b)
				actorOK(t, g.Pin(ctx, a))
				actorOK(t, g.LockActor(ctx, a, 1, 10))
				var ownerPID int
				actorOK(t, a.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &ownerPID))
				writer, err := pool.Acquire(ctx)
				actorOK(t, err)
				writerPID := writer.Conn().PgConn().PID()
				run, cancel := context.WithCancel(ctx)
				done := make(chan error, 1)
				var wg sync.WaitGroup
				wg.Add(1)
				go func() { defer wg.Done(); _, err := writer.Exec(run, target.update); done <- err }()
				defer func() { cancel(); wg.Wait(); writer.Release() }()
				var blocked bool
				for deadline := time.Now().Add(5 * time.Second); !blocked && time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
					actorOK(t, pool.QueryRow(ctx, "SELECT $1=ANY(pg_catalog.pg_blocking_pids($2))", ownerPID, writerPID).Scan(&blocked))
				}
				if !blocked {
					t.Fatal("writer not blocked by guard transaction")
				}
				if commit {
					err = o.Commit(ctx)
				} else {
					err = o.Rollback(ctx)
				}
				actorOK(t, err)
				actorOK(t, <-done)
				var got int64
				actorOK(t, pool.QueryRow(ctx, target.query).Scan(&got))
				if got != target.want {
					t.Fatal("writer did not complete after transaction end", got)
				}
			})
		}
	}
}
