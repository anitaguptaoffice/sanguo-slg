package api

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func bootstrapAccount(t *testing.T, p *pgxpool.Pool, name string) int64 {
	t.Helper()
	var id int64
	if err := p.QueryRow(context.Background(), `INSERT INTO account(login_name,password_hash) VALUES($1,'fixture') RETURNING account_id`, name).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func bootstrapCounts(t *testing.T, p *pgxpool.Pool, want int) {
	t.Helper()
	var players, wallets int
	if err := p.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM player),(SELECT count(*) FROM player_wallet)`).Scan(&players, &wallets); err != nil || players != want || wallets != want {
		t.Fatalf("players=%d wallets=%d want=%d: %v", players, wallets, want, err)
	}
}

func TestPlayerBootstrapConcurrentPG(t *testing.T) {
	p := walletBoundaryPool(t)
	store := &PlayerStore{Pool: p}
	const accounts = 12
	ids := make([]int64, accounts)
	for i := range ids {
		ids[i] = bootstrapAccount(t, p, fmt.Sprintf("concurrent-%d", i))
	}
	start := make(chan struct{})
	var wg sync.WaitGroup
	var mu sync.Mutex
	seen := map[[2]int64]int64{}
	for shard := int32(1); shard <= 2; shard++ {
		for _, accountID := range ids {
			for duplicate := 0; duplicate < 3; duplicate++ {
				wg.Add(1)
				go func(shard int32, accountID int64) {
					defer wg.Done()
					<-start
					id, err := store.EnsurePlayer(context.Background(), shard, accountID, "")
					if err != nil {
						t.Errorf("create shard=%d account=%d: %v", shard, accountID, err)
						return
					}
					mu.Lock()
					defer mu.Unlock()
					key := [2]int64{int64(shard), accountID}
					if prior, ok := seen[key]; ok && prior != id {
						t.Errorf("duplicate identity: %d != %d", prior, id)
					}
					seen[key] = id
				}(shard, accountID)
			}
		}
	}
	close(start)
	wg.Wait()
	bootstrapCounts(t, p, 2*accounts)
	var good int
	if err := p.QueryRow(context.Background(), `SELECT count(*) FROM player p JOIN player_wallet w USING(server_id,player_id)
		WHERE player_id BETWEEN 1001 AND 1012 AND display_name='Lord-'||player_id AND level=1 AND power=0
		AND last_login_at IS NULL AND created_at IS NOT NULL AND w.updated_at IS NOT NULL AND food=8000 AND wood=8000 AND iron=5000 AND stone=5000 AND gold=0`).Scan(&good); err != nil || good != 2*accounts || len(seen) != 2*accounts {
		t.Fatalf("initial fields/resources/IDs good=%d identities=%d: %v", good, len(seen), err)
	}
}

// A tracer observes completed real SQL; it never substitutes database behavior.
type bootstrapTrace struct {
	after func(*pgx.Conn, string, error)
}
type bootstrapTraceKey struct{}

func (tr bootstrapTrace) TraceQueryStart(ctx context.Context, _ *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	return context.WithValue(ctx, bootstrapTraceKey{}, d.SQL)
}
func (tr bootstrapTrace) TraceQueryEnd(ctx context.Context, c *pgx.Conn, d pgx.TraceQueryEndData) {
	tr.after(c, ctx.Value(bootstrapTraceKey{}).(string), d.Err)
}

func TestPlayerBootstrapRollbackAndRetryPG(t *testing.T) {
	for _, stage := range []string{"wallet-insert", "after-wallet", "commit", "cancel-before", "cancel-player", "cancel-wallet", "disconnect-player"} {
		t.Run(stage, func(t *testing.T) {
			p := walletBoundaryPool(t)
			accountID := bootstrapAccount(t, p, stage)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			if stage == "wallet-insert" || stage == "after-wallet" || stage == "commit" {
				recruitSQL(t, p, `CREATE FUNCTION reject_bootstrap() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'bootstrap test failure'; END $$`)
				trigger := map[string]string{
					"wallet-insert": `CREATE TRIGGER reject_bootstrap BEFORE INSERT ON player_wallet FOR EACH ROW EXECUTE FUNCTION reject_bootstrap()`,
					"after-wallet":  `CREATE TRIGGER reject_bootstrap AFTER INSERT ON player_wallet FOR EACH ROW EXECUTE FUNCTION reject_bootstrap()`,
					"commit":        `CREATE CONSTRAINT TRIGGER reject_bootstrap AFTER INSERT ON player_wallet DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_bootstrap()`,
				}[stage]
				recruitSQL(t, p, trigger)
			}
			observed := false
			cfg := p.Config().Copy()
			cfg.ConnConfig.Tracer = bootstrapTrace{after: func(c *pgx.Conn, q string, err error) {
				player := strings.Contains(q, "INSERT INTO player (")
				wallet := strings.Contains(q, "INSERT INTO player_wallet (")
				if err != nil || !(player || wallet) {
					return
				}
				// Neither staged row is visible from a different connection.
				bootstrapCounts(t, p, 0)
				if stage == "cancel-player" && player || stage == "cancel-wallet" && wallet {
					observed = true
					cancel()
				}
				if stage == "disconnect-player" && player {
					observed = true
					recruitSQL(t, p, `SELECT pg_terminate_backend($1)`, c.PgConn().PID())
				}
			}}
			observedPool, err := pgxpool.NewWithConfig(context.Background(), cfg)
			if err != nil {
				t.Fatal(err)
			}
			defer observedPool.Close()
			if stage == "cancel-before" {
				cancel()
			}
			id, err := (&PlayerStore{Pool: observedPool}).EnsurePlayer(ctx, 1, accountID, "test")
			if err == nil || id != 0 {
				t.Fatalf("failure accepted: id=%d err=%v", id, err)
			}
			if (stage == "cancel-player" || stage == "cancel-wallet" || stage == "disconnect-player") && !observed {
				t.Fatal("injection did not reach the intended boundary")
			}
			bootstrapCounts(t, p, 0)
			recruitSQL(t, p, `DROP TRIGGER IF EXISTS reject_bootstrap ON player_wallet`)
			for retry := 0; retry < 2; retry++ {
				id, err = (&PlayerStore{Pool: p}).EnsurePlayer(context.Background(), 1, accountID, "test")
				if err != nil || id != 1001 {
					t.Fatalf("retry=%d id=%d: %v", retry, id, err)
				}
			}
			bootstrapCounts(t, p, 1)
		})
	}
}

func TestPlayerBootstrapPreservesExistingPG(t *testing.T) {
	p := walletBoundaryPool(t)
	store := &PlayerStore{Pool: p}
	accountID := bootstrapAccount(t, p, "existing")
	recruitSQL(t, p, `INSERT INTO player(server_id,player_id,account_id,display_name,level,power,last_login_at,created_at)
		VALUES(1,42,$1,'unchanged',7,99,'2020-01-01 UTC','2019-01-01 UTC');`, accountID)
	recruitSQL(t, p, `INSERT INTO player_wallet VALUES(1,42,11,22,33,44,55,'2020-01-01 UTC'),(1,43,66,77,88,99,111,'2021-01-01 UTC')`)
	snapshot := func(table string) string {
		t.Helper()
		var value string
		if err := p.QueryRow(context.Background(), `SELECT jsonb_agg(t ORDER BY player_id)::text FROM `+table+` t`).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	players, wallets := snapshot("player"), snapshot("player_wallet")
	id, err := store.EnsurePlayer(context.Background(), 1, accountID, "replacement")
	if err != nil || id != 42 || players != snapshot("player") || wallets != snapshot("player_wallet") {
		t.Fatalf("existing state changed: %d %v", id, err)
	}
	otherAccount := bootstrapAccount(t, p, "orphan-conflict")
	id, err = store.EnsurePlayer(context.Background(), 1, otherAccount, "new")
	if err != nil || id != 43 || wallets != snapshot("player_wallet") {
		t.Fatalf("orphan wallet overwritten: %d %v", id, err)
	}
	recruitSQL(t, p, `DELETE FROM player_wallet WHERE player_id=42`)
	id, err = store.EnsurePlayer(context.Background(), 1, accountID, "legacy")
	var count int
	queryErr := p.QueryRow(context.Background(), `SELECT count(*) FROM player_wallet WHERE player_id=42`).Scan(&count)
	if err != nil || queryErr != nil || id != 42 || count != 0 {
		t.Fatalf("legacy missing wallet was repaired: id=%d wallets=%d %v %v", id, count, err, queryErr)
	}
	t.Log("Legacy missing wallet deliberately unchanged; diagnose separately, never mint on login.")
}

func TestPlayerBootstrapExhaustionPG(t *testing.T) {
	p := walletBoundaryPool(t)
	a := bootstrapAccount(t, p, "exhausted")
	b := bootstrapAccount(t, p, "new")
	recruitSQL(t, p, `INSERT INTO player(server_id,player_id,account_id,display_name) VALUES(1,9223372036854775807,$1,'last')`, a)
	id, err := (&PlayerStore{Pool: p}).EnsurePlayer(context.Background(), 1, b, "no-fallback")
	var players, wallets int
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "22003" {
		t.Fatalf("expected bigint exhaustion, got %v", err)
	}
	queryErr := p.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM player),(SELECT count(*) FROM player_wallet)`).Scan(&players, &wallets)
	if err == nil || id != 0 || queryErr != nil || players != 1 || wallets != 0 {
		t.Fatalf("ID exhaustion: id=%d players=%d wallets=%d err=%v query=%v", id, players, wallets, err, queryErr)
	}
}

func TestPlayerBootstrapLockScopePG(t *testing.T) {
	p := walletBoundaryPool(t)
	store := &PlayerStore{Pool: p}
	a := bootstrapAccount(t, p, "lock")
	existing, err := store.EnsurePlayer(context.Background(), 1, a, "existing")
	if err != nil {
		t.Fatal(err)
	}
	b := bootstrapAccount(t, p, "waiting")
	tx, err := p.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer func(rollback func(context.Context) error, ctx context.Context) {
		_ = rollback(ctx)
	}(tx.Rollback, context.Background())
	if _, err := tx.Exec(context.Background(), `SELECT pg_advisory_xact_lock($1::integer,$2::integer)`, playerCreationLockNamespace, int32(1)); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { _, err := store.EnsurePlayer(ctx, 1, b, "wait"); done <- err }()
	waiters := func(want int) {
		t.Helper()
		deadline := time.Now().Add(5 * time.Second)
		for {
			var waiting int
			if err := p.QueryRow(context.Background(), `SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND classid=$1::oid AND objid=1 AND NOT granted`, playerCreationLockNamespace).Scan(&waiting); err != nil {
				t.Fatal(err)
			}
			if waiting == want {
				return
			}
			if time.Now().After(deadline) {
				t.Fatal("creators never waited on shard lock")
			}
			time.Sleep(time.Millisecond)
		}
	}
	waiters(1)
	bounded, stop := context.WithTimeout(context.Background(), 2*time.Second)
	defer stop()
	if id, err := store.EnsurePlayer(bounded, 1, a, "ignore"); err != nil || id != existing {
		t.Fatalf("existing fast path blocked: %d %v", id, err)
	}
	if id, err := store.EnsurePlayer(bounded, 2, b, "other shard"); err != nil || id != 1001 {
		t.Fatalf("other shard blocked: %d %v", id, err)
	}
	cancel()
	if err := <-done; err == nil {
		t.Fatal("canceled lock waiter succeeded")
	}
	bootstrapCounts(t, p, 2)
	// Force two requests past their fast read before either can create b.
	results := make(chan int64, 2)
	for i := 0; i < 2; i++ {
		go func() {
			id, err := store.EnsurePlayer(context.Background(), 1, b, "dedupe")
			if err != nil {
				t.Errorf("locked recheck: %v", err)
			}
			results <- id
		}()
	}
	waiters(2)
	if err := tx.Rollback(context.Background()); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if id := <-results; id != existing+1 {
			t.Fatalf("locked recheck ID=%d want=%d", id, existing+1)
		}
	}
	bootstrapCounts(t, p, 3)
}
