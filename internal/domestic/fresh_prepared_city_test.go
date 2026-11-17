package domestic

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

func TestPreparedCityLifecycle(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, _ := freshTemplateSourceInput()
	bad, _ := freshTemplateSourceInput()
	bad.ID = 1
	if _, err := p.Prepare(context.Background(), bad); !errors.Is(err, errInvalidFreshTemplate) {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	pc, err := p.Prepare(ctx, initial)
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		c, stop := context.WithTimeout(context.Background(), 50*time.Millisecond)
		defer stop()
		if o, e := p.Prepare(c, initial); e == nil {
			o.Close()
			t.Error("concurrent prepare")
		}
	}()
	wg.Wait()
	if _, err := pc.Stage(context.Background(), nil, march.InitializedCity{}, time.Now()); err == nil {
		t.Fatal("stage without wallet")
	}
	if err := pc.LockWallet(context.Background(), &recruittx.Access{}); err == nil || pc.walletOnce.Load() {
		t.Fatal("unpinned lock", pc.walletOnce.Load())
	}
	pc.walletOnce.Store(true)
	if err := pc.LockWallet(context.Background(), &recruittx.Access{}); err == nil {
		t.Fatal("second wallet lock")
	}
	pc.walletOnce.Store(false)
	if err := pc.Publish(); err == nil {
		t.Fatal("publish before stage")
	}
	pc.stagedOnce.Store(true)
	pc.staged = cloneCity(initial)
	if err := pc.Publish(); err != nil {
		t.Fatal(err)
	}
	if err := pc.Publish(); err == nil {
		t.Fatal("second publish")
	}
	pc.Close()
	if err := pc.Publish(); err == nil {
		t.Fatal("publish after close")
	}
	if err := pc.LockWallet(context.Background(), &recruittx.Access{}); err == nil {
		t.Fatal("lock after close")
	}
	pc2, err := p.Prepare(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}
	pc2.Close()
	if _, err := freshPreparedTime(time.Time{}); err == nil {
		t.Fatal("zero time")
	}
	at, err := freshPreparedTime(time.Unix(1, 123456789))
	if err != nil || at != time.Unix(1, 123456000).UTC() {
		t.Fatal(err, at)
	}
}

func TestPGPreparedCity(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	f := freshSourcePGFixture(t, ctx, false)
	initial, _ := freshTemplateSourceInput()
	pc, err := f.source.Prepare(ctx, initial)
	if err != nil {
		t.Fatal(err)
	}
	defer pc.Close()
	o, a := recruitWalletBegin(t, ctx, f.binding)
	if err := pc.LockWallet(ctx, a); err == nil || pc.walletOnce.Load() {
		t.Fatal("unpinned", err, pc.walletOnce.Load())
	}
	freshSourcePGPin(t, ctx, f.source, a)
	if err := pc.LockWallet(ctx, a); err != nil {
		t.Fatal(err)
	}
	if err := pc.LockWallet(ctx, a); err == nil {
		t.Fatal("second lock")
	}
	var food int64
	tab := pgx.Identifier{f.profile.SchemaName, "player_wallet"}.Sanitize()
	if err := a.Scan(ctx, f.binding, "SELECT food FROM "+tab+" WHERE server_id=$1 AND player_id=$2", []any{f.profile.ServerID, initial.PlayerID}, &food); err != nil || food != initial.Wallet.Food {
		t.Fatal(food, err)
	}
	if _, err := pc.Stage(ctx, a, march.InitializedCity{}, time.Now()); err == nil || pc.stagedOnce.Load() {
		t.Fatal("stage without MIL proof", err, pc.stagedOnce.Load())
	}
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestPGPreparedCityWalletDrift(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	f := freshSourcePGFixture(t, ctx, false)
	initial, _ := freshTemplateSourceInput()
	pc, err := f.source.Prepare(ctx, initial)
	if err != nil {
		t.Fatal(err)
	}
	defer pc.Close()
	o, a := recruitWalletBegin(t, ctx, f.binding)
	if err := f.source.PinWallet(ctx, a); err != nil {
		t.Fatal(err)
	}
	wtab := pgx.Identifier{f.profile.SchemaName, "player_wallet"}.Sanitize()
	if _, err := a.Exec(ctx, f.binding, "ALTER TABLE "+wtab+" RENAME TO drift_wallet"); err != nil {
		t.Fatal(err)
	}
	if err := pc.LockWallet(ctx, a); err == nil || !f.source.state.retired.Load() {
		t.Fatal("drift", err, f.source.state.retired.Load())
	}
	if err := o.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
}
