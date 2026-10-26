package content

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

// Real SQL remains in use. Interleave an independent legacy writer precisely
// after MAX is read; no mocked uniqueness errors or transaction replay.
type itemGrantInterleaveTx struct {
	pgx.Tx
	afterMax func(int64)
	attempts int
}

type itemGrantInterleaveRow struct {
	pgx.Row
	after func(int64)
}

func (r itemGrantInterleaveRow) Scan(dest ...any) error {
	if err := r.Row.Scan(dest...); err != nil {
		return err
	}
	r.after(*dest[0].(*int64))
	return nil
}

func (tx *itemGrantInterleaveTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	row := tx.Tx.QueryRow(ctx, sql, args...)
	if !strings.HasPrefix(sql, "SELECT GREATEST") {
		return row
	}
	return itemGrantInterleaveRow{row, func(high int64) { tx.attempts++; tx.afterMax(high) }}
}

func TestPGItemGrantIdentityReservationCollisions(t *testing.T) {
	for _, kind := range []string{"legacy grant PK", "GM PK", "simultaneous PK and key", "bounded contention", "exhausted"} {
		t.Run(kind, func(t *testing.T) {
			s, pool, p := itemGrantFixture(t)
			ctx := context.Background()
			pkg := RewardPackage{Items: []RewardItem{{2001, 1}}}
			raw, _ := json.Marshal(pkg)
			tx := &itemGrantInterleaveTx{Tx: itemGrantBegin(t, pool)}
			if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold-10 WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID); err != nil {
				t.Fatal(err)
			}
			tx.afterMax = func(high int64) {
				if kind == "exhausted" || (tx.attempts > 1 && kind != "bounded contention") {
					return
				}
				key := fmt.Sprintf("other:%d:%d", p.PlayerID, high+1)
				if kind == "legacy grant PK" {
					r, err := itemPGService(t, pool).GrantContext(ctx, PlayerRef{p.ServerID, p.PlayerID + 1}, pkg, key)
					if err != nil || r.GrantID != high+1 {
						t.Fatalf("interleaved GrantContext: %+v %v", r, err)
					}
					return
				}
				if kind == "simultaneous PK and key" {
					key = fmt.Sprintf("shop:%d:1", p.PlayerID)
				}
				if _, err := pool.Exec(ctx, `INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,rewards,status,idempotency_key) VALUES($1,$2,$3,'gm','collision',$4,0,$5)`, p.ServerID, high+1, p.PlayerID+1, raw, key); err != nil {
					t.Fatal(err)
				}
			}
			want, attempts := error(nil), 2
			switch kind {
			case "simultaneous PK and key":
				want = ErrGrantReceiptConflict
			case "bounded contention":
				want, attempts = ErrGrantIDContention, 8
			case "exhausted":
				want, attempts = ErrGrantIDExhausted, 1
				if _, err := tx.Exec(ctx, `INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,idempotency_key) VALUES($1,$2,$3,'gm','','exhaustion')`, p.ServerID, int64(math.MaxInt64), p.PlayerID); err != nil {
					t.Fatal(err)
				}
			}
			receipt, err := s.CreateItemGrantInTx(ctx, tx, p, pkg, ItemGrantSource{1001, 1})
			if !errors.Is(err, want) || tx.attempts != attempts || (want != nil && receipt.GrantID != 0) {
				t.Fatalf("receipt=%+v err=%v want=%v attempts=%d want=%d", receipt, err, want, tx.attempts, attempts)
			}
			if err := tx.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			var clean bool
			if err := pool.QueryRow(ctx, `SELECT gold=100 AND NOT EXISTS(SELECT 1 FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2) FROM player_wallet WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID).Scan(&clean); err != nil || !clean || itemPGQuantity(t, pool, p, 2001) != 0 {
				t.Fatalf("collision rollback: %v %v", clean, err)
			}
		})
	}
}

func TestPGItemGrantRejectsEveryExistingKey(t *testing.T) {
	for _, kind := range []string{"exact success", "other owner", "other package", "pending", "failed"} {
		t.Run(kind, func(t *testing.T) {
			s, pool, p := itemGrantFixture(t)
			ctx := context.Background()
			pkg := RewardPackage{Items: []RewardItem{{2001, 1}}}
			stored, owner, status := pkg, p.PlayerID, GrantStatusSuccess
			switch kind {
			case "other owner":
				owner++
			case "other package":
				stored.Items = []RewardItem{{2001, 2}}
			case "pending":
				status = GrantStatusPending
			case "failed":
				status = GrantStatusFailed
			}
			raw, _ := json.Marshal(stored)
			key := fmt.Sprintf("shop:%d:1", p.PlayerID)
			if _, err := pool.Exec(ctx, `INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,rewards,status,idempotency_key) SELECT $1,COALESCE(MAX(grant_id),0)+1,$2,'shop','original',$3,$4,$5 FROM reward_grant_queue WHERE server_id=$1`, p.ServerID, owner, raw, status, key); err != nil {
				t.Fatal(err)
			}
			tx := itemGrantBegin(t, pool)
			if _, err := tx.Exec(ctx, `UPDATE player_wallet SET gold=gold-10 WHERE server_id=$1 AND player_id=$2`, p.ServerID, p.PlayerID); err != nil {
				t.Fatal(err)
			}
			if r, err := s.CreateItemGrantInTx(ctx, tx, p, pkg, ItemGrantSource{1001, 1}); !errors.Is(err, ErrGrantReceiptConflict) || r.GrantID != 0 {
				t.Fatalf("existing key became success: %+v %v", r, err)
			}
			if err := tx.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			var unchanged bool
			if err := pool.QueryRow(ctx, `SELECT w.gold=100 AND q.player_id=$3 AND q.status=$4 AND q.rewards=$5::jsonb AND q.source_ref='original' FROM player_wallet w JOIN reward_grant_queue q USING(server_id) WHERE w.server_id=$1 AND w.player_id=$2 AND q.idempotency_key=$6`, p.ServerID, p.PlayerID, owner, status, raw, key).Scan(&unchanged); err != nil || !unchanged || itemPGQuantity(t, pool, p, 2001) != 0 {
				t.Fatalf("existing key changed data: %v %v", unchanged, err)
			}
		})
	}
}

func TestPGItemGrantPreservesExactReceiptAndLegacyReplay(t *testing.T) {
	s, pool, p := itemGrantFixture(t)
	ctx := context.Background()
	pkg := RewardPackage{Resources: map[string]int64{}, Items: []RewardItem{{2004, 1}, {2001, 1}, {2004, 1}}}
	tx := itemGrantBegin(t, pool)
	receipt, err := s.CreateItemGrantInTx(ctx, tx, p, pkg, ItemGrantSource{1001, 1})
	if err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	key := fmt.Sprintf("shop:%d:1", p.PlayerID)
	for _, other := range []RewardPackage{
		{Items: pkg.Items}, // nil resources differs from the original empty object.
		{Resources: pkg.Resources, Items: []RewardItem{{2001, 1}, {2004, 2}}},
		{Resources: pkg.Resources, Items: []RewardItem{{2001, 1}, {2004, 1}, {2004, 1}}},
	} {
		if _, found, err := s.FindGrantReceipt(ctx, p, other, key); !errors.Is(err, ErrGrantReceiptMismatch) || found {
			t.Fatalf("package was normalized: %v %v", found, err)
		}
	}
	old, err := s.GrantContext(ctx, p, pkg, key)
	if err != nil || !old.Duplicate || old.GrantID != receipt.GrantID || itemPGQuantity(t, pool, p, 2004) != 2 {
		t.Fatalf("legacy exact replay changed: %+v %v", old, err)
	}
}
