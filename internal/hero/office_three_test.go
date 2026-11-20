package hero

import (
	"context"
	"testing"
)

func TestCityOfficesAppointBonusesAndSalary(t *testing.T) {
	ctx := context.Background()
	svc := NewService()
	p := PlayerRef{ServerID: 1, PlayerID: 42}
	own := stubCityOwn{ok: true}
	heroes := []*Hero{
		{ServerID: 1, PlayerID: 42, TemplateCfgID: 1001, Status: StatusIdle, Level: 10, Loyalty: 80, Politics: 90, Intel: 40, Command: 60, Force: 70},
		{ServerID: 1, PlayerID: 42, TemplateCfgID: 1002, Status: StatusIdle, Level: 10, Loyalty: 50, Politics: 20, Intel: 95, Command: 50, Force: 40},
		{ServerID: 1, PlayerID: 42, TemplateCfgID: 1003, Status: StatusIdle, Level: 10, Loyalty: 60, Politics: 10, Intel: 30, Command: 88, Force: 80},
	}
	for _, h := range heroes {
		if err := svc.Store.CreateHero(ctx, h); err != nil {
			t.Fatal(err)
		}
	}
	rows, err := svc.SetCityOffice(ctx, p, 1, OfficeSteward, heroes[0].HeroID, own)
	if err != nil || len(rows) != 1 || rows[0].Production != 18 || rows[0].BuildSpeed != 9 {
		t.Fatalf("steward: %+v %v", rows, err)
	}
	if h, _ := svc.Store.GetHero(ctx, 1, heroes[0].HeroID); h.Status != StatusCityOffice {
		t.Fatalf("steward status %d", h.Status)
	}
	if _, err = svc.SetCityOffice(ctx, p, 1, OfficeStrategist, heroes[1].HeroID, own); err != nil {
		t.Fatal(err)
	}
	rows, _ = svc.SetCityOffice(ctx, p, 1, OfficeGeneral, heroes[2].HeroID, own)
	if len(rows) != 3 {
		t.Fatalf("offices: %+v", rows)
	}
	prod, build, research, defense, attack := svc.OfficeBonuses(ctx, 1, 1)
	if prod != 18 || build != 9 || research != 19 || defense != 9+17 || attack != 8 {
		t.Fatalf("bonuses %d %d %d %d %d", prod, build, research, defense, attack)
	}
	cost := TotalOfficeSalary(rows)
	if cost != 150+150+150-0 {
		t.Fatalf("salary %d", cost)
	}
	find := func(rows []CityOffice, office int16) CityOffice {
		for _, row := range rows {
			if row.Office == office {
				return row
			}
		}
		t.Fatalf("office %d missing: %+v", office, rows)
		return CityOffice{}
	}
	rows, err = svc.ApplyOfficeSalary(ctx, p, 1, true)
	if err != nil || find(rows, OfficeSteward).Loyalty != 81 {
		t.Fatalf("paid salary: %+v %v", rows, err)
	}
	rows, _ = svc.ApplyOfficeSalary(ctx, p, 1, false)
	if find(rows, OfficeSteward).Loyalty != 78 {
		t.Fatalf("missed salary: %+v", rows)
	}
	if _, err = svc.ClearCityOffice(ctx, p, 1, OfficeSteward, own); err != nil {
		t.Fatal(err)
	}
	if h, _ := svc.Store.GetHero(ctx, 1, heroes[0].HeroID); h.Status != StatusIdle {
		t.Fatalf("cleared status %d", h.Status)
	}
	if loy, err := svc.RewardOfficeHero(ctx, p, heroes[1].HeroID, 10); err != nil || loy != 58 {
		t.Fatalf("reward %d %v", loy, err)
	}
}
