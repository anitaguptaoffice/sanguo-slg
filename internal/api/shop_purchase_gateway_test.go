package api

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/shop"
	"github.com/jackc/pgx/v5"
	"google.golang.org/protobuf/proto"
)

func shopPacket(count, bodyServer int32) *commonv1.ClientPacket {
	return &commonv1.ClientPacket{Route: RoutePurchaseShopOffer, SessionId: "recruit", ServerId: 1, TraceId: "atomic-shop", Payload: mustProto(&shopv1.PurchaseShopOfferRequest{ServerId: bodyServer, OfferId: 1001, PurchaseCount: count})}
}

func TestShopAtomicGatewayPGSuccessAndCountDefault(t *testing.T) {
	for _, count := range []int32{0, -1, 2} {
		t.Run(string(rune('a'+count+1)), func(t *testing.T) {
			pool, s := atomicShopFixture(t)
			var events bytes.Buffer
			s.log = slog.New(slog.NewJSONHandler(&events, nil))
			resp := s.GatewayRouter().Dispatch(context.Background(), shopPacket(count, 1))
			reply := new(shopv1.PurchaseShopOfferResponse)
			if resp.Code != 0 {
				t.Fatalf("gateway %+v", resp)
			}
			if err := proto.Unmarshal(resp.Data, reply); err != nil {
				t.Fatal(err)
			}
			want := count
			if want <= 0 {
				want = 1
			}
			if reply.Offer.PurchasedCount != want || len(reply.GetGrantedItems().GetItems()) != 1 || reply.GetGrantedItems().GetItems()[0].Quantity != want || reply.WalletAfter.Gold != 500-int64(want)*10 {
				t.Fatalf("reply %+v", reply)
			}
			var n int
			if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM reward_grant_queue WHERE source_type='shop'`).Scan(&n); err != nil || n != 1 {
				t.Fatalf("atomic receipt %d %v", n, err)
			}
			if strings.Count(events.String(), `"event":"shop_purchase"`) != 1 {
				t.Fatalf("event %s", events.String())
			}
		})
	}
}

func TestShopAtomicGatewayPGRejectAndUnknownNoSuccessEvent(t *testing.T) {
	for _, kind := range []string{"body-shard", "envelope-shard", "missing-binding", "private-sql", "lost-commit"} {
		t.Run(kind, func(t *testing.T) {
			pool, s := atomicShopFixture(t)
			var events bytes.Buffer
			s.log = slog.New(slog.NewJSONHandler(&events, nil))
			packet := shopPacket(1, 1)
			switch kind {
			case "body-shard":
				packet = shopPacket(1, 2)
			case "envelope-shard":
				packet.ServerId = 2
			case "missing-binding":
				s.shopPurchase = nil
			case "private-sql":
				recruitSQL(t, pool, `ALTER TABLE player_shop_purchase RENAME TO private_missing_table`)
			case "lost-commit":
				begin := s.shopPurchase.begin
				s.shopPurchase.begin = func(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
					tx, err := begin(ctx, opts)
					if err != nil {
						return nil, err
					}
					return &recruitObservedTx{Tx: tx, afterCommit: func() error { return errors.New("private lost commit response") }}, nil
				}
			}
			resp := s.GatewayRouter().Dispatch(context.Background(), packet)
			if resp.Code == 0 || strings.Contains(resp.Msg, "private") || strings.Contains(events.String(), `"event":"shop_purchase"`) {
				t.Fatalf("unsafe outcome %+v %s", resp, events.String())
			}
			if kind == "lost-commit" || kind == "private-sql" {
				if resp.Code != int32(commonv1.ErrorCode_COMMON_INTERNAL) || !strings.Contains(resp.Msg, "outcome unavailable") {
					t.Fatalf("unknown %+v", resp)
				}
			}
			var gold int64
			if err := pool.QueryRow(context.Background(), `SELECT gold FROM player_wallet WHERE server_id=1 AND player_id=7`).Scan(&gold); err != nil {
				t.Fatal(err)
			}
			want := int64(500)
			if kind == "lost-commit" {
				want = 490
			}
			if gold != want {
				t.Fatalf("gold%d want%d", gold, want)
			}
		})
	}
}

func TestShopAtomicGatewayPGShelfReadFailsClosed(t *testing.T) {
	pool, s := atomicShopFixture(t)
	packet := &commonv1.ClientPacket{Route: RouteListShopShelf, SessionId: "recruit", ServerId: 1, Payload: mustProto(&shopv1.ListShopShelfRequest{ServerId: 1, ShelfId: 1})}
	resp := s.GatewayRouter().Dispatch(context.Background(), packet)
	if resp.Code != 0 {
		t.Fatalf("shelf %+v", resp)
	}
	recruitSQL(t, pool, `ALTER TABLE player_shop_offer_counter RENAME TO private_counter`)
	resp = s.GatewayRouter().Dispatch(context.Background(), packet)
	if resp.Code != int32(commonv1.ErrorCode_COMMON_UNAVAILABLE) || len(resp.Data) != 0 || strings.Contains(resp.Msg, "private") {
		t.Fatalf("failed read became data %+v", resp)
	}
}

func TestShopAtomicErrorMessagesAreFixed(t *testing.T) {
	for _, err := range []error{errors.New("private SQL secret"), errShopOutcome, shop.ErrInvalidPurchase, shop.ErrPurchaseLimitExceeded} {
		resp := shopErr("test", err)
		if resp.Code == 0 || strings.Contains(resp.Msg, "private") {
			t.Fatalf("message %+v", resp)
		}
	}
}
