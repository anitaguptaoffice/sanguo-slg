package api

import (
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

// GmPlayerInfo is the lookup payload aligned with GmPlayerLookup proto.
type GmPlayerInfo struct {
	AccountID         int64
	AccountLogin      string
	AccountBanned     bool
	ServerID          int32
	PlayerID          int64
	DisplayName       string
	Level             int32
	Power             int64
	Wallet            content.ResourceWallet
	Online            bool
	ChatMutedUntilMS  int64
}

// GmOpResult carries audit fields written to structured logs.
type GmOpResult struct {
	AuditLogID   string
	ExecutedAtMS int64
	Audit        GmAudit
}

func newGmOpResult(audit GmAudit, now time.Time) GmOpResult {
	return GmOpResult{
		AuditLogID:   randomAuditID(),
		ExecutedAtMS: now.UnixMilli(),
		Audit:        audit,
	}
}
