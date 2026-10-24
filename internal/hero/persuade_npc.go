package hero

// Persuade / lionize M1 constants (legacy HotelFunc.php; see spec/rules/legacy_alignment.md).
const (
	PersuadeItemCfgID       = 2004 // M1 stand-in for legacy 锦囊 gid=13
	PersuadeItemQty         = 1    // legacy 15
	PersuadeFriendDelta     = 10
	LionizeInitialFriend    = 10   // legacy LionizeHero friend=10
	LionizeHireFriendMin    = 30   // M1 delta; legacy PersuadeHero requires friend>=100
	PersuadeCooldownSeconds = 24 * 3600
)

// LionizeState mirrors legacy sys_lionize.state subset for M1.
const (
	LionizeStateNone        int16 = 0
	LionizeStateBefriended  int16 = 1
	LionizeStateRecruited   int16 = 2
)

// PersuadeNPCTarget is a seeded famous-general target (subset of DATA-002 templates).
type PersuadeNPCTarget struct {
	NpcCfgID      int32
	TemplateCfgID int32
	DisplayName   string
	Level         int32
}

// DefaultPersuadeTargets is the M1 NPC roster (npc_cfg_id == template_cfg_id).
func DefaultPersuadeTargets() []PersuadeNPCTarget {
	return []PersuadeNPCTarget{
		{NpcCfgID: 1001, TemplateCfgID: 1001, DisplayName: "刘备", Level: 40},
		{NpcCfgID: 1002, TemplateCfgID: 1002, DisplayName: "关羽", Level: 40},
		{NpcCfgID: 1003, TemplateCfgID: 1003, DisplayName: "张飞", Level: 40},
		{NpcCfgID: 1004, TemplateCfgID: 1004, DisplayName: "赵云", Level: 40},
	}
}

func findPersuadeTarget(npcCfgID int32) (PersuadeNPCTarget, bool) {
	for _, t := range DefaultPersuadeTargets() {
		if t.NpcCfgID == npcCfgID {
			return t, true
		}
	}
	return PersuadeNPCTarget{}, false
}

func lionizeGoldCost(level int32) int64 {
	if level < 1 {
		level = 1
	}
	return int64(level) * 500
}
