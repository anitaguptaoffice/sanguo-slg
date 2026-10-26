package quest

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// MemStore is an in-memory Store for unit tests.
type MemStore struct {
	mu   sync.Mutex
	rows map[string]PlayerQuestRow
}

// NewMemStore creates an empty quest progress store.
func NewMemStore() *MemStore {
	return &MemStore{rows: make(map[string]PlayerQuestRow)}
}

func questKey(serverID int32, playerID int64, questCfgID int32) string {
	return fmt.Sprintf("%d:%d:%d", serverID, playerID, questCfgID)
}

func (m *MemStore) GetPlayerQuest(_ context.Context, serverID int32, playerID int64, questCfgID int32) (PlayerQuestRow, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	row, ok := m.rows[questKey(serverID, playerID, questCfgID)]
	if ok {
		if err := validateProof(row); err != nil {
			return PlayerQuestRow{}, false, err
		}
	}
	return cloneQuestRow(row), ok, nil
}

func (m *MemStore) ListPlayerQuests(_ context.Context, serverID int32, playerID int64) ([]PlayerQuestRow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []PlayerQuestRow
	prefix := fmt.Sprintf("%d:%d:", serverID, playerID)
	for k, row := range m.rows {
		if len(k) > len(prefix) && k[:len(prefix)] == prefix {
			if err := validateProof(row); err != nil {
				return nil, err
			}
			out = append(out, cloneQuestRow(row))
		}
	}
	return out, nil
}

func (m *MemStore) UpsertPlayerQuest(_ context.Context, row PlayerQuestRow) error {
	return m.upsertPlayerQuest(row, false)
}

func (m *MemStore) verifyLegacyWall(_ context.Context, actor Actor, now time.Time) error {
	return m.upsertPlayerQuest(legacyWallProposal(actor, now), true)
}

func (m *MemStore) upsertPlayerQuest(row PlayerQuestRow, legacy bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := validateProof(row); err != nil {
		return err
	}
	key := questKey(row.ServerID, row.PlayerID, row.QuestCfgID)
	if isTutorialID(row.QuestCfgID) {
		var err error
		row, err = mergeTutorialRow(m.rows[key], row)
		if err != nil {
			return err
		}
	}
	if row.QuestCfgID == 1006 {
		var err error
		row, err = mergeWallRow(m.rows[key], row, legacy)
		if err != nil {
			return err
		}
	}
	m.rows[key] = cloneQuestRow(row)
	return nil
}
