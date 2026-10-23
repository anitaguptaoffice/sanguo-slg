package mail

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

func TestSendListClaimFlow(t *testing.T) {
	ctx := context.Background()
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	contentSvc := content.NewService(cat)
	store := NewMemStore()
	svc := NewService(store, contentSvc, nil)

	pkg := content.RewardPackage{Items: []content.RewardItem{{ItemCfgID: 2001, Qty: 2}}}
	sent, err := svc.Send(ctx, 1, 42, TypeReward, "奖励", "请领取", pkg, SendAudit{OperatorID: "gm", Reason: "test"})
	if err != nil || sent.MailID == 0 {
		t.Fatalf("send: %v mail=%+v", err, sent)
	}

	unread, err := svc.ListInbox(ctx, 1, 42, ListQuery{Filter: FilterUnread, Limit: 10})
	if err != nil || len(unread.Mails) != 1 || unread.Total != 1 {
		t.Fatalf("unread list: err=%v %+v", err, unread)
	}

	readList, err := svc.ListInbox(ctx, 1, 42, ListQuery{Filter: FilterRead, Limit: 10})
	if err != nil || len(readList.Mails) != 0 {
		t.Fatalf("read list should be empty: %+v", readList)
	}

	claim, err := svc.ClaimAttachments(ctx, 1, 42, sent.MailID)
	if err != nil {
		t.Fatalf("claim: %v", err)
	}
	if claim.Mail.Status != StatusClaimed {
		t.Fatalf("status %d", claim.Mail.Status)
	}
	qty, _ := contentSvc.Get(content.PlayerRef{ServerID: 1, PlayerID: 42}, 2001)
	if qty != 2 {
		t.Fatalf("bag qty %d", qty)
	}

	dup, err := svc.ClaimAttachments(ctx, 1, 42, sent.MailID)
	if err != nil || !dup.Grant.Duplicate {
		t.Fatalf("duplicate claim: err=%v dup=%v", err, dup.Grant.Duplicate)
	}
	qty, _ = contentSvc.Get(content.PlayerRef{ServerID: 1, PlayerID: 42}, 2001)
	if qty != 2 {
		t.Fatalf("duplicate must not stack items: %d", qty)
	}

	readList, err = svc.ListInbox(ctx, 1, 42, ListQuery{Filter: FilterRead, Limit: 10})
	if err != nil || len(readList.Mails) != 1 {
		t.Fatalf("read list after claim: %+v err=%v", readList, err)
	}
}

func TestMarkRead(t *testing.T) {
	ctx := context.Background()
	store := NewMemStore()
	svc := NewService(store, nil, nil)
	sent, err := svc.Send(ctx, 1, 7, TypeSystem, "通知", "正文", content.RewardPackage{}, SendAudit{})
	if err != nil {
		t.Fatal(err)
	}
	row, err := svc.MarkRead(ctx, 1, 7, sent.MailID)
	if err != nil || row.Status != StatusRead {
		t.Fatalf("mark read: err=%v status=%d", err, row.Status)
	}
}
