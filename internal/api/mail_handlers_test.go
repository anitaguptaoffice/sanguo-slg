package api

import (
	"context"
	"testing"

	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content/mail"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

func TestMailGatewayHandlers(t *testing.T) {
	ctx := context.Background()
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	mailSvc := mail.NewService(mail.NewMemStore(), contentSvc, nil)
	sent, err := mailSvc.Send(ctx, 1, 42, mail.TypeReward, "奖", "领", content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: 2001, Qty: 1}},
	}, mail.SendAudit{})
	if err != nil {
		t.Fatal(err)
	}

	s := &Server{sessions: NewSessionRegistry(), mailSvc: mailSvc, contentSvc: contentSvc}
	s.sessions.Bind("sess-mail", PlayerContext{ServerID: 1, PlayerID: 42})

	listResp, err := s.handleListPlayerMail(ctx, &commonv1.ClientPacket{
		TraceId: "t-mail-list", SessionId: "sess-mail", ServerId: 1,
		Payload: mustProto(&contentv1.ListPlayerMailRequest{ServerId: 1, Filter: contentv1.MailInboxFilter_MAIL_INBOX_FILTER_UNREAD}),
	})
	if err != nil || listResp.Code != 0 {
		t.Fatalf("list: err=%v resp=%+v", err, listResp)
	}
	var listOut contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Fatal(err)
	}
	if len(listOut.GetMails()) != 1 {
		t.Fatalf("mails=%v", listOut.GetMails())
	}

	claimResp, err := s.handleClaimPlayerMailAttachments(ctx, &commonv1.ClientPacket{
		TraceId: "t-mail-claim", SessionId: "sess-mail", ServerId: 1,
		Payload: mustProto(&contentv1.ClaimPlayerMailAttachmentsRequest{ServerId: 1, MailId: sent.MailID}),
	})
	if err != nil || claimResp.Code != 0 {
		t.Fatalf("claim: err=%v resp=%+v", err, claimResp)
	}
	qty, _ := contentSvc.Get(content.PlayerRef{ServerID: 1, PlayerID: 42}, 2001)
	if qty != 1 {
		t.Fatalf("bag qty %d", qty)
	}
}
