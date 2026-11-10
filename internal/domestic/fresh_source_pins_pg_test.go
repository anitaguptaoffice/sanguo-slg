package domestic

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestPGFreshSourceBindingReadOnly(t *testing.T) {
	for _, quoted := range []bool{false, true} {
		t.Run(fmt.Sprintf("quoted_%t", quoted), func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			f := freshSourcePGFixture(t, ctx, quoted)
			freshCatalogPGExec(t, ctx, f.pool, `
INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,9,123);
INSERT INTO city_building VALUES(1,7,'hall',1,1,NULL);
INSERT INTO city_production_checkpoint(server_id,city_id,player_id,settled_at) VALUES(1,7,9,'2026-01-02T00:00:00Z');`)
			rows := freshCatalogPGRows(t, ctx, f.pool, f.profile.SchemaName)
			owner, access := recruitWalletBegin(t, ctx, f.binding)
			settings := freshSourcePGSettings(t, ctx, f, access)
			// A second real constructor proves rows/settings are preserved by validation.
			p, err := NewFreshCityParticipant(ctx, f.binding, access, f.profile, f.hub)
			if err != nil {
				t.Fatal(err)
			}
			pid := freshSourcePGPID(t, ctx, f, access)
			if got := freshSourcePGLocks(t, ctx, f, pid, "RowExclusiveLock", true); got != 0 {
				t.Fatal("constructor acquired business relation pins", got)
			}
			original, _ := freshsource.Snapshot(f.profile)
			f.profile.Objects["player_wallet"] = freshsource.ObjectIdentity{OID: 1, OwnerOID: 1}
			f.profile.Cohort[0]++
			if err = p.PinWallet(ctx, access); err != nil {
				t.Fatal("caller profile changed captured expectations", err)
			}
			f.profile = original
			if got := freshSourcePGLocks(t, ctx, f, pid, "RowExclusiveLock", true); got != 1 {
				t.Fatal("wallet stage pin set", got)
			}
			alias := *access
			freshSourcePGPin(t, ctx, p, &alias)
			freshSourcePGPin(t, ctx, p, access) // Both methods remain idempotent after WCB.
			if got := freshSourcePGLocks(t, ctx, f, pid, "RowExclusiveLock", true); got != 7 {
				t.Fatal("complete stage pin set", got)
			}
			if freshSourcePGSettings(t, ctx, f, access) != settings {
				t.Fatal("caller settings changed")
			}
			if err = owner.Commit(ctx); err != nil {
				t.Fatal("participant ended command", err)
			}
			if !reflect.DeepEqual(rows, freshCatalogPGRows(t, ctx, f.pool, f.profile.SchemaName)) {
				t.Fatal("constructor/pins changed business rows")
			}
			owner, access = recruitWalletBegin(t, ctx, f.binding)
			freshSourcePGPin(t, ctx, f.source, access)
			if err = owner.Rollback(ctx); err != nil {
				t.Fatal("caller rollback", err)
			}
		})
	}
}

func TestPGFreshSourceOrder(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	f := freshSourcePGFixture(t, ctx, false)
	for mask := 0; mask < 8; mask++ {
		for _, city := range []bool{false, true} {
			t.Run(fmt.Sprintf("mask_%d/city_%t", mask, city), func(t *testing.T) {
				o, a := recruitWalletBegin(t, ctx, f.binding)
				for i, table := range []string{"player_wallet", "city_production_checkpoint", "city_building"} {
					if mask&(1<<i) != 0 {
						query := "LOCK TABLE ONLY " + pgx.Identifier{f.profile.SchemaName, table}.Sanitize() + " IN ROW EXCLUSIVE MODE"
						if _, err := a.Exec(ctx, f.binding, query); err != nil {
							t.Fatal(err)
						}
					}
				}
				pid := freshSourcePGPID(t, ctx, f, a)
				call := f.source.PinWallet
				if city {
					call = f.source.PinCityState
				}
				err := call(ctx, a)
				valid := mask == 1 || mask == 3 || mask == 7 || (mask == 0 && !city)
				want := mask
				if valid {
					want |= 1
					if city {
						want = 7
					}
				}
				if valid && err != nil || !valid && !errors.Is(err, errFreshPinOrder) {
					t.Fatal("wrong prefix decision", err)
				}
				if got := freshSourcePGLocks(t, ctx, f, pid, "RowExclusiveLock", true); got != want {
					t.Fatal("reverse repair or missing pin", got, want)
				}
				if err := o.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
			})
		}
	}
	for _, mode := range []string{"ACCESS SHARE", "ROW SHARE", "SHARE ROW EXCLUSIVE", "ACCESS EXCLUSIVE"} {
		t.Run("mode_"+mode, func(t *testing.T) {
			o, a := recruitWalletBegin(t, ctx, f.binding)
			query := "LOCK TABLE ONLY " + pgx.Identifier{f.profile.SchemaName, "player_wallet"}.Sanitize() + " IN " + mode + " MODE"
			if _, err := a.Exec(ctx, f.binding, query); err != nil {
				t.Fatal(err)
			}
			err := f.source.PinCityState(ctx, a)
			if !errors.Is(err, errFreshPinOrder) {
				t.Fatal("different mode counted as exact W", err)
			}
			if mode == "ACCESS SHARE" {
				freshSourcePGPin(t, ctx, f.source, a)
			} else {
				query = "LOCK TABLE ONLY " + pgx.Identifier{f.profile.SchemaName, "player_wallet"}.Sanitize() + " IN ROW EXCLUSIVE MODE"
				if _, err := a.Exec(ctx, f.binding, query); err != nil {
					t.Fatal(err)
				}
				for _, call := range []func(context.Context, *recruittx.Access) error{f.source.PinWallet, f.source.PinCityState} {
					if err := call(ctx, a); !errors.Is(err, errFreshPinOrder) {
						t.Fatal("unsupported mode alongside exact W admitted", err)
					}
				}
			}
			if err := o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
		})
	}
	if f.source.state.retired.Load() {
		t.Fatal("order/mode errors retired source")
	}
	o, a := recruitWalletBegin(t, ctx, f.binding)
	freshSourcePGPin(t, ctx, f.source, a)
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestPGFreshSourceBlockedPins(t *testing.T) {
	cases := []struct {
		name    string
		index   int
		timeout bool
	}{
		{"wallet_cancel", 0, false},
		{"checkpoint_cancel", 1, false},
		{"building_cancel", 2, false},
		{"checkpoint_lock_timeout", 1, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			f := freshSourcePGFixture(t, ctx, false)
			o, a := recruitWalletBegin(t, ctx, f.binding)
			pid := freshSourcePGPID(t, ctx, f, a)
			if tc.index != 0 {
				if err := f.source.PinWallet(ctx, a); err != nil {
					t.Fatal(err)
				}
			}
			// Establish city blockers only after PinWallet's full catalog scan returned.
			blocker, err := f.pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				clean, stop := context.WithTimeout(context.Background(), 5*time.Second)
				defer stop()
				if err := blocker.Rollback(clean); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
					t.Error("blocker cleanup", err)
				}
			})
			table := []string{"player_wallet", "city_production_checkpoint", "city_building"}[tc.index]
			query := "LOCK TABLE ONLY " + pgx.Identifier{f.profile.SchemaName, table}.Sanitize() + " IN ACCESS EXCLUSIVE MODE"
			if _, err = blocker.Exec(ctx, query); err != nil {
				t.Fatal(err)
			}
			if tc.timeout {
				if _, err = a.Exec(ctx, f.binding, "SET LOCAL lock_timeout = '5s'"); err != nil {
					t.Fatal(err)
				}
			}
			callCtx, callCancel := context.WithCancel(ctx)
			result, done := make(chan error, 1), make(chan struct{})
			go func() {
				defer close(done)
				if tc.index == 0 {
					result <- f.source.PinWallet(callCtx, a)
				} else {
					result <- f.source.PinCityState(callCtx, a)
				}
			}()
			t.Cleanup(func() {
				callCancel()
				select {
				case <-done:
				case <-time.After(5 * time.Second):
					t.Error("pin operation did not end during bounded cleanup")
				}
			})
			poll, observation := time.NewTicker(10*time.Millisecond), time.NewTimer(3*time.Second)
			defer poll.Stop()
			defer observation.Stop()
			for freshSourcePGLocks(t, ctx, f, pid, "RowExclusiveLock", false) != 1<<tc.index {
				select {
				case <-done:
					t.Fatal("pin returned before actual requested wait was observed", <-result)
				case <-observation.C:
					t.Fatal("no exact backend/OID/RowExclusive wait observed")
				case <-poll.C:
				}
			}
			if got := freshSourcePGLocks(t, ctx, f, pid, "RowExclusiveLock", true); got != (1<<tc.index)-1 {
				t.Fatal("preceding pins absent or later pin acquired", got)
			}
			if got := freshSourcePGLocks(t, ctx, f, pid, "AccessShareLock", false); got != 0 {
				t.Fatal("catalog-deparse wait confused with explicit pin", got)
			}
			if !tc.timeout {
				callCancel()
			}
			select {
			case err = <-result:
			case <-ctx.Done():
				t.Fatal("bounded pin did not return")
			}
			var pgerr *pgconn.PgError
			if tc.timeout {
				if !errors.As(err, &pgerr) || pgerr.Code != "55P03" {
					t.Fatal("real lock_timeout not observed", err)
				}
			} else if !errors.Is(err, context.Canceled) && (!errors.As(err, &pgerr) || pgerr.Code != "57014") {
				t.Fatal("waiting cancellation not observed", err)
			}
			if f.source.state.retired.Load() {
				t.Fatal("operational waiting failure retired source")
			}
			// Error may already abort PostgreSQL; do not assert all pins survive it.
			if err = o.Rollback(ctx); err != nil {
				// pgx cancellation can close its transport. A failed local rollback is
				// not success: require disappearance of this exact owned server backend.
				resolved, stop := context.WithTimeout(ctx, 5*time.Second)
				defer stop()
				for {
					var absent bool
					if queryErr := f.pool.QueryRow(resolved, `SELECT NOT EXISTS(SELECT FROM pg_catalog.pg_stat_activity WHERE pid=$1)`, pid).Scan(&absent); queryErr != nil {
						t.Fatal("rollback failed and server resolution remains unknown", err, queryErr)
					}
					if absent {
						break
					}
					select {
					case <-resolved.Done():
						t.Fatal("rollback failed and owned backend remains", err)
					case <-poll.C:
					}
				}
			}
			if got := freshSourcePGLocks(t, ctx, f, pid, "", true); got != 0 {
				t.Fatal("residual target locks after confirmed server transaction end", got)
			}
			if got := freshSourcePGLocks(t, ctx, f, pid, "", false); got != 0 {
				t.Fatal("residual wait after confirmed server transaction end", got)
			}
			if err = blocker.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
			o, a = recruitWalletBegin(t, ctx, f.binding)
			freshSourcePGPin(t, ctx, f.source, a)
			if err = o.Rollback(ctx); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestPGFreshSourceConcurrentTransactions(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	f := freshSourcePGFixture(t, ctx, false)
	owners := make([]*recruittx.Owner, 2)
	accesses := make([]*recruittx.Access, 2)
	pids := make([]int32, 2)
	for i := range owners {
		owners[i], accesses[i] = recruitWalletBegin(t, ctx, f.binding)
		pids[i] = freshSourcePGPID(t, ctx, f, accesses[i])
	}
	if pids[0] == pids[1] {
		t.Fatal("fixture did not create independent server transactions")
	}
	ready, result := make(chan int, 2), make(chan error, 2)
	release, done := make(chan struct{}), make(chan struct{})
	var unblock sync.Once
	var workers sync.WaitGroup
	for i, access := range accesses {
		alias := *f.source
		workers.Add(1)
		go func() {
			defer workers.Done()
			if err := alias.PinWallet(ctx, access); err != nil {
				result <- err
				return
			}
			ready <- i
			select {
			case <-release:
				result <- alias.PinCityState(ctx, access)
			case <-ctx.Done():
				result <- ctx.Err()
			}
		}()
	}
	go func() {
		workers.Wait()
		close(done)
	}()
	defer func() {
		unblock.Do(func() { close(release) })
		cancel()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("concurrent operations did not end")
		}
	}()
	for range owners {
		select {
		case i := <-ready:
			if got := freshSourcePGLocks(t, ctx, f, pids[i], "RowExclusiveLock", true); got != 1 {
				t.Fatal("overlapping transaction lacks its own W", got)
			}
		case err := <-result:
			t.Fatal("concurrent wallet phase failed", err)
		case <-ctx.Done():
			t.Fatal("both wallet phases were not observed")
		}
	}
	otherOwner, otherAccess := recruitWalletBegin(t, ctx, f.binding)
	if err := f.source.PinCityState(ctx, otherAccess); !errors.Is(err, errFreshPinOrder) {
		t.Fatal("other transactions lent W to an unpinned transaction", err)
	}
	if err := otherOwner.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	unblock.Do(func() { close(release) })
	for i := 0; i < len(owners); i++ {
		select {
		case err := <-result:
			if err != nil {
				t.Fatal("concurrent city phase", err)
			}
		case <-ctx.Done():
			t.Fatal("concurrent city phases did not finish")
		}
	}
	for i, owner := range owners {
		if got := freshSourcePGLocks(t, ctx, f, pids[i], "RowExclusiveLock", true); got != 7 {
			t.Fatal("incomplete independent WCB", got)
		}
		if err := owner.Rollback(ctx); err != nil {
			t.Fatal(err)
		}
	}
}
