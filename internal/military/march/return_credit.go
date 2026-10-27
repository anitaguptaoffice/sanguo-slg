package march

import "math"

// planReturnCredit checks every survivor and destination total before any credit.
// Empty/zero survivors need no balance entry; duplicate unit stacks accumulate in
// int64 so neither duplicate totals nor an already replenished city can overflow.
func planReturnCredit(catalog map[int32]UnitSpec, ready map[int32]int32, survivors []TroopStack) (map[int32]int64, bool) {
	planned := make(map[int32]int64, len(survivors))
	for _, st := range survivors {
		if _, known := catalog[st.UnitCfgID]; !known || st.Count < 0 {
			return nil, false
		}
		count, staged := planned[st.UnitCfgID]
		if !staged {
			count = int64(ready[st.UnitCfgID])
		}
		total := count + int64(st.Count)
		if count < 0 || total > math.MaxInt32 {
			return nil, false
		}
		if st.Count > 0 {
			planned[st.UnitCfgID] = total
		}
	}
	return planned, true
}
