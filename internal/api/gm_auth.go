package api

import (
	"crypto/subtle"
	"errors"
	"os"
	"strings"
)

// ErrGmUnauthorized is returned when the GM token or operator is not allowed.
var ErrGmUnauthorized = errors.New("gm: unauthorized")

// GmAudit holds operator metadata required by spec/proto/sanguo/gm/v1/gm.proto.
type GmAudit struct {
	OperatorID   string
	OperatorName string
	Reason       string
	TicketID     string
}

func (a GmAudit) validate() error {
	if strings.TrimSpace(a.OperatorID) == "" {
		return errors.New("gm: operator_id is required")
	}
	if strings.TrimSpace(a.Reason) == "" {
		return errors.New("gm: reason is required")
	}
	return nil
}

// AuthorizeGm checks GM_TOKEN (required when set) and optional GM_OPERATOR_WHITELIST.
func AuthorizeGm(token string, audit GmAudit) error {
	if err := audit.validate(); err != nil {
		return err
	}
	want := strings.TrimSpace(os.Getenv("GM_TOKEN"))
	if want != "" {
		if subtle.ConstantTimeCompare([]byte(strings.TrimSpace(token)), []byte(want)) != 1 {
			return ErrGmUnauthorized
		}
	}
	allow := strings.TrimSpace(os.Getenv("GM_OPERATOR_WHITELIST"))
	if allow == "" {
		return nil
	}
	for _, id := range strings.Split(allow, ",") {
		if strings.TrimSpace(id) == audit.OperatorID {
			return nil
		}
	}
	return ErrGmUnauthorized
}
