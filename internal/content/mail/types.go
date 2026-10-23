package mail

import (
	"fmt"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

// Status values align with player_mail.status (spec/db/m4_003_mail_reward.sql).
const (
	StatusUnread  int16 = 0
	StatusRead    int16 = 1
	StatusClaimed int16 = 2
	StatusDeleted int16 = 3
)

// MailType values align with player_mail.mail_type.
const (
	TypeSystem         int16 = 1
	TypeReward         int16 = 2
	TypeAnnouncement   int16 = 3
)

// InboxFilter selects which non-deleted mails appear in a list query.
type InboxFilter int16

const (
	FilterAll    InboxFilter = 0
	FilterUnread InboxFilter = 1
	FilterRead   InboxFilter = 2
)

// Mail is one player_mail row.
type Mail struct {
	ServerID    int32
	MailID      int64
	PlayerID    int64
	MailType    int16
	Title       string
	Body        string
	Attachments content.RewardPackage
	Status      int16
	ExpireAt    *time.Time
	CreatedAt   time.Time
	ReadAt      *time.Time
	ClaimedAt   *time.Time
}

// ListQuery paginates inbox results.
type ListQuery struct {
	Filter InboxFilter
	Limit  int
	Offset int
}

// ListResult is a page of mails plus total matching rows.
type ListResult struct {
	Mails []Mail
	Total int
}

// SendAudit is operator metadata for GM-issued mail (logged, not stored on player_mail).
type SendAudit struct {
	OperatorID   string
	OperatorName string
	Reason       string
	TicketID     string
}

// IdempotencyKey returns the CONTENT-002 grant idempotency key for a mail attachment claim.
func IdempotencyKey(serverID int32, mailID int64) string {
	return fmt.Sprintf("mail:%d:%d", serverID, mailID)
}
