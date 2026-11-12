package api

import (
	"context"
	"errors"
	"sync"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
)

var errFirstCityHeadConflict = errors.New("first-city head conflict")

type memFirstCityLedger struct {
	mu    sync.Mutex
	head  map[firstCitySlotKey]*worldv1.FirstCityRecord
	byID  map[firstCitySlotKey]map[string]*worldv1.FirstCityRecord
}

func NewMemFirstCityLedger() *memFirstCityLedger {
	return &memFirstCityLedger{
		head: make(map[firstCitySlotKey]*worldv1.FirstCityRecord),
		byID: make(map[firstCitySlotKey]map[string]*worldv1.FirstCityRecord),
	}
}

func (l *memFirstCityLedger) Head(scope *worldv1.FirstCityScope) (*worldv1.FirstCityHead, error) {
	key, ok := slotKeyFromScope(scope)
	if !ok {
		return nil, errors.New("scope")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	rec := l.head[key]
	if rec == nil {
		return &worldv1.FirstCityHead{Value: &worldv1.FirstCityHead_Empty{Empty: &worldv1.FirstCityEmpty{}}}, nil
	}
	return &worldv1.FirstCityHead{Value: &worldv1.FirstCityHead_Command{Command: rec}}, nil
}

func (l *memFirstCityLedger) Record(scope *worldv1.FirstCityScope, commandID string) (*worldv1.FirstCityRecord, bool, error) {
	key, ok := slotKeyFromScope(scope)
	if !ok {
		return nil, false, errors.New("scope")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	slot := l.byID[key]
	if slot == nil {
		return nil, false, nil
	}
	rec, ok := slot[commandID]
	return rec, ok, nil
}

func (l *memFirstCityLedger) IntakePending(_ context.Context, scope *worldv1.FirstCityScope, record *worldv1.FirstCityRecord) error {
	if record == nil || record.GetCanonical() == nil || record.GetTemplate() == nil {
		return errors.New("record")
	}
	key, ok := slotKeyFromScope(scope)
	if !ok {
		return errors.New("scope")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if err := headAcceptsProposal(l.head[key], record.GetCanonical().GetProposal()); err != nil {
		return err
	}
	if l.byID[key] == nil {
		l.byID[key] = make(map[string]*worldv1.FirstCityRecord)
	}
	id := record.GetCanonical().GetProposal().GetCommandId()
	if prev, exists := l.byID[key][id]; exists {
		if protoEqualRecord(prev, record) {
			return nil
		}
		return errFirstCityHeadConflict
	}
	l.byID[key][id] = record
	l.head[key] = record
	return nil
}

func headAcceptsProposal(head *worldv1.FirstCityRecord, proposal *worldv1.FirstCityProposal) error {
	if proposal == nil || proposal.GetPredecessor() == nil {
		return errors.New("proposal")
	}
	if proposal.GetPredecessor().GetEmpty() != nil {
		if head != nil {
			return errFirstCityHeadConflict
		}
		return nil
	}
	rej := proposal.GetPredecessor().GetRejectedCommandId()
	if rej == "" {
		return errors.New("predecessor")
	}
	if head == nil || head.GetRejectedNoEffect() == nil {
		return errFirstCityHeadConflict
	}
	if head.GetCanonical().GetProposal().GetCommandId() != rej {
		return errFirstCityHeadConflict
	}
	return nil
}

// installTestRecord seeds ledger state for package tests only.
func (l *memFirstCityLedger) installTestRecord(scope *worldv1.FirstCityScope, record *worldv1.FirstCityRecord) {
	key, ok := slotKeyFromScope(scope)
	if !ok || record == nil || record.GetCanonical() == nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.byID[key] == nil {
		l.byID[key] = make(map[string]*worldv1.FirstCityRecord)
	}
	id := record.GetCanonical().GetProposal().GetCommandId()
	l.byID[key][id] = record
	l.head[key] = record
}

func protoEqualRecord(a, b *worldv1.FirstCityRecord) bool {
	if a == nil || b == nil || a.GetCanonical() == nil || b.GetCanonical() == nil {
		return false
	}
	return firstCityCanonicalBytesEqual(a.GetCanonical(), b.GetCanonical())
}
