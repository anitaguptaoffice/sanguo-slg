package march

import "testing"

func TestUnitCatalogCoversTwelveTypes(t *testing.T) {
	catalog := DefaultUnitCatalog()
	if len(catalog) != 12 {
		t.Fatalf("units=%d", len(catalog))
	}
	for id := int32(1); id <= 12; id++ {
		spec, ok := catalog[id]
		if !ok || spec.Code == "" || spec.Speed <= 0 || spec.RecruitCost.Food <= 0 {
			t.Fatalf("unit %d: %+v", id, spec)
		}
		if spec.CombatType != "" && spec.CombatType != "infantry" && spec.CombatType != "cavalry" &&
			spec.CombatType != "archer" && spec.CombatType != "siege" {
			t.Fatalf("unit %d combat type %q", id, spec.CombatType)
		}
	}
	if catalog[12].CombatType != "cavalry" || catalog[11].Code != "light_cavalry" {
		t.Fatalf("advanced units: %+v %+v", catalog[11], catalog[12])
	}
}
