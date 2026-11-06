package account

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

func actorHintWant(t *testing.T, g *RecruitActorGuard, ctx context.Context, a *recruittx.Access, player, want int64) {
	t.Helper()
	id, err := g.AccountHint(ctx, a, player)
	if err != nil || id != want {
		t.Fatalf("player %d: hint=%d want=%d error=%v", player, id, want, err)
	}
}
func actorHintReject(t *testing.T, g *RecruitActorGuard, ctx context.Context, a *recruittx.Access, player int64) error {
	t.Helper()
	id, err := g.AccountHint(ctx, a, player)
	if err == nil || id != 0 {
		t.Fatal("unusable hint returned", id, err)
	}
	return err
}

func TestPGRecruitActorHintReadOnlyScopeAndIDs(t *testing.T) {
	pool, b, g := actorGuardFixture(t)
	actorSQL(t, pool, `INSERT INTO account(account_id,login_name,password_hash) OVERRIDING SYSTEM VALUE
 VALUES(0,'zero','h'),(-1,'negative','h'),(9223372036854775807,'max','h');
 INSERT INTO player(server_id,player_id,account_id,display_name) VALUES
 (1,14,0,'zero'),(1,15,-1,'negative'),(1,9223372036854775807,9223372036854775807,'max');
 INSERT INTO account_session(account_id,expires_at) VALUES(1,'2030-01-01T00:00:00Z')`)
	o, a, ctx := actorOwner(t, b)
	_, err := a.Exec(ctx, b, "SET TRANSACTION READ ONLY")
	actorOK(t, err)
	actorOK(t, g.Pin(ctx, a))
	const snapshot = `SELECT pg_catalog.jsonb_build_array(
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY account_id) FROM account x),
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY server_id,player_id) FROM player x),
 (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY session_id) FROM account_session x),
 (SELECT pg_catalog.to_jsonb(x) FROM account_account_id_seq x),
 pg_catalog.current_setting('search_path'),pg_catalog.current_setting('TimeZone'),pg_catalog.current_setting('DateStyle'),pg_catalog.current_setting('transaction_read_only'))`
	var before, after []byte
	actorOK(t, a.Scan(ctx, b, snapshot, nil, &before))
	for player, want := range map[int64]int64{10: 1, 11: 2, 12: 3, 9223372036854775807: 9223372036854775807} {
		actorHintWant(t, g, ctx, a, player, want)
	}
	for _, player := range []int64{0, -1, 13, 14, 15, 999} {
		_ = actorHintReject(t, g, ctx, a, player)
	}
	if g.s.retired.Load() {
		t.Fatal("business absence or illegal identity retired source")
	}
	actorOK(t, a.Scan(ctx, b, snapshot, nil, &after))
	if !bytes.Equal(before, after) {
		t.Fatal("hint changed data, sequence or settings")
	}
	actorOK(t, o.Rollback(ctx))
	_, a, ctx = actorOwner(t, b)
	actorOK(t, g.Pin(ctx, a))
	actorHintWant(t, g, ctx, a, 11, 2)
	if err = g.Lock(ctx, a, 2, 11); !errors.Is(err, ErrRecruitActorGuard) || g.s.retired.Load() {
		t.Fatal("discovery bypassed banned-account authorization", err)
	}
}

func TestPGRecruitActorHintPinsBindingAndLifetime(t *testing.T) {
	pool, b, g := actorGuardFixture(t)
	o, a, ctx := actorOwner(t, b)
	_ = actorHintReject(t, g, ctx, a, 10)
	_, err := a.Exec(ctx, b, "LOCK TABLE "+pgx.Identifier{g.s.profile.SchemaName, "player"}.Sanitize()+" IN ROW SHARE MODE")
	actorOK(t, err)
	_ = actorHintReject(t, g, ctx, a, 10)
	actorOK(t, g.Pin(ctx, a))
	copyAccess := *a
	actorHintWant(t, g, ctx, &copyAccess, 10, 1)
	_, otherBinding, _ := actorGuardFixture(t)
	samePool, err := recruittx.NewBinding(pool)
	actorOK(t, err)
	for _, p := range []*recruittx.Binding{samePool, otherBinding} {
		wo, wa, wc := actorOwner(t, p)
		if err = actorHintReject(t, g, wc, wa, 10); !errors.Is(err, recruittx.ErrBinding) {
			t.Fatal("wrong binding error", err)
		}
		actorOK(t, wo.Rollback(wc))
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if err = actorHintReject(t, g, canceled, a, 10); !errors.Is(err, context.Canceled) {
		t.Fatal("cancellation cause lost", err)
	}
	actorHintWant(t, g, ctx, a, 10, 1)
	actorOK(t, o.Rollback(ctx))
	for _, ended := range []*recruittx.Access{a, &copyAccess} {
		if err = actorHintReject(t, g, ctx, ended, 10); !errors.Is(err, recruittx.ErrInactive) && !errors.Is(err, context.Canceled) {
			t.Fatal("ended access error", err)
		}
	}
	if g.s.retired.Load() {
		t.Fatal("pins, binding, cancellation or lifetime failure retired source")
	}
	_, next, nctx := actorOwner(t, b)
	actorOK(t, g.Pin(nctx, next))
	actorHintWant(t, g, nctx, next, 10, 1)
}

func TestPGRecruitActorHintCapturedShard(t *testing.T) {
	_, b, g := actorGuardFixture(t)
	_, a, ctx := actorOwner(t, b)
	p, err := freshsource.Snapshot(g.s.profile)
	actorOK(t, err)
	p.ServerID = 2
	other, err := NewRecruitActorGuard(ctx, b, a, p)
	actorOK(t, err)
	p.ServerID = 1
	p.Objects["player"] = p.Objects["account"] // Constructor must own its snapshot.
	actorOK(t, other.Pin(ctx, a))
	_, err = a.Exec(ctx, b, "SET LOCAL search_path=pg_catalog")
	actorOK(t, err)
	actorHintWant(t, other, ctx, a, 13, 3)
	_ = actorHintReject(t, other, ctx, a, 12)
}

func TestPGRecruitActorHintSourceDriftRetiresCopies(t *testing.T) {
	for name, sql := range map[string]string{
		"table":    "ALTER TABLE player ADD COLUMN surprise integer",
		"identity": "DROP INDEX idx_player_account; CREATE INDEX idx_player_account ON player(account_id)",
		"settings": "SET LOCAL DateStyle='SQL, DMY'",
	} {
		t.Run(name, func(t *testing.T) {
			pool, b, g := actorGuardFixture(t)
			copyGuard := *g
			if name != "settings" {
				actorSQL(t, pool, sql)
			}
			_, a, ctx := actorOwner(t, b)
			_, err := a.Exec(ctx, b, "LOCK TABLE "+pgx.Identifier{g.s.profile.SchemaName, "account"}.Sanitize()+", "+pgx.Identifier{g.s.profile.SchemaName, "player"}.Sanitize()+" IN ROW SHARE MODE")
			actorOK(t, err)
			if name == "settings" {
				_, err = a.Exec(ctx, b, sql)
				actorOK(t, err)
			}
			_ = actorHintReject(t, g, ctx, a, 10)
			if !g.s.retired.Load() {
				t.Fatal("definite drift did not retire source")
			}
			if err = actorHintReject(t, &copyGuard, ctx, a, 10); !errors.Is(err, ErrRecruitActorGuard) {
				t.Fatal("copied guard escaped retirement", err)
			}
		})
	}
}

func TestPGRecruitActorHintReassignmentRequiresRestart(t *testing.T) {
	pool, b, g := actorGuardFixture(t)
	o, a, ctx := actorOwner(t, b)
	actorOK(t, g.Pin(ctx, a))
	actorHintWant(t, g, ctx, a, 10, 1)
	var hintPID, writerPID int
	actorOK(t, a.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &hintPID))
	writer, err := pool.Acquire(ctx)
	actorOK(t, err)
	defer writer.Release()
	short, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	actorOK(t, writer.QueryRow(short, "SELECT pg_catalog.pg_backend_pid()").Scan(&writerPID))
	if writerPID == hintPID {
		t.Fatal("reassignment did not use independent connection")
	}
	// Auto-commit must finish while the hint transaction remains open.
	tag, err := writer.Exec(short, "UPDATE player SET account_id=4 WHERE server_id=1 AND player_id=10")
	actorOK(t, err)
	if tag.RowsAffected() != 1 {
		t.Fatal("reassignment did not commit one row")
	}
	if err = g.Lock(ctx, a, 1, 10); !errors.Is(err, ErrRecruitActorGuard) {
		t.Fatal("stale association authorized", err)
	}
	actorOK(t, o.Rollback(ctx))
	_, fresh, fctx := actorOwner(t, b)
	actorOK(t, g.Pin(fctx, fresh))
	actorHintWant(t, g, fctx, fresh, 10, 4)
	actorOK(t, g.Lock(fctx, fresh, 4, 10))
	t.Logf("hint PID %d, independently committed reassignment PID %d; stale rejected, fresh locked", hintPID, writerPID)
}

func TestPGRecruitActorHintLockAccountBeforePlayer(t *testing.T) {
	pool, b, g := actorGuardFixture(t)
	_, a, ctx := actorOwner(t, b)
	actorOK(t, g.Pin(ctx, a))
	actorHintWant(t, g, ctx, a, 10, 1)
	accountOwner, account, ac := actorOwner(t, b)
	playerOwner, player, pc := actorOwner(t, b)
	var ignored, actorPID, accountPID, playerPID int
	actorOK(t, account.Scan(ac, b, "SELECT account_id FROM account WHERE account_id=1 FOR UPDATE", nil, &ignored))
	actorOK(t, player.Scan(pc, b, "SELECT player_id FROM player WHERE server_id=1 AND player_id=10 FOR UPDATE", nil, &ignored))
	actorOK(t, a.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &actorPID))
	actorOK(t, account.Scan(ac, b, "SELECT pg_catalog.pg_backend_pid()", nil, &accountPID))
	actorOK(t, player.Scan(pc, b, "SELECT pg_catalog.pg_backend_pid()", nil, &playerPID))
	run, cancel := context.WithCancel(ctx)
	done, exited := make(chan error, 1), make(chan struct{})
	go func() { defer close(exited); done <- g.Lock(run, a, 1, 10) }()
	defer func() { cancel(); <-exited }()
	waitFor := func(blocker int) {
		t.Helper()
		for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
			var waiting bool
			actorOK(t, pool.QueryRow(ctx, "SELECT $1::pg_catalog.int4 = ANY(pg_catalog.pg_blocking_pids($2))", blocker, actorPID).Scan(&waiting))
			if waiting {
				t.Logf("actor PID %d observed waiting for PID %d", actorPID, blocker)
				return
			}
		}
		t.Fatalf("actor did not wait for expected blocker %d", blocker)
	}
	waitFor(accountPID)
	actorOK(t, accountOwner.Rollback(ac))
	waitFor(playerPID)
	actorOK(t, playerOwner.Rollback(pc))
	actorOK(t, <-done)
}
