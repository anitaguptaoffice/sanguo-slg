package quest

import "time"

// DB player_quest.state (spec/db).
const (
	StateUnaccepted  int16 = 0
	StateInProgress  int16 = 1
	StateClaimable   int16 = 2
	StateCompleted   int16 = 3
)

// PlayerQuestState mirrors sanguo.quest.v1.PlayerQuestState (wire values).
type PlayerQuestState int32

const (
	PlayerQuestStateUnspecified PlayerQuestState = 0
	PlayerQuestStateAvailable   PlayerQuestState = 1
	PlayerQuestStateInProgress  PlayerQuestState = 2
	PlayerQuestStateClaimable   PlayerQuestState = 3
	PlayerQuestStateCompleted   PlayerQuestState = 4
)

func ProtoStateFromDB(s int16, hasRow bool) PlayerQuestState {
	if !hasRow {
		return PlayerQuestStateAvailable
	}
	switch s {
	case StateUnaccepted:
		return PlayerQuestStateAvailable
	case StateInProgress:
		return PlayerQuestStateInProgress
	case StateClaimable:
		return PlayerQuestStateClaimable
	case StateCompleted:
		return PlayerQuestStateCompleted
	default:
		return PlayerQuestStateUnspecified
	}
}

// QuestChainState mirrors sanguo.quest.v1.QuestChainState.
type QuestChainState int32

const (
	QuestChainStateUnspecified QuestChainState = 0
	QuestChainStateLocked      QuestChainState = 1
	QuestChainStateInProgress  QuestChainState = 2
	QuestChainStateCompleted   QuestChainState = 3
)

// RewardItem aligns with common.v1.RewardItem / reward JSON items[].
type RewardItem struct {
	ItemCfgID int32
	Quantity  int32
}

// RewardBundle aligns with common.v1.RewardBundle and spec/rules/content.md JSON.
type RewardBundle struct {
	RewardPackID string
	Items        []RewardItem
	Resources    map[string]int64
}

// QuestCfg is a row from cfg_quest (plus M4 columns).
type QuestCfg struct {
	QuestCfgID      int32
	Code            string
	QuestType       int16
	ChainID         int32
	PrevQuestCfgID  int32
	SortInChain     int16
	Objectives      []Objective
	Rewards         RewardBundle
	UnlockLevel     int32
	Repeatable      bool
	NextQuestCfgID  int32 // derived from catalog
}

// Objective is one entry from cfg_quest.objectives JSON.
type Objective struct {
	Type            string
	BuildingCfgID   int32
	Level           int32
	Count           int32
	Resource        string
}

// ProgressCounter is stored in player_quest.progress JSON.
type ProgressCounter struct {
	Count int32 `json:"count"`
}

// PlayerQuestRow is player_quest persistence shape.
type PlayerQuestRow struct {
	ServerID        int32
	PlayerID        int64
	QuestCfgID      int32
	State           int16
	Progress        ProgressCounter
	AcceptedAt      *time.Time
	CompletedAt     *time.Time
	RewardClaimedAt *time.Time
	UpdatedAt       time.Time
}

// PlayerQuestProgress is the API view (quest.v1.PlayerQuestProgress).
type PlayerQuestProgress struct {
	QuestCfgID       int32
	QuestCode        string
	ChainID          int32
	ChainOrder       int32
	PrevQuestCfgID   int32
	NextQuestCfgID   int32
	State            PlayerQuestState
	ProgressCurrent  int32
	ProgressTarget   int32
	AcceptedAtMs     int64
	UpdatedAtMs      int64
	RewardPreview    RewardBundle
}

// QuestChainStatus mirrors quest.v1.QuestChainStatus.
type QuestChainStatus struct {
	ChainID                 int32
	ChainName               string
	ChainState              QuestChainState
	TotalQuestCount         int32
	CompletedQuestCount     int32
	ActiveQuestCfgID        int32
	NextAvailableQuestCfgID int32
}

// Actor identifies the player for RPC handlers.
type Actor struct {
	ServerID int32
	PlayerID int64
}
