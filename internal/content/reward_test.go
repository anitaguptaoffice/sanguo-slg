package content

import (
	"errors"
	"strings"
	"testing"
)

func TestParseRewardJSONAndGrant(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 1, PlayerID: 100}

	raw := []byte(`{"resources":{"food":500,"wood":200},"items":[{"item_cfg_id":2001,"qty":3}]}`)
	pkg, err := ParseRewardJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	res, err := svc.Grant(p, pkg, "quest:100:1:claim")
	if err != nil {
		t.Fatal(err)
	}
	if res.Wallet.Food != 500 || res.Wallet.Wood != 200 {
		t.Fatalf("wallet %+v", res.Wallet)
	}
	qty, _ := svc.Get(p, 2001)
	if qty != 3 {
		t.Fatalf("item qty %d", qty)
	}

	dup, err := svc.Grant(p, pkg, "quest:100:1:claim")
	if err != nil {
		t.Fatal(err)
	}
	if !dup.Duplicate {
		t.Fatal("expected duplicate grant")
	}
	if dup.Wallet.Food != 500 {
		t.Fatalf("duplicate should not double credit: %+v", dup.Wallet)
	}
}

func TestGrantEmptyPackage(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 1, PlayerID: 2}
	_, err := svc.Grant(p, RewardPackage{}, "")
	if err != nil {
		t.Fatal(err)
	}
}

func TestGrantUnknownResource(t *testing.T) {
	svc := testService(t)
	p := PlayerRef{ServerID: 1, PlayerID: 3}
	_, err := svc.Grant(p, RewardPackage{Resources: map[string]int64{"gems": 1}}, "")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestGrantBagFullFails(t *testing.T) {
	const seed = `{
  "bag_max_distinct_items": 1,
  "items": [
    {"item_cfg_id": 2001, "code": "a", "name": "A", "item_type": 1, "max_stack": 99, "meta": {"grants":{"food":1}}},
    {"item_cfg_id": 2002, "code": "b", "name": "B", "item_type": 1, "max_stack": 99, "meta": {"grants":{"wood":1}}}
  ]
}`
	cat, err := LoadCatalog(strings.NewReader(seed))
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(cat)
	p := PlayerRef{ServerID: 1, PlayerID: 4}
	if _, err := svc.Add(p, 2001, 1); err != nil {
		t.Fatal(err)
	}
	_, err = svc.Grant(p, RewardPackage{Items: []RewardItem{{ItemCfgID: 2002, Qty: 1}}}, "")
	if !errors.Is(err, ErrBagFull) {
		t.Fatalf("expected bag full, got %v", err)
	}
}

func TestProcessGrantQueueHook(t *testing.T) {
	svc := testService(t)
	job := GrantJob{
		ServerID:       2,
		GrantID:        99,
		PlayerID:       5,
		SourceType:     "mail",
		SourceRef:      "mail_id=42",
		IdempotencyKey: "mail:5:42",
		Rewards: RewardPackage{
			Resources: map[string]int64{"iron": 10},
			Items:     []RewardItem{{ItemCfgID: 2003, Qty: 1}},
		},
	}
	st, res, err := svc.ProcessGrant(job)
	if err != nil || st != GrantStatusSuccess {
		t.Fatalf("status=%d err=%v", st, err)
	}
	if res.GrantID != 99 {
		t.Fatalf("grant id %d", res.GrantID)
	}
	if res.Wallet.Iron != 10 {
		t.Fatalf("wallet %+v", res.Wallet)
	}
}
