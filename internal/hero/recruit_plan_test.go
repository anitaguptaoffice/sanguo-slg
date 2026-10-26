package hero

import (
	"errors"
	"reflect"
	"testing"
	"time"
)

func planState() *PlayerState {
	return &PlayerState{
		ServerID: 1, PlayerID: 9,
		Wallet: Resources{Food: 20000, Wood: 20000, Stone: 20000, Iron: 20000, Gold: 47},
		Items:  map[int32]int32{RecruitScrollID: 3, 2050: 5},
		Heroes: []*Hero{{ServerID: 1, PlayerID: 9, HeroID: 71, TemplateCfgID: 1002, Level: 3}},
	}
}

func TestPlanRecruitExactCostNoInputMutation(t *testing.T) {
	s := NewService()
	s.Store = nil // Any persistence access would panic.
	now := time.Unix(10000, 0)
	s.SetClock(func() time.Time { return now })
	input, before := planState(), planState()
	plan, err := s.PlanRecruit(input, RecruitRequest{TemplateCfgID: 1001, ItemCfgID: 999, Pool: "ignored"})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(input, before) {
		t.Fatalf("input mutated: %+v", input)
	}
	tpl := s.Catalog[1001]
	h := plan.Hero
	if h.HeroID != 0 || h.TemplateCfgID != 1001 || h.ServerID != input.ServerID || h.PlayerID != input.PlayerID ||
		h.Level != 1 || h.Loyalty != LoyaltyDefault || h.Status != StatusIdle || !h.CreatedAt.Equal(now) ||
		h.Force != tpl.Base.Force || h.Intel != tpl.Base.Intel || h.Politics != tpl.Base.Politics || h.Command != tpl.Base.Command {
		t.Fatalf("draft: %+v", h)
	}
	if plan.ResourceDebit != tpl.RecruitCost || !reflect.DeepEqual(plan.ItemDebits, []ItemCost{tpl.RecruitItem}) {
		t.Fatalf("debits: %+v", plan)
	}
	want := input.Wallet
	if !want.Sub(tpl.RecruitCost) || plan.WalletAfter != want || plan.WalletAfter.Gold != 47 || plan.ItemsAfter[RecruitScrollID] != 2 || plan.ItemsAfter[2050] != 5 {
		t.Fatalf("balances: %+v", plan)
	}
	plan.ItemsAfter[2050] = 0
	plan.Hero.PlayerID = 800
	plan.ItemDebits[0].Quantity = 90
	if !reflect.DeepEqual(input, before) {
		t.Fatal("plan aliases input")
	}
	// A separate plan has no reservation side effect and no shared output maps.
	again, err := s.PlanRecruit(input, RecruitRequest{TemplateCfgID: 1001})
	if err != nil || again.Hero.HeroID != 0 || again.ItemsAfter[2050] != 5 || again.ItemDebits[0].Quantity != 1 {
		t.Fatalf("second plan: %+v %v", again, err)
	}
}

func TestPlanRecruitFailuresLeaveInputAlone(t *testing.T) {
	cases := []struct {
		name   string
		req    RecruitRequest
		change func(*PlayerState)
		want   error
	}{
		{"unknown", RecruitRequest{TemplateCfgID: 9999}, nil, ErrUnknownTemplate},
		{"duplicate", RecruitRequest{TemplateCfgID: 1002}, nil, ErrAlreadyOwned},
		{"negative template", RecruitRequest{TemplateCfgID: -1}, nil, ErrInvalidRecruit},
		{"unknown item", RecruitRequest{ItemCfgID: 9999}, nil, ErrRecruitItemType},
		{"unknown pool", RecruitRequest{Pool: "unknown"}, nil, ErrEmptyPool},
		{"resources", RecruitRequest{TemplateCfgID: 1001}, func(p *PlayerState) { p.Wallet.Food = 0 }, ErrInsufficientRes},
		{"items", RecruitRequest{TemplateCfgID: 1001}, func(p *PlayerState) { p.Items = nil }, ErrInsufficientItem},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewService()
			input, before := planState(), planState()
			if tc.change != nil {
				tc.change(input)
				tc.change(before)
			}
			plan, err := s.PlanRecruit(input, tc.req)
			if !errors.Is(err, tc.want) || !reflect.DeepEqual(plan, RecruitPlan{}) {
				t.Fatalf("result: %+v %v", plan, err)
			}
			if !reflect.DeepEqual(input, before) {
				t.Fatal("failed plan mutated input")
			}
		})
	}
}

func TestPlanRecruitRejectsUnscopedSnapshot(t *testing.T) {
	for _, change := range []func(*PlayerState){
		func(p *PlayerState) { p.ServerID = 0 },
		func(p *PlayerState) { p.PlayerID = 0 },
		func(p *PlayerState) { p.Heroes[0] = nil },
		func(p *PlayerState) { p.Heroes[0].PlayerID++ },
		func(p *PlayerState) { p.Heroes[0].ServerID++ },
	} {
		p := planState()
		change(p)
		if _, err := NewService().PlanRecruit(p, RecruitRequest{}); !errors.Is(err, ErrInvalidRecruit) {
			t.Fatalf("unscoped snapshot: %v", err)
		}
	}
	if _, err := NewService().PlanRecruit(nil, RecruitRequest{}); !errors.Is(err, ErrInvalidRecruit) {
		t.Fatalf("nil snapshot: %v", err)
	}
}
