package api

import (
	"context"
	"testing"

	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

func TestContentBagGatewayHandlers(t *testing.T) {
	cat, err := content.EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	svc := content.NewService(cat)
	p := content.PlayerRef{ServerID: 1, PlayerID: 42}
	if _, err := svc.Add(p, 2001, 2); err != nil {
		t.Fatal(err)
	}

	s := &Server{
		sessions:   NewSessionRegistry(),
		contentSvc: svc,
	}
	s.sessions.Bind("sess-1", PlayerContext{ServerID: 1, PlayerID: 42})

	listPkt := &commonv1.ClientPacket{
		TraceId:   "t-list",
		SessionId: "sess-1",
		ServerId:  1,
		Payload:   mustProto(&contentv1.ListPlayerBagRequest{ServerId: 1}),
	}
	listResp, err := s.handleListPlayerBag(context.Background(), listPkt)
	if err != nil || listResp.Code != 0 {
		t.Fatalf("list: err=%v resp=%+v", err, listResp)
	}
	var listOut contentv1.ListPlayerBagResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		t.Fatal(err)
	}
	if len(listOut.GetItems()) != 1 || listOut.GetItems()[0].GetQuantity() != 2 {
		t.Fatalf("list items=%v", listOut.GetItems())
	}

	usePkt := &commonv1.ClientPacket{
		TraceId:   "t-use",
		SessionId: "sess-1",
		ServerId:  1,
		Payload:   mustProto(&contentv1.UseConsumableRequest{ServerId: 1, ItemCfgId: 2001, Count: 1}),
	}
	useResp, err := s.handleUseConsumable(context.Background(), usePkt)
	if err != nil || useResp.Code != 0 {
		t.Fatalf("use: err=%v resp=%+v", err, useResp)
	}
	var useOut contentv1.UseConsumableResponse
	if err := proto.Unmarshal(useResp.Data, &useOut); err != nil {
		t.Fatal(err)
	}
	if useOut.GetRemaining() != 1 || useOut.GetWalletAfter().GetFood() != 1000 {
		t.Fatalf("use out=%+v", useOut)
	}
	if useOut.GetEffectSummary() == "" {
		t.Fatal("expected effect summary")
	}
}

func mustProto(msg proto.Message) []byte {
	b, err := proto.Marshal(msg)
	if err != nil {
		panic(err)
	}
	return b
}
