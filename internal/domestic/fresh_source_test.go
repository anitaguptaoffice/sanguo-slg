package domestic

import (
	"context"
	"errors"
	"maps"
	"sync"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Private pure-state fixture; it is never a successful constructor/SQL substitute.
func freshSourceUnitState() *freshDomesticSource {
	h := NewHub(nil)
	h.store, h.serverID = NewPGStore(&pgxpool.Pool{}), 1
	return &freshDomesticSource{hub: h, store: h.store, pool: h.store.Pool,
		profile: freshCatalogProfile(), catalog: maps.Clone(h.cat)}
}

func TestFreshSourcePinPlans(t *testing.T) {
	for mask := -1; mask <= 15; mask++ {
		for _, city := range []bool{false, true} {
			missing, err := freshPinMissing(mask, false, city)
			valid := mask == 1 || mask == 3 || mask == 7 || (mask == 0 && !city)
			want := 1 &^ mask
			if city {
				want = 7 &^ mask
			}
			if valid && (err != nil || missing != want) || !valid && !errors.Is(err, errFreshPinOrder) {
				t.Fatalf("mask=%d city=%v missing=%d error=%v", mask, city, missing, err)
			}
			if _, err = freshPinMissing(mask, true, city); !errors.Is(err, errFreshPinOrder) {
				t.Fatal("unsupported mode admitted")
			}
		}
	}
}

func TestFreshSourceCatalogCopy(t *testing.T) {
	cat := DefaultCatalog()
	copyCatalog, err := snapshotFreshCatalog(cat)
	if err != nil || !maps.Equal(cat, copyCatalog) {
		t.Fatal(err)
	}
	delete(cat, 1)
	delete(copyCatalog, 2)
	if copyCatalog[1].ID != 1 || cat[2].ID != 2 {
		t.Fatal("catalog aliases caller")
	}
	if empty, err := snapshotFreshCatalog(map[int32]BuildingSpec{}); err != nil || empty == nil || len(empty) != 0 {
		t.Fatal("empty-map semantics changed", err)
	}
	if _, err := snapshotFreshCatalog(nil); !errors.Is(err, errInvalidFreshTemplate) {
		t.Fatal("nil catalog admitted")
	}
}

func TestFreshSourceWiringRetiresAliases(t *testing.T) {
	changes := map[string]func(*Hub){
		"store_nil":       func(h *Hub) { h.store = nil },
		"store_replaced":  func(h *Hub) { h.store = NewPGStore(h.store.Pool) },
		"pool_nil":        func(h *Hub) { h.store.Pool = nil },
		"pool_replaced":   func(h *Hub) { h.store.Pool = &pgxpool.Pool{} },
		"shard":           func(h *Hub) { h.serverID++ },
		"catalog_nil":     func(h *Hub) { h.cat = nil },
		"catalog_removed": func(h *Hub) { delete(h.cat, 7) },
		"catalog_changed": func(h *Hub) {
			b := h.cat[7]
			b.ProdPerHour++
			h.cat[7] = b
		},
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			s := freshSourceUnitState()
			p := &FreshCityParticipant{state: s}
			alias := *p
			change(s.hub) // Sequential drift, never a concurrent map/pointer mutation.
			if s.checkWiring() == nil || !alias.state.retired.Load() {
				t.Fatal("drift did not retire all aliases")
			}
			s.hub.store, s.store.Pool, s.hub.serverID = s.store, s.pool, s.profile.ServerID
			s.hub.cat = maps.Clone(s.catalog)
			if alias.state.checkWiring() == nil {
				t.Fatal("restoring wiring revived retired source")
			}
		})
	}
}

func TestFreshSourceFailureClassification(t *testing.T) {
	cases := []error{nil, errFreshPinOrder, recruittx.ErrBinding, recruittx.ErrInactive,
		context.Canceled, context.DeadlineExceeded, errFreshSourceMetadata}
	for _, code := range []string{"42P01", "3F000", "42809", "42501", "55P03", "57014", "25P02"} {
		cases = append(cases, &pgconn.PgError{Code: code})
	}
	for i, err := range cases {
		s := freshSourceUnitState()
		got := s.failure(err)
		wantRetired := i >= 6 && i <= 10
		if got != err || s.retired.Load() != wantRetired {
			t.Fatalf("case %d changed error or retirement: %v", i, got)
		}
	}
}

func TestFreshSourceInvalidHandles(t *testing.T) {
	for _, p := range []*FreshCityParticipant{nil, {}, {state: freshSourceUnitState()}} {
		if p.PinWallet(nil, nil) == nil || p.PinCityState(context.Background(), &recruittx.Access{}) == nil {
			t.Fatal("invalid participant/access accepted")
		}
	}
	for _, h := range []*Hub{nil, {}, NewHub(nil), freshSourceUnitState().hub} {
		if p, err := NewFreshCityParticipant(context.Background(), nil, nil, freshCatalogProfile(), h); err == nil || p != nil {
			t.Fatal("invalid construction admitted")
		}
	}
}

func TestFreshSourceConcurrentRetirementCopies(t *testing.T) {
	p := FreshCityParticipant{state: freshSourceUnitState()}
	start := make(chan struct{})
	var group sync.WaitGroup
	for i := 0; i < 16; i++ {
		alias := p
		group.Add(1)
		go func() {
			defer group.Done()
			<-start
			alias.state.failure(errFreshSourceMetadata)
			if alias.state.checkWiring() == nil {
				t.Error("retired alias accepted")
			}
		}()
	}
	close(start)
	group.Wait()
}
