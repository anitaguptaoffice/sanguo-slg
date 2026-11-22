package combat

// March purpose codes (spec/db/004_military.sql march_order.purpose).
const (
	PurposeAttack = 1
	// PurposeScout observes a tile without fighting.
	PurposeScout = 2
	// PurposeLoot and PurposeOccupy still fight the tile's defenders.
	PurposeLoot   = 3
	PurposeOccupy = 4
)
