package api

import (
	"context"
	"errors"

	apicommon "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content/mail"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
)

const (
	RouteListPlayerMail            = "content.v1.ListPlayerMail"
	RouteMarkPlayerMailRead        = "content.v1.MarkPlayerMailRead"
	RouteClaimPlayerMailAttachments = "content.v1.ClaimPlayerMailAttachments"
)

func (s *Server) handleListPlayerMail(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.mailSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "mail not wired"), nil
	}
	var req contentv1.ListPlayerMailRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	q := mail.ListQuery{
		Filter: mailInboxFilterFromProto(req.GetFilter()),
		Limit:  int(req.GetPageSize()),
		Offset: int(req.GetPageOffset()),
	}
	res, err := s.mailSvc.ListInbox(ctx, pc.ServerID, pc.PlayerID, q)
	if err != nil {
		return nil, err
	}
	out := make([]*contentv1.PlayerMail, 0, len(res.Mails))
	for _, m := range res.Mails {
		out = append(out, playerMailToProto(m))
	}
	data, err := marshal(&contentv1.ListPlayerMailResponse{Mails: out, TotalCount: int32(res.Total)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleMarkPlayerMailRead(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.mailSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "mail not wired"), nil
	}
	var req contentv1.MarkPlayerMailReadRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	row, err := s.mailSvc.MarkRead(ctx, pc.ServerID, pc.PlayerID, req.GetMailId())
	if err != nil {
		return mailErr(pkt.GetTraceId(), err), nil
	}
	data, err := marshal(&contentv1.MarkPlayerMailReadResponse{Mail: playerMailToProto(row)})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func (s *Server) handleClaimPlayerMailAttachments(ctx context.Context, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	pc, errPkt := s.playerCtx(ctx, pkt)
	if errPkt != nil {
		return errPkt, nil
	}
	if s.mailSvc == nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAVAILABLE, "mail not wired"), nil
	}
	var req contentv1.ClaimPlayerMailAttachmentsRequest
	if err := unmarshal(pkt.GetPayload(), &req); err != nil {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid payload"), nil
	}
	if req.GetServerId() != 0 && req.GetServerId() != pc.ServerID {
		return errResp(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_INVALID_PACKET, "server_id mismatch"), nil
	}
	res, err := s.mailSvc.ClaimAttachments(ctx, pc.ServerID, pc.PlayerID, req.GetMailId())
	if err != nil {
		return mailErr(pkt.GetTraceId(), err), nil
	}
	s.refreshDomesticWalletAfterCommit(ctx, pc.ServerID, pc.PlayerID)
	bag := make([]*contentv1.PlayerItemStack, 0, len(res.Grant.Bag))
	for _, st := range res.Grant.Bag {
		bag = append(bag, &contentv1.PlayerItemStack{ItemCfgId: st.ItemCfgID, Quantity: st.Quantity})
	}
	data, err := marshal(&contentv1.ClaimPlayerMailAttachmentsResponse{
		Mail:         playerMailToProto(res.Mail),
		Granted:      rewardPackageToProto(res.Mail.Attachments),
		WalletAfter:  resourceWalletToProto(res.Grant.Wallet),
		BagItems:     bag,
	})
	if err != nil {
		return nil, err
	}
	return okResp(pkt.GetTraceId(), data), nil
}

func mailInboxFilterFromProto(f contentv1.MailInboxFilter) mail.InboxFilter {
	switch f {
	case contentv1.MailInboxFilter_MAIL_INBOX_FILTER_UNREAD:
		return mail.FilterUnread
	case contentv1.MailInboxFilter_MAIL_INBOX_FILTER_READ:
		return mail.FilterRead
	default:
		return mail.FilterAll
	}
}

func playerMailToProto(m mail.Mail) *contentv1.PlayerMail {
	out := &contentv1.PlayerMail{
		MailId:      m.MailID,
		MailType:    int32(m.MailType),
		Title:       m.Title,
		Body:        m.Body,
		Status:      int32(m.Status),
		Attachments: rewardPackageToProto(m.Attachments),
		CreatedAtMs: m.CreatedAt.UnixMilli(),
	}
	if m.ReadAt != nil {
		out.ReadAtMs = m.ReadAt.UnixMilli()
	}
	if m.ClaimedAt != nil {
		out.ClaimedAtMs = m.ClaimedAt.UnixMilli()
	}
	return out
}

func rewardPackageToProto(pkg content.RewardPackage) *apicommon.RewardBundle {
	if len(pkg.Items) == 0 && len(pkg.Resources) == 0 {
		return nil
	}
	items := make([]*apicommon.RewardItem, 0, len(pkg.Items))
	for _, it := range pkg.Items {
		items = append(items, &apicommon.RewardItem{ItemCfgId: it.ItemCfgID, Quantity: it.Qty})
	}
	return &apicommon.RewardBundle{
		Items:     items,
		Resources: resourceWalletToProto(contentWalletFromQuest(pkg.Resources)),
	}
}

func mailErr(traceID string, err error) *commonv1.ServerPacket {
	switch {
	case errors.Is(err, mail.ErrNotFound), errors.Is(err, mail.ErrAlreadyDeleted):
		return errResp(traceID, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	case errors.Is(err, mail.ErrForbidden):
		return errResp(traceID, commonv1.ErrorCode_COMMON_UNAUTHORIZED, err.Error())
	case errors.Is(err, mail.ErrNoAttachments):
		return errResp(traceID, commonv1.ErrorCode_COMMON_INVALID_PACKET, err.Error())
	default:
		return errResp(traceID, commonv1.ErrorCode_COMMON_INTERNAL, err.Error())
	}
}
