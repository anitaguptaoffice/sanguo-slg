package content

import (
	"context"
	"fmt"
	"math"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestPGResourcePackAtomicConsumption(t *testing.T) {
	pool := openContentTestDB(t)
	defer pool.Close()
	applyContentSchema(t, pool)
	ctx := context.Background()
	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	var seq int64 = time.Now().UnixNano()
	fixture := func(food int64, qty int32) PlayerRef {
		seq++
		p := PlayerRef{ServerID: 1, PlayerID: seq}
		if _, err := pool.Exec(ctx, `INSERT INTO player_wallet(server_id,player_id,food) VALUES($1,$2,$3)`, p.ServerID, p.PlayerID, food); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO player_item(server_id,player_id,item_cfg_id,quantity) VALUES($1,$2,2001,$3)`, p.ServerID, p.PlayerID, qty); err != nil {
			t.Fatal(err)
		}
		return p
	}
	fresh := func(p PlayerRef) *Service {
		s := NewService(cat)
		s.UseStore(NewPGStore(pool))
		if err := s.LoadPlayer(ctx, p); err != nil {
			t.Fatal(err)
		}
		return s
	}
	check := func(p PlayerRef, food int64, qty int32) {
		t.Helper()
		s := fresh(p)
		q, e := s.Get(p, 2001)
		if e != nil || q != qty || s.Wallet(p).Food != food {
			t.Fatalf("fresh food=%d qty=%d err=%v; want %d/%d", s.Wallet(p).Food, q, e, food, qty)
		}
	}
	t.Run("durable_and_repeat", func(t *testing.T) {
		p := fixture(1000, 2)
		s := fresh(p)
		for i := int32(1); i <= 2; i++ {
			r, e := s.Use(p, 2001, 1)
			if e != nil || r.Remaining != 2-i || r.Grants.Food != 1000 {
				t.Fatalf("use %+v %v", r, e)
			}
			check(p, 1000+int64(i)*1000, 2-i)
		}
		if _, e := fresh(p).Use(p, 2001, 1); e != ErrInsufficientItems {
			t.Fatalf("exhausted repeat: %v", e)
		}
		check(p, 3000, 0)
	})
	t.Run("stale_services_one_stock", func(t *testing.T) {
		p := fixture(1000, 1)
		a, b := fresh(p), fresh(p)
		start := make(chan struct{})
		var wg sync.WaitGroup
		var successes atomic.Int32
		for _, s := range []*Service{a, b} {
			wg.Add(1)
			go func(s *Service) {
				defer wg.Done()
				<-start
				_, e := s.Use(p, 2001, 1)
				if e == nil {
					successes.Add(1)
				} else if e != ErrInsufficientItems {
					t.Errorf("use: %v", e)
				}
			}(s)
		}
		close(start)
		wg.Wait()
		if successes.Load() != 1 {
			t.Fatalf("successes=%d", successes.Load())
		}
		check(p, 2000, 0)
	})
	for _, deferred := range []bool{false, true} {
		t.Run(fmt.Sprintf("rollback_deferred_%v", deferred), func(t *testing.T) {
			p := fixture(1000, 1)
			s := fresh(p)
			name := fmt.Sprintf("consume_fail_%d", p.PlayerID)
			sql := fmt.Sprintf(`CREATE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected resource consumption failure'; END $$; `, name)
			if deferred {
				sql += fmt.Sprintf(`CREATE CONSTRAINT TRIGGER %s AFTER UPDATE ON player_wallet DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.player_id=%d) EXECUTE FUNCTION %s()`, name, p.PlayerID, name)
			} else {
				sql += fmt.Sprintf(`CREATE TRIGGER %s BEFORE UPDATE ON player_wallet FOR EACH ROW WHEN (NEW.player_id=%d) EXECUTE FUNCTION %s()`, name, p.PlayerID, name)
			}
			if _, e := pool.Exec(ctx, sql); e != nil {
				t.Fatal(e)
			}
			cleanup := func() {
				if _, e := pool.Exec(ctx, fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON player_wallet; DROP FUNCTION IF EXISTS %s()`, name, name)); e != nil {
					t.Errorf("cleanup: %v", e)
				}
			}
			// Run on assertion failure as well, before the parent closes its pool.
			defer cleanup()
			if _, e := s.Use(p, 2001, 1); e == nil {
				t.Fatal("injected failure ignored")
			}
			q, _ := s.Get(p, 2001)
			if q != 1 || s.Wallet(p).Food != 1000 {
				t.Fatal("failed tx mutated cache")
			}
			check(p, 1000, 1)
			cleanup()
			if _, e := s.Use(p, 2001, 1); e != nil {
				t.Fatal(e)
			}
			check(p, 2000, 0)
		})
	}
	t.Run("wallet_overflow", func(t *testing.T) {
		p := fixture(math.MaxInt64, 1)
		s := fresh(p)
		if _, e := s.Use(p, 2001, 1); e == nil {
			t.Fatal("overflow accepted")
		}
		q, _ := s.Get(p, 2001)
		if q != 1 || s.Wallet(p).Food != math.MaxInt64 {
			t.Fatal("overflow mutated cache")
		}
		check(p, math.MaxInt64, 1)
	})
}

func TestResourcePackRejectsEffectOverflow(t *testing.T) {
	def := ItemDef{ID: 2001, Meta: map[string]any{"grants": map[string]any{"food": int64(math.MaxInt64)}}}
	if _, err := parseResourceGrants(def, 2); err != ErrInvalidReward {
		t.Fatalf("overflow: %v", err)
	}
}
