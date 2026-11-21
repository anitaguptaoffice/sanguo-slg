package battle

// WallGroup is one type of city wall defense on the one-dimensional lane.
type WallGroup struct {
	Code  string
	Count int
	Atk   float64
	Def   float64
	HP    float64
	Range float64
}

// WallDefense builds the R2-S5 wall defense group used by R3-S1 battles.
// The wall level scales attack and structure HP by ten percent per level.
func WallDefense(code string, count int, wallLevel int32) (WallGroup, bool) {
	if count <= 0 {
		return WallGroup{}, false
	}
	scale := 1 + 0.1*float64(wallLevel)
	var g WallGroup
	switch code {
	case "trap":
		g = WallGroup{Code: code, Atk: 40, Def: 5, HP: 40, Range: 1}
	case "stakes":
		g = WallGroup{Code: code, Atk: 30, Def: 10, HP: 80, Range: 1}
	case "tower":
		g = WallGroup{Code: code, Atk: 28, Def: 8, HP: 120, Range: 12}
	case "log":
		g = WallGroup{Code: code, Atk: 45, Def: 6, HP: 100, Range: 2}
	case "rock":
		g = WallGroup{Code: code, Atk: 35, Def: 6, HP: 90, Range: 8}
	default:
		return WallGroup{}, false
	}
	if wallLevel < 1 {
		return WallGroup{}, false
	}
	g.Count = count
	g.Atk *= scale
	g.HP *= scale
	return g, true
}

func wallCopies(groups []WallGroup) map[string]WallGroup {
	out := make(map[string]WallGroup, len(groups))
	for _, g := range groups {
		if g.Count > 0 {
			out[g.Code] = g
		}
	}
	return out
}

func wallCounts(walls map[string]WallGroup) map[string]int {
	if len(walls) == 0 {
		return nil
	}
	out := make(map[string]int, len(walls))
	for code, g := range walls {
		if g.Count > 0 {
			out[code] = g.Count
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
