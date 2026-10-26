package hero

import (
	"errors"
	"math"
	"reflect"
	"testing"
)

func TestPlanRecruitRejectsMalformedCatalog(t *testing.T) {
	cases := []struct {
		name   string
		change func(*Service)
		want   error
	}{
		{"negative food", func(s *Service) { v := s.Catalog[1001]; v.RecruitCost.Food = -1; s.Catalog[1001] = v }, ErrInvalidRecruit},
		{"negative wood", func(s *Service) { v := s.Catalog[1001]; v.RecruitCost.Wood = -1; s.Catalog[1001] = v }, ErrInvalidRecruit},
		{"negative stone", func(s *Service) { v := s.Catalog[1001]; v.RecruitCost.Stone = -1; s.Catalog[1001] = v }, ErrInvalidRecruit},
		{"wrapped iron", func(s *Service) { v := s.Catalog[1001]; v.RecruitCost.Iron = math.MinInt64; s.Catalog[1001] = v }, ErrInvalidRecruit},
		{"unsupported gold", func(s *Service) { v := s.Catalog[1001]; v.RecruitCost.Gold = 1; s.Catalog[1001] = v }, ErrInvalidRecruit},
		{"wrong template ID", func(s *Service) { v := s.Catalog[1001]; v.TemplateCfgID = 1002; s.Catalog[1001] = v }, ErrInvalidRecruit},
		{"zero book quantity", func(s *Service) { v := s.Catalog[1001]; v.RecruitItem.Quantity = 0; s.Catalog[1001] = v }, ErrInvalidRecruit},
		{"wrapped book quantity", func(s *Service) { v := s.Catalog[1001]; v.RecruitItem.Quantity = math.MinInt32; s.Catalog[1001] = v }, ErrInvalidRecruit},
		{"unknown book", func(s *Service) { delete(s.Items, RecruitScrollID) }, ErrRecruitItemType},
		{"wrong book type", func(s *Service) { v := s.Items[RecruitScrollID]; v.ItemType = 1; s.Items[RecruitScrollID] = v }, ErrRecruitItemType},
		{"wrong book ID", func(s *Service) { v := s.Items[RecruitScrollID]; v.ItemCfgID++; s.Items[RecruitScrollID] = v }, ErrRecruitItemType},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewService()
			tc.change(s)
			input, before := planState(), planState()
			plan, err := s.PlanRecruit(input, RecruitRequest{TemplateCfgID: 1001})
			if !errors.Is(err, tc.want) || plan.Hero != nil || !reflect.DeepEqual(input, before) {
				t.Fatalf("result: %+v %v", plan, err)
			}
		})
	}
}

func TestPlanRecruitMaxCostsDoNotOverflow(t *testing.T) {
	s := NewService()
	v := s.Catalog[1001]
	v.RecruitCost = Resources{Food: math.MaxInt64, Wood: math.MaxInt64, Stone: math.MaxInt64, Iron: math.MaxInt64}
	v.RecruitItem.Quantity = math.MaxInt32
	s.Catalog[1001] = v
	input := planState()
	input.Wallet = v.RecruitCost
	input.Wallet.Gold = math.MaxInt64
	input.Items[RecruitScrollID] = math.MaxInt32
	plan, err := s.PlanRecruit(input, RecruitRequest{TemplateCfgID: 1001})
	if err != nil || plan.WalletAfter != (Resources{Gold: math.MaxInt64}) || plan.ItemsAfter[RecruitScrollID] != 0 {
		t.Fatalf("max costs: %+v %v", plan, err)
	}
	input.Wallet.Food--
	if _, err := s.PlanRecruit(input, RecruitRequest{TemplateCfgID: 1001}); !errors.Is(err, ErrInsufficientRes) {
		t.Fatalf("max insufficient: %v", err)
	}
}

func TestPlanRecruitRandomPoolAndDuplicateRules(t *testing.T) {
	s := NewService()
	v := s.Catalog[1001]
	s.Catalog = map[int32]Template{1001: v, 1002: s.Catalog[1002]}
	// Same-template exclusion leaves exactly one candidate without any capacity gate.
	for _, req := range []RecruitRequest{{}, {ItemCfgID: RecruitScrollID}, {Pool: v.Pool}} {
		input := planState()
		plan, err := s.PlanRecruit(input, req)
		if err != nil || plan.Hero.TemplateCfgID != 1001 || plan.ResourceDebit != v.RecruitCost || !reflect.DeepEqual(plan.ItemDebits, []ItemCost{{RecruitScrollID, 1}}) || plan.ItemsAfter[RecruitScrollID] != 2 || plan.WalletAfter.Gold != input.Wallet.Gold {
			t.Fatalf("random plan: %+v %v", plan, err)
		}
		input.Heroes = append(input.Heroes, plan.Hero)
		if _, err := s.PlanRecruit(input, req); !errors.Is(err, ErrEmptyPool) {
			t.Fatalf("owned pool: %v", err)
		}
	}
	v.RecruitCost.Food = math.MinInt64
	s.Catalog[1001] = v
	if plan, err := s.PlanRecruit(planState(), RecruitRequest{}); !errors.Is(err, ErrInvalidRecruit) || plan.Hero != nil {
		t.Fatalf("invalid random cost: %+v %v", plan, err)
	}
}

func TestEmbeddedRecruitCostsRejectOutOfRangeJSON(t *testing.T) {
	original := embeddedHeroesJSON
	defer func() { embeddedHeroesJSON = original }()
	for _, value := range []string{"9223372036854775808", "-9223372036854775809"} {
		embeddedHeroesJSON = []byte(`{"heroes":[{"template_cfg_id":1001,"recruit_cost":{"food":` + value + `}}]}`)
		if _, err := EmbeddedCatalog(); err == nil {
			t.Fatalf("out-of-range cost accepted: %s", value)
		}
	}
}
