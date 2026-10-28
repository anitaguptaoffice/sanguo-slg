package account

import (
	"bytes"
	"context"
	"fmt"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"sync"
	"testing"
	"time"
)

func actorGuardFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, *RecruitActorGuard) {
	t.Helper()
	pool, b, p := actorIndexFixture(t)
	actorSQL(t, pool, `INSERT INTO account(account_id,login_name,password_hash,status) OVERRIDING SYSTEM VALUE
 VALUES (1,'one','h',1),(2,'two','h',2),(3,'three','h',1),(4,'four','h',1);
 INSERT INTO player(server_id,player_id,account_id,display_name) VALUES
 (1,10,1,'p10'),(1,11,2,'p11'),(1,12,3,'p12'),(2,10,1,'shard'),(2,13,3,'other shard')`)
	o, a, ctx := actorOwner(t, b)
	g, err := NewRecruitActorGuard(ctx, b, a, p)
	actorOK(t, err)
	actorOK(t, o.Rollback(ctx))
	return pool, b, g
}
func TestPGRecruitActorGuardConstructorDrift(t *testing.T) {
	for name, ddl := range map[string]string{
		"table":       "ALTER TABLE account ADD COLUMN surprise integer",
		"foreign key": "ALTER TABLE player DROP CONSTRAINT player_account_id_fkey",
		"trigger":     "CREATE FUNCTION surprise() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$; CREATE TRIGGER surprise BEFORE INSERT ON player FOR EACH ROW EXECUTE FUNCTION surprise()",
		"dependency":  "CREATE TABLE surprise(id bigint DEFAULT nextval('account_account_id_seq'))",
	} {
		t.Run(name, func(t *testing.T) {
			pool, b, p := actorIndexFixture(t)
			actorSQL(t, pool, ddl)
			o, a, ctx := actorOwner(t, b)
			if g, err := NewRecruitActorGuard(ctx, b, a, p); err == nil || g != nil {
				t.Fatal("source drift accepted")
			}
			actorOK(t, o.Rollback(ctx))
		})
	}
}
func TestPGRecruitActorGuardConstructorIdentity(t *testing.T) {
	pool, b, p := actorIndexFixture(t)
	o, a, ctx := actorOwner(t, b)
	for _, owner := range []bool{false, true} {
		bad, _ := freshsource.Snapshot(p)
		v := bad.Objects["account"]
		if owner {
			v.OwnerOID++
		} else {
			v.OID++
		}
		bad.Objects["account"] = v
		if g, err := NewRecruitActorGuard(ctx, b, a, bad); err == nil || g != nil {
			t.Fatal("wrong expectation accepted")
		}
	}
	actorOK(t, o.Rollback(ctx))
	wrong, _ := recruittx.NewBinding(pool)
	_, foreign, fctx := actorOwner(t, wrong)
	if g, err := NewRecruitActorGuard(fctx, b, foreign, p); err == nil || g != nil {
		t.Fatal("mixed binding accepted")
	}
	if g, err := NewRecruitActorGuard(ctx, b, a, p); err == nil || g != nil {
		t.Fatal("ended access accepted")
	}
}
func TestPGRecruitActorGuardPrivilege(t *testing.T) {
	pool, b, p := actorIndexFixture(t)
	role := fmt.Sprintf("guard_priv_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{role}.Sanitize()
	actorSQL(t, pool, "CREATE ROLE "+quoted)
	actorSQL(t, pool, "GRANT USAGE ON SCHEMA "+pgx.Identifier{p.SchemaName}.Sanitize()+" TO "+quoted)
	actorSQL(t, pool, "GRANT SELECT ON account, player TO "+quoted)
	o, a, ctx := actorOwner(t, b)
	_, err := a.Exec(ctx, b, "SET LOCAL ROLE "+quoted)
	actorOK(t, err)
	var oid uint32
	actorOK(t, a.Scan(ctx, b, "SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user", nil, &oid))
	bad := p
	bad.CurrentRoleName, bad.CurrentRoleOID = role, oid
	if g, err := NewRecruitActorGuard(ctx, b, a, bad); err == nil || g != nil {
		t.Fatal("missing player UPDATE accepted")
	}
	actorOK(t, o.Rollback(ctx))
}
func TestPGRecruitActorGuardPin(t *testing.T) {
	pool, b, g := actorGuardFixture(t)
	o, a, ctx := actorOwner(t, b)
	var pid int
	actorOK(t, a.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &pid))
	bo, block, bctx := actorOwner(t, b)
	_, err := block.Exec(bctx, b, "LOCK TABLE "+pgx.Identifier{g.s.profile.SchemaName, "player"}.Sanitize()+" IN ACCESS EXCLUSIVE MODE")
	actorOK(t, err)
	done := make(chan error, 1)
	go func() { done <- g.Pin(ctx, a) }()
	var pinned bool
	for deadline := time.Now().Add(5 * time.Second); !pinned && time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		actorOK(t, pool.QueryRow(ctx, `SELECT EXISTS(SELECT FROM pg_catalog.pg_locks
 WHERE pid=$1 AND relation=$2 AND mode='RowShareLock' AND granted)`, pid, g.s.profile.Objects["account"].OID).Scan(&pinned))
	}
	if !pinned {
		t.Fatal("account pin was not acquired first")
	}
	actorOK(t, bo.Rollback(bctx))
	if err = <-done; err != nil {
		t.Fatal("pin after release", err)
	}
	var accountPins, playerPins, sessionPins int
	actorOK(t, a.Scan(ctx, b, `SELECT
 count(*) FILTER (WHERE relation=$1 AND mode='RowShareLock'),
 count(*) FILTER (WHERE relation=$2 AND mode='RowShareLock'),
 count(*) FILTER (WHERE relation=$3)
 FROM pg_catalog.pg_locks WHERE pid=pg_catalog.pg_backend_pid() AND granted`,
		[]any{g.s.profile.Objects["account"].OID, g.s.profile.Objects["player"].OID, g.s.profile.Objects["account_session"].OID},
		&accountPins, &playerPins, &sessionPins))
	if accountPins != 1 || playerPins != 1 || sessionPins != 0 {
		t.Fatal("unexpected pins", accountPins, playerPins, sessionPins)
	}
	copied := *g
	actorOK(t, o.Rollback(ctx))
	actorSQL(t, pool, "CREATE INDEX guard_drift ON player(power)")
	_, a, ctx = actorOwner(t, b)
	if g.Pin(ctx, a) == nil || !g.s.retired.Load() || copied.Pin(ctx, a) == nil {
		t.Fatal("source drift or copy retirement")
	}
}
func TestPGRecruitActorGuardLock(t *testing.T) {
	_, b, g := actorGuardFixture(t)
	o, a, ctx := actorOwner(t, b)
	actorOK(t, g.Pin(ctx, a))
	const snapshot = `SELECT pg_catalog.jsonb_build_array(
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY account_id) FROM account x),
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY server_id,player_id) FROM player x))`
	var before, after []byte
	actorOK(t, a.Scan(ctx, b, snapshot, nil, &before))
	for _, tc := range []struct{ account, player int64 }{
		{0, 10}, {-1, 10}, {1, 0}, {1, -1}, {9, 10}, {2, 11}, {1, 12}, {1, 13}, {1, 999},
	} {
		if g.Lock(ctx, a, tc.account, tc.player) == nil {
			t.Fatalf("invalid actor pair admitted: %+v", tc)
		}
	}
	actorOK(t, g.Lock(ctx, a, 1, 10))
	actorOK(t, a.Scan(ctx, b, snapshot, nil, &after))
	if !bytes.Equal(before, after) {
		t.Fatal("lock mutated actor rows")
	}
	actorOK(t, o.Rollback(ctx))
	if g.Lock(ctx, a, 1, 10) == nil {
		t.Fatal("ended transaction lock")
	}
	_, next, nctx := actorOwner(t, b)
	if g.Lock(nctx, next, 1, 10) == nil {
		t.Fatal("pin reused across transactions")
	}
	actorOK(t, g.Pin(nctx, next))
	actorOK(t, g.Lock(nctx, next, 1, 10))
}
func TestPGRecruitActorGuardLockBlocksWriters(t *testing.T) {
	for _, tc := range []struct {
		name, update, check string
		want                int64
	}{
		{"status", "UPDATE account SET status=2 WHERE account_id=1", "SELECT status FROM account WHERE account_id=1", 2},
		{"reassignment", "UPDATE player SET account_id=4 WHERE server_id=1 AND player_id=10", "SELECT account_id FROM player WHERE server_id=1 AND player_id=10", 4},
	} {
		for _, commit := range []bool{true, false} {
			t.Run(fmt.Sprintf("%s/%t", tc.name, commit), func(t *testing.T) {
				pool, b, g := actorGuardFixture(t)
				o, a, ctx := actorOwner(t, b)
				actorOK(t, g.Pin(ctx, a))
				actorOK(t, g.Lock(ctx, a, 1, 10))
				run, cancel := context.WithCancel(ctx)
				conn, err := pool.Acquire(run)
				actorOK(t, err)
				pid := conn.Conn().PgConn().PID()
				done := make(chan error, 1)
				var wg sync.WaitGroup
				wg.Add(1)
				go func() { defer wg.Done(); _, err := conn.Exec(run, tc.update); done <- err }()
				defer func() { cancel(); wg.Wait(); conn.Release() }()
				var waiting bool
				for deadline := time.Now().Add(5 * time.Second); !waiting && time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
					actorOK(t, pool.QueryRow(run, `SELECT EXISTS(SELECT FROM pg_catalog.pg_locks WHERE pid=$1 AND NOT granted)`, pid).Scan(&waiting))
				}
				if !waiting {
					t.Fatal("writer was not blocked")
				}
				if commit {
					err = o.Commit(ctx)
				} else {
					err = o.Rollback(ctx)
				}
				actorOK(t, err)
				actorOK(t, <-done)
				var got int64
				actorOK(t, pool.QueryRow(context.Background(), tc.check).Scan(&got))
				if got != tc.want {
					t.Fatal("writer result", got)
				}
			})
		}
	}
}
