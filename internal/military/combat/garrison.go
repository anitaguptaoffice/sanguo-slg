package combat

import "github.com/anitaguptaoffice/sanguo-slg/internal/military/march"

// Garrison is a fixed-coordinate NPC defender stack (M2 fixture).
type Garrison struct {
	Troops    []march.TroopStack
	HeroLevel int
	Morale    float64
}

// GarrisonTable maps tile coordinates to defenders.
type GarrisonTable struct {
	cells map[int64]Garrison
}

func packCoord(x, y int) int64 {
	return int64(x)<<32 | int64(uint32(y))
}

// NewGarrisonTable builds an empty table.
func NewGarrisonTable() *GarrisonTable {
	return &GarrisonTable{cells: make(map[int64]Garrison)}
}

// Set stores or replaces a garrison at (x, y).
func (t *GarrisonTable) Set(x, y int, g Garrison) {
	if t == nil {
		return
	}
	t.cells[packCoord(x, y)] = g
}

// Get returns a garrison copy at (x, y), or nil if none.
func (t *GarrisonTable) Get(x, y int) *Garrison {
	if t == nil {
		return nil
	}
	g, ok := t.cells[packCoord(x, y)]
	if !ok || len(g.Troops) == 0 {
		return nil
	}
	cp := g
	cp.Troops = append([]march.TroopStack(nil), g.Troops...)
	return &cp
}

// ApplyRemaining overwrites defender troops after battle (zero count removes the tile).
func (t *GarrisonTable) ApplyRemaining(x, y int, troops []march.TroopStack) {
	if t == nil {
		return
	}
	key := packCoord(x, y)
	remaining := make([]march.TroopStack, 0, len(troops))
	for _, st := range troops {
		if st.Count > 0 {
			remaining = append(remaining, st)
		}
	}
	if len(remaining) == 0 {
		delete(t.cells, key)
		return
	}
	g := t.cells[key]
	g.Troops = remaining
	t.cells[key] = g
}

// M2FixtureGarrisons is the wave-4 minimal attack target: (5,5) field garrison.
func M2FixtureGarrisons() *GarrisonTable {
	t := NewGarrisonTable()
	t.Set(5, 5, Garrison{
		Troops: []march.TroopStack{
			{UnitCfgID: 1, Count: 120},
			{UnitCfgID: 3, Count: 40},
		},
		HeroLevel: 0,
		Morale:    1,
	})
	return t
}
