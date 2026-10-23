package content

// ItemType values align with spec/data/MAPPING.md (cfg_item.item_type).
const (
	ItemTypeResourcePack ItemType = 1
	ItemTypeSpeedup      ItemType = 2
	ItemTypeRecruit      ItemType = 3
	ItemTypeTrainTroop   ItemType = 4
)

type ItemType int16

// ItemDef is a row from cfg_item (loaded from seed).
type ItemDef struct {
	ID       int32
	Code     string
	Name     string
	Type     ItemType
	MaxStack int32
	Meta     map[string]any
}

// ResourceGrants is the effect of using a resource-pack consumable (item_type 1).
type ResourceGrants struct {
	Food  int64
	Wood  int64
	Stone int64
	Iron  int64
}

// SpeedupEffect is the effect of using a speedup consumable (item_type 2).
type SpeedupEffect struct {
	Seconds   int64
	AppliesTo []string
}

// PlayerRef identifies a player bag within a game server shard.
type PlayerRef struct {
	ServerID int32
	PlayerID int64
}

// Stack is one inventory row (maps to player_item).
type Stack struct {
	ItemCfgID int32
	Quantity  int32
}
