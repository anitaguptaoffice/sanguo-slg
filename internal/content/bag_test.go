package content

import (
	"errors"
	"strings"
	"testing"
)

func testService(t *testing.T) *Service {
	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	return NewService(cat)
}

func TestBagCRUDAndStacking(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 1, PlayerID: 42}
	const foodID = 2001

	qty, err := svc.Add(p, foodID, 10)
	if err != nil || qty != 10 {
		t.Fatalf("add: qty=%d err=%v", qty, err)
	}
	got, err := svc.Get(p, foodID)
	if err != nil || got != 10 {
		t.Fatalf("get: %d err=%v", got, err)
	}

	qty, err = svc.Add(p, foodID, 5)
	if err != nil || qty != 15 {
		t.Fatalf("stack add: %d %v", qty, err)
	}

	if err := svc.Set(p, foodID, 20); err != nil {
		t.Fatal(err)
	}
	rem, err := svc.Remove(p, foodID, 7)
	if err != nil || rem != 13 {
		t.Fatalf("remove: rem=%d err=%v", rem, err)
	}
	stacks := svc.List(p)
	if len(stacks) != 1 || stacks[0].Quantity != 13 {
		t.Fatalf("list: %+v", stacks)
	}

	if err := svc.Set(p, foodID, 0); err != nil {
		t.Fatal(err)
	}
	if len(svc.List(p)) != 0 {
		t.Fatal("expected empty bag")
	}
}

func TestBagMaxStack(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 1, PlayerID: 1}
	cat, _ := EmbeddedCatalog()
	const foodID = 2001
	def := cat.Items[foodID]

	if _, err := svc.Add(p, foodID, def.MaxStack); err != nil {
		t.Fatal(err)
	}
	_, err := svc.Add(p, foodID, 1)
	if !errors.Is(err, ErrStackLimit) {
		t.Fatalf("expected stack limit, got %v", err)
	}
}

func TestBagDistinctCapacity(t *testing.T) {
	const seed = `{
  "bag_max_distinct_items": 2,
  "items": [
    {"item_cfg_id": 1, "code": "a", "name": "A", "item_type": 1, "max_stack": 99, "meta": {"grants":{"food":1}}},
    {"item_cfg_id": 2, "code": "b", "name": "B", "item_type": 1, "max_stack": 99, "meta": {"grants":{"wood":1}}},
    {"item_cfg_id": 3, "code": "c", "name": "C", "item_type": 1, "max_stack": 99, "meta": {"grants":{"stone":1}}}
  ]
}`
	cat, err := LoadCatalog(strings.NewReader(seed))
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(cat)
	p := PlayerRef{ServerID: 1, PlayerID: 9}

	if _, err := svc.Add(p, 1, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Add(p, 2, 1); err != nil {
		t.Fatal(err)
	}
	_, err = svc.Add(p, 3, 1)
	if !errors.Is(err, ErrBagFull) {
		t.Fatalf("expected bag full, got %v", err)
	}
	if _, err := svc.Add(p, 1, 1); err != nil {
		t.Fatalf("stack on existing should work: %v", err)
	}
}
