package api

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
)

func randomAuditID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "gm-audit-fallback"
	}
	return hex.EncodeToString(b[:])
}

func logGmOp(log *slog.Logger, op string, res GmOpResult, extra ...any) {
	if log == nil {
		log = slog.Default()
	}
	args := []any{
		"op", op,
		"audit_log_id", res.AuditLogID,
		"operator_id", res.Audit.OperatorID,
		"operator_name", res.Audit.OperatorName,
		"reason", res.Audit.Reason,
		"ticket_id", res.Audit.TicketID,
		"executed_at_ms", res.ExecutedAtMS,
	}
	args = append(args, extra...)
	log.Info("gm operation", args...)
}
