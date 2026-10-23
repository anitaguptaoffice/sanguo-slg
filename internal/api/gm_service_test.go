package api_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/account"
	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	"github.com/anitaguptaoffice/sanguo-slg/internal/chat"
	chatv1 "github.com/anitaguptaoffice/sanguo-slg/internal/chat/pb/sanguo/chat/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
)

func TestGmAuthorize(t *testing.T) {
	t.Setenv("GM_TOKEN", "secret")
	t.Setenv("GM_OPERATOR_WHITELIST", "op1")

	audit := api.GmAudit{OperatorID: "op1", OperatorName: "Tester", Reason: "unit test", TicketID: "T-1"}
	if err := api.AuthorizeGm("wrong", audit); err != api.ErrGmUnauthorized {
		t.Fatalf("expected unauthorized, got %v", err)
	}
	if err := api.AuthorizeGm("secret", audit); err != nil {
		t.Fatal(err)
	}
}

func TestGmSessionKickBinding(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		t.Fatal(err)
	}
	if err := db.SeedDevServer(ctx, pool, 1, "S1"); err != nil {
		t.Fatal(err)
	}

	accSvc := account.NewService(account.NewStore(pool))
	login := fmt.Sprintf("kick_%d", time.Now().UnixNano())
	accID, err := accSvc.Register(ctx, login, "secret")
	if err != nil {
		t.Fatal(err)
	}
	store := &api.PlayerStore{Pool: pool}
	playerID, err := store.EnsurePlayer(ctx, 1, accID, login)
	if err != nil {
		t.Fatal(err)
	}

	reg := api.NewSessionRegistry()
	reg.Bind("sess-a", api.PlayerContext{ServerID: 1, PlayerID: playerID, AccountID: accID})
	gm := api.NewGmService(nil, pool, reg, nil)
	audit := api.GmAudit{OperatorID: "op1", OperatorName: "Tester", Reason: "kick test", TicketID: "T-kick"}

	op, ok, err := gm.KickPlayer(ctx, "", audit, 1, playerID)
	if err != nil {
		t.Fatal(err)
	}
	if !ok || op.AuditLogID == "" {
		t.Fatalf("kick: ok=%v op=%+v", ok, op)
	}
	if reg.IsPlayerOnline(1, playerID) {
		t.Fatal("session binding should be cleared")
	}
}

func TestGmLookupAndGrant(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		t.Fatal(err)
	}
	if err := db.SeedDevServer(ctx, pool, 1, "S1"); err != nil {
		t.Fatal(err)
	}

	accSvc := account.NewService(account.NewStore(pool))
	login := fmt.Sprintf("gm_%d", time.Now().UnixNano())
	accID, err := accSvc.Register(ctx, login, "secret")
	if err != nil {
		t.Fatal(err)
	}
	store := &api.PlayerStore{Pool: pool}
	playerID, err := store.EnsurePlayer(ctx, 1, accID, login)
	if err != nil {
		t.Fatal(err)
	}

	audit := api.GmAudit{OperatorID: "gm-bot", OperatorName: "bot", Reason: "test", TicketID: "tk"}
	gm := api.NewGmService(nil, pool, nil, nil)

	_, info, err := gm.LookupPlayer(ctx, "", audit, 1, playerID, "")
	if err != nil {
		t.Fatal(err)
	}
	if info.AccountLogin != login || info.PlayerID != playerID {
		t.Fatalf("lookup: %+v", info)
	}

	pkg := content.RewardPackage{Resources: map[string]int64{"food": 500}}
	_, grant, err := gm.GrantReward(ctx, "", audit, 1, playerID, pkg, "gm:test:1")
	if err != nil {
		t.Fatal(err)
	}
	if grant.Wallet.Food < 500 {
		t.Fatalf("grant wallet: %+v", grant.Wallet)
	}
	_, grant2, err := gm.GrantReward(ctx, "", audit, 1, playerID, pkg, "gm:test:1")
	if err != nil || !grant2.Duplicate {
		t.Fatalf("duplicate grant: err=%v res=%+v", err, grant2)
	}
}

func TestGmMutePersistsAndBlocksChat(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		t.Fatal(err)
	}
	if err := db.SeedDevServer(ctx, pool, 1, "S1"); err != nil {
		t.Fatal(err)
	}

	accSvc := account.NewService(account.NewStore(pool))
	login := fmt.Sprintf("mute_%d", time.Now().UnixNano())
	accID, err := accSvc.Register(ctx, login, "secret")
	if err != nil {
		t.Fatal(err)
	}
	store := &api.PlayerStore{Pool: pool}
	playerID, err := store.EnsurePlayer(ctx, 1, accID, login)
	if err != nil {
		t.Fatal(err)
	}

	audit := api.GmAudit{OperatorID: "gm-bot", OperatorName: "bot", Reason: "mute test", TicketID: "tk-mute"}
	gm := api.NewGmService(nil, pool, nil, nil)
	until := time.Now().Add(2 * time.Hour).UnixMilli()

	_, muted, err := gm.MutePlayer(ctx, "", audit, 1, playerID, until)
	if err != nil || muted != until {
		t.Fatalf("mute: until=%d err=%v", muted, err)
	}
	_, info, err := gm.LookupPlayer(ctx, "", audit, 1, playerID, "")
	if err != nil || info.ChatMutedUntilMS != until {
		t.Fatalf("lookup mute: %+v err=%v", info, err)
	}

	chatSvc := chat.NewService(chat.NewPGStore(pool), store)
	actor := chat.Actor{ServerID: 1, PlayerID: playerID, DisplayName: login}
	_, err = chatSvc.Send(ctx, actor, &chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: "blocked",
	})
	if !errors.Is(err, chat.ErrPlayerMuted) {
		t.Fatalf("send while muted: err=%v", err)
	}

	_, muted, err = gm.MutePlayer(ctx, "", audit, 1, playerID, 0)
	if err != nil {
		t.Fatal(err)
	}
	if muted != 0 {
		t.Fatalf("unmute: %d", muted)
	}
	_, err = chatSvc.Send(ctx, actor, &chatv1.SendChatMessageRequest{
		Channel: chatv1.ChatChannel_CHAT_CHANNEL_WORLD,
		Content: "ok after unmute",
	})
	if err != nil {
		t.Fatalf("send after unmute: %v", err)
	}
}
