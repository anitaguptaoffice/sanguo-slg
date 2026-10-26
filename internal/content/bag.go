package content

import (
	"context"
	"sort"
	"sync"
)

// Bag holds per-player item stacks in memory (mirrors player_item).
type Bag struct {
	Stacks map[int32]int32
}

func newBag() *Bag {
	return &Bag{Stacks: make(map[int32]int32)}
}

// Service provides bag CRUD and consumable use against a seed-backed catalog.
type Service struct {
	mu          sync.RWMutex
	catalog     *Catalog
	bags        map[PlayerRef]*Bag
	wallets     map[PlayerRef]ResourceWallet
	idempotency map[string]idemRecord
	grantSeq    map[int32]int64
	store       Store
}

func NewService(cat *Catalog) *Service {
	if cat == nil {
		panic("content: catalog is required")
	}
	return &Service{
		catalog:     cat,
		bags:        make(map[PlayerRef]*Bag),
		wallets:     make(map[PlayerRef]ResourceWallet),
		idempotency: make(map[string]idemRecord),
		grantSeq:    make(map[int32]int64),
	}
}

// UseStore enables persistence; PG grants atomically store bags, wallets and idempotency.
func (s *Service) UseStore(store Store) {
	s.store = store
}

// LoadPlayer hydrates the bag and, where supported, wallet (no-op without a store).
func (s *Service) LoadPlayer(ctx context.Context, p PlayerRef) error {
	if s.store == nil {
		return nil
	}
	if err := s.lockGrantContext(ctx); err != nil {
		return err
	}
	defer s.mu.Unlock()
	return s.loadPlayerUnlocked(ctx, p)
}

func (s *Service) loadPlayerUnlocked(ctx context.Context, p PlayerRef) error {
	stacks, err := s.store.LoadBag(ctx, p)
	if err != nil {
		return err
	}
	var wallet ResourceWallet
	var hasWallet bool
	if reader, ok := s.store.(interface {
		loadWallet(context.Context, PlayerRef) (ResourceWallet, error)
	}); ok {
		wallet, err = reader.loadWallet(ctx, p)
		hasWallet = true
		if err != nil {
			return err
		}
	}
	if hasWallet {
		s.wallets[p] = wallet
	}
	b := newBag()
	for _, st := range stacks {
		b.Stacks[st.ItemCfgID] = st.Quantity
	}
	s.bags[p] = b
	return nil
}

func (s *Service) persistStack(ctx context.Context, p PlayerRef, itemCfgID int32, qty int32) error {
	if s.store == nil {
		return nil
	}
	return s.store.SaveStack(ctx, p, itemCfgID, qty)
}

func (s *Service) bagFor(p PlayerRef) *Bag {
	b, ok := s.bags[p]
	if !ok {
		b = newBag()
		s.bags[p] = b
	}
	return b
}

func (s *Service) itemDef(id int32) (ItemDef, error) {
	def, ok := s.catalog.Items[id]
	if !ok {
		return ItemDef{}, ErrUnknownItem
	}
	return def, nil
}

// List returns all non-zero stacks for the player, sorted by item_cfg_id.
func (s *Service) List(p PlayerRef) []Stack {
	s.mu.RLock()
	defer s.mu.RUnlock()
	b := s.bags[p]
	if b == nil {
		return []Stack{}
	}
	out := make([]Stack, 0, len(b.Stacks))
	for id, qty := range b.Stacks {
		if qty > 0 {
			out = append(out, Stack{ItemCfgID: id, Quantity: qty})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ItemCfgID < out[j].ItemCfgID })
	return out
}

// Get returns quantity for one item (0 if absent).
func (s *Service) Get(p PlayerRef, itemCfgID int32) (int32, error) {
	if _, err := s.itemDef(itemCfgID); err != nil {
		return 0, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if b := s.bags[p]; b != nil {
		return b.Stacks[itemCfgID], nil
	}
	return 0, nil
}

func (s *Service) distinctCount(b *Bag, ignoreID int32) int {
	n := 0
	for id, qty := range b.Stacks {
		if qty > 0 && id != ignoreID {
			n++
		}
	}
	return n
}

// Add increases stack quantity, enforcing max_stack and distinct-item capacity.
// PG callers must use Grant; cache-derived absolute writes are offline-only.
func (s *Service) Add(p PlayerRef, itemCfgID int32, delta int32) (int32, error) {
	if _, pg := s.store.(*PGStore); pg {
		return 0, ErrOfflineStackWrite
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.addUnlocked(p, itemCfgID, delta)
}

func (s *Service) addUnlocked(p PlayerRef, itemCfgID int32, delta int32) (int32, error) {
	if delta <= 0 {
		return 0, ErrInvalidQuantity
	}
	def, err := s.itemDef(itemCfgID)
	if err != nil {
		return 0, err
	}
	b := s.bagFor(p)
	cur := b.Stacks[itemCfgID]
	if cur == 0 && s.distinctCount(b, itemCfgID) >= int(s.catalog.BagMaxDistinctItems) {
		return 0, ErrBagFull
	}
	next := cur + delta
	if next > def.MaxStack {
		return 0, ErrStackLimit
	}
	b.Stacks[itemCfgID] = next
	if err := s.persistStack(context.Background(), p, itemCfgID, next); err != nil {
		return 0, err
	}
	return next, nil
}

func (s *Service) listUnlocked(p PlayerRef) []Stack {
	b := s.bagFor(p)
	out := make([]Stack, 0, len(b.Stacks))
	for id, qty := range b.Stacks {
		if qty > 0 {
			out = append(out, Stack{ItemCfgID: id, Quantity: qty})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ItemCfgID < out[j].ItemCfgID })
	return out
}

// Set sets absolute quantity (0 removes the stack). Used for admin/sync CRUD.
// PG absolute replacement requires a separately authorized offline maintenance
// operation with competing writers stopped; it is not exposed by this service.
func (s *Service) Set(p PlayerRef, itemCfgID int32, qty int32) error {
	if _, pg := s.store.(*PGStore); pg {
		return ErrOfflineStackWrite
	}
	if qty < 0 {
		return ErrInvalidQuantity
	}
	def, err := s.itemDef(itemCfgID)
	if err != nil {
		return err
	}
	if qty > def.MaxStack {
		return ErrStackLimit
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.bagFor(p)
	if qty == 0 {
		delete(b.Stacks, itemCfgID)
		if err := s.persistStack(context.Background(), p, itemCfgID, 0); err != nil {
			return err
		}
		return nil
	}
	if b.Stacks[itemCfgID] == 0 && s.distinctCount(b, itemCfgID) >= int(s.catalog.BagMaxDistinctItems) {
		return ErrBagFull
	}
	b.Stacks[itemCfgID] = qty
	if err := s.persistStack(context.Background(), p, itemCfgID, qty); err != nil {
		return err
	}
	return nil
}

// Remove decreases quantity. PG uses a conditional durable delta and retains
// zero rows; the in-memory path removes empty stacks as before.
func (s *Service) Remove(p PlayerRef, itemCfgID int32, delta int32) (int32, error) {
	return s.RemoveContext(context.Background(), p, itemCfgID, delta)
}

// RemoveContext bounds lock acquisition and PG operations. Unlike the PG path,
// legacy Store writes do not provide transactional guarantees.
// A PG commit error may have an unknown outcome; this method never retries it.
func (s *Service) RemoveContext(ctx context.Context, p PlayerRef, itemCfgID int32, delta int32) (int32, error) {
	if delta <= 0 {
		return 0, ErrInvalidQuantity
	}
	if _, err := s.itemDef(itemCfgID); err != nil {
		return 0, err
	}
	if err := s.lockGrantContext(ctx); err != nil {
		return 0, err
	}
	defer s.mu.Unlock()
	if store, ok := s.store.(*PGStore); ok {
		remaining, err := store.removeItemAtomic(ctx, p, itemCfgID, delta)
		if err != nil {
			return 0, err
		}
		b := s.bagFor(p)
		if remaining == 0 {
			delete(b.Stacks, itemCfgID)
		} else {
			b.Stacks[itemCfgID] = remaining
		}
		return remaining, nil
	}
	b := s.bagFor(p)
	cur := b.Stacks[itemCfgID]
	if cur < delta {
		return 0, ErrInsufficientItems
	}
	next := cur - delta
	if next == 0 {
		delete(b.Stacks, itemCfgID)
	} else {
		b.Stacks[itemCfgID] = next
	}
	if err := s.persistStack(ctx, p, itemCfgID, next); err != nil {
		return 0, err
	}
	return next, nil
}
