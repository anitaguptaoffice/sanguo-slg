package content

import (
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

// Get returns quantity for one item (0 if absent).
func (s *Service) Get(p PlayerRef, itemCfgID int32) (int32, error) {
	if _, err := s.itemDef(itemCfgID); err != nil {
		return 0, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.bagFor(p).Stacks[itemCfgID], nil
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
func (s *Service) Add(p PlayerRef, itemCfgID int32, delta int32) (int32, error) {
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
func (s *Service) Set(p PlayerRef, itemCfgID int32, qty int32) error {
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
		return nil
	}
	if b.Stacks[itemCfgID] == 0 && s.distinctCount(b, itemCfgID) >= int(s.catalog.BagMaxDistinctItems) {
		return ErrBagFull
	}
	b.Stacks[itemCfgID] = qty
	return nil
}

// Remove decreases quantity; deletes the row when quantity reaches zero.
func (s *Service) Remove(p PlayerRef, itemCfgID int32, delta int32) (int32, error) {
	if delta <= 0 {
		return 0, ErrInvalidQuantity
	}
	if _, err := s.itemDef(itemCfgID); err != nil {
		return 0, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
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
	return next, nil
}
