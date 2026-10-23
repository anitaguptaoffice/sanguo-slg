package quest

import "time"

// QuestTypeDaily is cfg_quest.quest_type for repeatable dailies (DATA-002 chain 400).
const QuestTypeDaily int16 = 2

// DailyChainID groups DATA-002 daily_* quests.
const DailyChainID int32 = 400

// StartOfUTCDay returns midnight UTC for the calendar day of t.
func StartOfUTCDay(t time.Time) time.Time {
	u := t.UTC()
	y, m, d := u.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// ShouldResetDailyQuest reports whether a stored daily row belongs to a prior server day.
func ShouldResetDailyQuest(cfg QuestCfg, row PlayerQuestRow, now time.Time) bool {
	if cfg.QuestType != QuestTypeDaily || !cfg.Repeatable {
		return false
	}
	if row.State == StateUnaccepted {
		return false
	}
	dayStart := StartOfUTCDay(now)
	anchor := row.UpdatedAt.UTC()
	if row.RewardClaimedAt != nil && row.RewardClaimedAt.UTC().After(anchor) {
		anchor = row.RewardClaimedAt.UTC()
	}
	return anchor.Before(dayStart)
}

// ResetDailyRow clears a prior-day daily so it can be accepted again.
func ResetDailyRow(row PlayerQuestRow, now time.Time) PlayerQuestRow {
	return PlayerQuestRow{
		ServerID:   row.ServerID,
		PlayerID:   row.PlayerID,
		QuestCfgID: row.QuestCfgID,
		State:      StateUnaccepted,
		Progress:   ProgressCounter{},
		UpdatedAt:  now,
	}
}
