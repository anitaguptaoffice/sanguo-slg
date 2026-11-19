package march

// LootItem is one awarded item stack.
type LootItem struct {
	ItemCfgID int32
	Count     int32
}

// LootRecord is the reward stored at arrival and credited at return.
type LootRecord struct {
	Food, Wood, Stone, Iron, Gold int64
	Items                         []LootItem
	HeroExp                       int64
}
