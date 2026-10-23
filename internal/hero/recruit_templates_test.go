package hero

import (
	"context"
	"testing"
)

func TestListRecruitTemplatesNonEmpty(t *testing.T) {
	svc := NewService()
	res, err := svc.ListRecruitTemplates(context.Background(), PlayerRef{ServerID: 1, PlayerID: 1}, ListRecruitTemplatesQuery{})
	if err != nil {
		t.Fatal(err)
	}
	if res.Total < 20 || len(res.Templates) != res.Total {
		t.Fatalf("total=%d len=%d", res.Total, len(res.Templates))
	}
	tpl := res.Templates[0].Template
	if tpl.RecruitCost.Food != 5000 || tpl.RecruitItem.ItemCfgID != RecruitScrollID {
		t.Fatalf("cost preview %+v item %+v", tpl.RecruitCost, tpl.RecruitItem)
	}
}

func TestListRecruitTemplatesPoolFilter(t *testing.T) {
	svc := NewService()
	res, err := svc.ListRecruitTemplates(context.Background(), PlayerRef{ServerID: 1, PlayerID: 1}, ListRecruitTemplatesQuery{Pool: "elite"})
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range res.Templates {
		if row.Template.Pool != "elite" {
			t.Fatalf("pool %q", row.Template.Pool)
		}
	}
}

func TestRecruitPlayerInsufficientRes(t *testing.T) {
	svc := NewService()
	tpl := svc.Catalog[1001]
	inv := &memInventory{
		wallet: Resources{
			Food: tpl.RecruitCost.Food - 1, Wood: tpl.RecruitCost.Wood,
			Stone: tpl.RecruitCost.Stone, Iron: tpl.RecruitCost.Iron,
		},
		items: map[int32]int32{tpl.RecruitItem.ItemCfgID: tpl.RecruitItem.Quantity},
	}
	p := PlayerRef{ServerID: 1, PlayerID: 8}
	_, err := svc.RecruitPlayer(context.Background(), p, inv, RecruitRequest{TemplateCfgID: 1001})
	if err != ErrInsufficientRes {
		t.Fatalf("expected ErrInsufficientRes, got %v", err)
	}
}
