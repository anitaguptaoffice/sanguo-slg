package domestic

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/military/march"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
)

func TestPreparedCityGateAndClose(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, _ := freshTemplateSourceInput()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	pc, err := p.Prepare(ctx, initial)
	if err != nil {
		t.Fatal(err)
	}
	if !pc.gateHeld {
		t.Fatal("gate not held")
	}
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
		defer cancel()
		if other, err := p.Prepare(ctx, initial); err == nil {
			other.Close()
			t.Error("concurrent prepare admitted")
		}
	}()
	wg.Wait()
	pc.Close()
	if pc.gateHeld {
		t.Fatal("gate not released")
	}
	reopen, err := p.Prepare(context.Background(), initial)
	if err != nil {
		t.Fatal("gate still blocked after close", err)
	}
	reopen.Close()
}

func TestPreparedCityOneShotAndOrder(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, _ := freshTemplateSourceInput()
	pc, err := p.Prepare(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}
	defer pc.Close()
	identity := world.CityIdentity{ServerID: 1, CityID: 9, PlayerID: initial.PlayerID}
	if _, err := pc.Stage(context.Background(), nil, march.InitializedCity{}, time.Now()); err == nil {
		t.Fatal("stage without wallet admitted")
	}
	if err := pc.LockWallet(context.Background(), nil); err == nil {
		t.Fatal("nil access admitted")
	}
	if err := pc.LockWallet(context.Background(), &recruittx.Access{}); err == nil {
		t.Fatal("unpinned wallet admitted")
	}
	if !pc.walletOnce.Load() {
		t.Fatal("wallet not marked used on failure path")
	}
	if err := pc.LockWallet(context.Background(), &recruittx.Access{}); err == nil {
		t.Fatal("second wallet lock admitted")
	}
	pc.stagedOnce.Store(true)
	if _, err := pc.Stage(context.Background(), &recruittx.Access{}, march.InitializedCity{}, time.Now()); err == nil {
		t.Fatal("second stage admitted")
	}
	pc.stagedOnce.Store(false)
	if err := pc.Publish(); err == nil {
		t.Fatal("publish before stage admitted")
	}
	pc.stagedOnce.Store(true)
	pc.staged = cloneCity(initial)
	pc.staged.ID = identity.CityID
	if err := pc.Publish(); err != nil {
		t.Fatal(err)
	}
	if err := pc.Publish(); err == nil {
		t.Fatal("second publish admitted")
	}
}

func TestPreparedCityPrepareRejectsInvalid(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, _ := freshTemplateSourceInput()
	initial.ID = 1
	if _, err := p.Prepare(context.Background(), initial); !errors.Is(err, errInvalidFreshTemplate) {
		t.Fatal("invalid template admitted", err)
	}
	if _, err := p.Prepare(context.Background(), nil); err == nil {
		t.Fatal("nil initial admitted")
	}
}

func TestPreparedCityCloseDiscards(t *testing.T) {
	p := freshTemplateSourceUnit(t)
	initial, _ := freshTemplateSourceInput()
	pc, err := p.Prepare(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}
	pc.Close()
	if err := pc.LockWallet(context.Background(), &recruittx.Access{}); err == nil {
		t.Fatal("lock after close admitted")
	}
	if _, err := pc.Stage(context.Background(), &recruittx.Access{}, march.InitializedCity{}, time.Now()); err == nil {
		t.Fatal("stage after close admitted")
	}
	if err := pc.Publish(); err == nil {
		t.Fatal("publish after close admitted")
	}
	pc.Close()
}

func TestFreshPreparedTime(t *testing.T) {
	if _, err := freshPreparedTime(time.Time{}); err == nil {
		t.Fatal("zero time admitted")
	}
	at, err := freshPreparedTime(time.Unix(1, 123456789))
	if err != nil || at != time.Unix(1, 123456000).UTC() {
		t.Fatal("submicro normalize", err, at)
	}
}
