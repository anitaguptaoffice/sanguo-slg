package api

import (
	"context"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
)

type firstCitySlotKey struct {
	realm      string
	shard      int32
	player     int64
	account    int64
}

func slotKeyFromScope(scope *worldv1.FirstCityScope) (firstCitySlotKey, bool) {
	if scope == nil {
		return firstCitySlotKey{}, false
	}
	return firstCitySlotKey{
		realm: scope.GetRealmId(), shard: scope.GetServerId(),
		player: scope.GetPlayerId(), account: scope.GetAccountId(),
	}, true
}

// FirstCityV2Ledger is authoritative per-actor head and command history for wire reads/intake.
// SQL-backed implementations are a later card; nil on Server preserves #2542 UNAVAILABLE.
type FirstCityV2Ledger interface {
	Head(scope *worldv1.FirstCityScope) (*worldv1.FirstCityHead, error)
	Record(scope *worldv1.FirstCityScope, commandID string) (*worldv1.FirstCityRecord, bool, error)
	IntakePending(ctx context.Context, scope *worldv1.FirstCityScope, record *worldv1.FirstCityRecord) error
}

// FirstCityV2TemplateIntake selects the immutable template snapshot for first durable intake only.
type FirstCityV2TemplateIntake interface {
	SelectTemplate(ctx context.Context, scope *worldv1.FirstCityScope) (*worldv1.FirstCityTemplateRef, error)
}

func (s *Server) WireFirstCityV2Ledger(ledger FirstCityV2Ledger, intake FirstCityV2TemplateIntake) {
	s.firstCityV2Ledger = ledger
	s.firstCityV2Intake = intake
}
