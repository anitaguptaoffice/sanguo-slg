package hero

import "testing"

func TestDefaultLevelTableLegacyShape(t *testing.T) {
	tbl, err := DefaultLevelTable()
	if err != nil {
		t.Fatal(err)
	}
	if tbl.UpgradeExpToNext(1) != 100 {
		t.Fatalf("1->2 cost %d", tbl.UpgradeExpToNext(1))
	}
	if tbl.TotalExpForLevel(20) != 19000 {
		t.Fatalf("total at 20 %d", tbl.TotalExpForLevel(20))
	}
	if tbl.UpgradeExpToNext(20) != 0 {
		t.Fatalf("max level next cost %d", tbl.UpgradeExpToNext(20))
	}
}
