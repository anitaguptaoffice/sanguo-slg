package mail

import (
	"context"
	"log/slog"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

// Service coordinates inbox queries and attachment grants.
type Service struct {
	store   Store
	content *content.Service
	log     *slog.Logger
	now     func() time.Time
}

// NewService wires dependencies. content may be nil for send-only GM CLI usage.
func NewService(store Store, contentSvc *content.Service, log *slog.Logger) *Service {
	if log == nil {
		log = slog.Default()
	}
	return &Service{
		store:   store,
		content: contentSvc,
		log:     log,
		now:     time.Now,
	}
}

// Send inserts a mail for one player (GM or system).
func (s *Service) Send(ctx context.Context, serverID int32, playerID int64, mailType int16, title, body string, attachments content.RewardPackage, audit SendAudit) (Mail, error) {
	mailID, err := s.store.NextMailID(ctx, serverID)
	if err != nil {
		return Mail{}, err
	}
	now := s.now()
	row := Mail{
		ServerID:    serverID,
		MailID:      mailID,
		PlayerID:    playerID,
		MailType:    mailType,
		Title:       title,
		Body:        body,
		Attachments: attachments,
		Status:      StatusUnread,
		CreatedAt:   now,
	}
	if err := s.store.Insert(ctx, row); err != nil {
		return Mail{}, err
	}
	if audit.OperatorID != "" {
		s.log.Info("mail sent",
			"server_id", serverID,
			"player_id", playerID,
			"mail_id", mailID,
			"mail_type", mailType,
			"operator_id", audit.OperatorID,
			"operator_name", audit.OperatorName,
			"reason", audit.Reason,
			"ticket_id", audit.TicketID,
		)
	}
	return row, nil
}

// ListInbox returns a paginated inbox view.
func (s *Service) ListInbox(ctx context.Context, serverID int32, playerID int64, q ListQuery) (ListResult, error) {
	return s.store.ListInbox(ctx, serverID, playerID, q)
}

// MarkRead marks one mail as read for the owning player.
func (s *Service) MarkRead(ctx context.Context, serverID int32, playerID int64, mailID int64) (Mail, error) {
	return s.store.MarkRead(ctx, serverID, playerID, mailID)
}

// ClaimResult is returned after claiming mail attachments.
type ClaimResult struct {
	Mail   Mail
	Grant  content.GrantResult
}

// ClaimAttachments grants mail attachments via CONTENT-002 and marks the mail claimed.
func (s *Service) ClaimAttachments(ctx context.Context, serverID int32, playerID int64, mailID int64) (ClaimResult, error) {
	if s.content == nil {
		return ClaimResult{}, ErrContentRequired
	}
	row, ok, err := s.store.Get(ctx, serverID, mailID)
	if err != nil {
		return ClaimResult{}, err
	}
	if !ok {
		return ClaimResult{}, ErrNotFound
	}
	if row.PlayerID != playerID {
		return ClaimResult{}, ErrForbidden
	}
	if row.Status == StatusDeleted {
		return ClaimResult{}, ErrAlreadyDeleted
	}
	if emptyPackage(row.Attachments) {
		return ClaimResult{}, ErrNoAttachments
	}
	key := IdempotencyKey(serverID, mailID)
	p := content.PlayerRef{ServerID: serverID, PlayerID: playerID}
	if err := s.content.LoadPlayer(ctx, p); err != nil {
		return ClaimResult{}, err
	}
	grant, err := s.content.Grant(p, row.Attachments, key)
	if err != nil {
		return ClaimResult{}, err
	}
	if row.Status != StatusClaimed {
		row, err = s.store.MarkClaimed(ctx, serverID, playerID, mailID)
		if err != nil {
			return ClaimResult{}, err
		}
	} else {
		updated, ok, err := s.store.Get(ctx, serverID, mailID)
		if err != nil {
			return ClaimResult{}, err
		}
		if ok {
			row = updated
		}
	}
	return ClaimResult{Mail: row, Grant: grant}, nil
}

func emptyPackage(pkg content.RewardPackage) bool {
	return len(pkg.Items) == 0 && len(pkg.Resources) == 0
}
