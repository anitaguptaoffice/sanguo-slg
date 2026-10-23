package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	contentv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/content/v1"
	shopv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/shop/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content/mail"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG020CfgHint = smokeINTG019CfgHint + "; INTG-020: ListShopShelf offer price_resources; ListPlayerMail unclaimed_attachment_count; GetCityState building slot_key+level"

// TestINTG020Wave23SmokePath extends INTG-019 with shop offer resource prices, mail unclaimed attachment count, and building level.
func TestINTG020Wave23SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-020 wave:23 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG020Wave23Smoke(t)
}

func runINTG020Wave23Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg020Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg020Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg020Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg020_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	smokeINTG020ListShopShelfOfferPricesGateway(t, c, sid, playerID)
	smokeINTG018GetHeroDetailLevelLoyaltyGateway(t, c, sid, playerID)

	marchID, cityID, wantToX, wantToY, departAtMs, arriveAtMs := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG015StartMarchTimestampsGateway(t, marchID, departAtMs, arriveAtMs)
	smokeINTG017ListMarchesGridGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	smokeINTG019ListMarchesPhaseGateway(t, c, sid, cityID, marchID)
	smokeINTG017ListBattleReportsTimeOutcomeGateway(t, c, sid, playerID)
	reportID := smokeINTG015ListBattleReportsPaginationGateway(t, c, sid, playerID)
	smokeINTG014GetBattleReportGateway(t, c, sid, playerID, reportID)
	smokeINTG018GetBattleReportRoundsGateway(t, c, sid, playerID, reportID)

	smokeINTG016ListPlayerMailPaginationGateway(t, c, sid, playerID)
	smokeINTG016GetCityStateBuildingsGateway(t, c, sid, playerID)
	smokeINTG020GetCityStateBuildingLevelGateway(t, c, sid, playerID)
	smokeINTG019GetCityStateResourcesProductionRatesGateway(t, c, sid, playerID)
	smokeINTG018ListPlayerCitiesGateway(t, c, sid, playerID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	smokeINTG011DailyTrainOrBuildMandatory(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG018ListPlayerQuestsChain400Gateway(t, c, sid, playerID)

	smokeINTG010DualLeaderboardGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG019ListGuildMembersGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG011DailyMarchOptional(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG012MailMarkReadGateway(t, ctx, c, pool, sid, playerID)
	smokeINTG020ListPlayerMailUnclaimedAttachmentGateway(t, ctx, c, pool, sid, playerID)
	mailGranted := smokeINTG013MailClaimAttachmentsGateway(t, ctx, c, pool, apiSrv, sid, playerID)
	smokeINTG014RecruitTroopListMarchesOptional(t, c, sid, cityID, marchID)

	want := intg009PersistSnapshot{intg008PersistSnapshot: ext, MarchID: marchID}
	if consumed2001 > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Bag2001 -= consumed2001
	}
	if speedupUsed > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Base.Bag2003 -= speedupUsed
	}
	if mailGranted > 0 {
		want.intg008PersistSnapshot.intg007PersistSnapshot.Bag2001 += mailGranted
	}

	ts.Close()
	_ = c.Close()

	pool2 := reopenDBPool(t)
	apiSrv2, ts2, wsURL2 := startData002SmokeGateway(t, log, pool2, worldStore)
	defer ts2.Close()

	c2 := dial(t, wsURL2)
	defer func() { _ = c2.Close() }()

	sid2, _ := smokeLoginOnly(t, c2, loginName)
	assertINTG009Persistence(t, ctx, pool2, apiSrv2, c2, sid2, playerID, want)
	runData002M3Subset(t, ctx, c2, apiSrv2, pool2, sid2, playerID)
}

// smokeINTG020ListShopShelfOfferPricesGateway logs first offer food/wood/iron/stone from price_resources (shop.v1.ListShopShelf ≡ ListShopOffers).
func smokeINTG020ListShopShelfOfferPricesGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-020 SHOP: gateway ListShopShelf offer price_resources")
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListShopShelf, TraceId: "i20-shop-list", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&shopv1.ListShopShelfRequest{ServerId: intg006ServerID}),
	})
	if resp.Code != 0 {
		intg020Failf(t, "list shop shelf", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out shopv1.ListShopShelfResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg020Failf(t, "decode list shop shelf", "player_id=%d err=%v", playerID, err)
	}
	offers := out.GetOffers()
	if len(offers) < 1 {
		intg020Failf(t, "list shop shelf offers", "player_id=%d empty offers", playerID)
	}
	first := offers[0]
	pr := first.GetPriceResources()
	var food, wood, iron, stone int64
	if pr != nil {
		food, wood, iron, stone = pr.GetFood(), pr.GetWood(), pr.GetIron(), pr.GetStone()
	}
	var gold int64
	if pr != nil {
		gold = pr.GetGold()
	}
	t.Logf("INTG-020: ListShopShelf first_offer_id=%d price_resources food=%d wood=%d iron=%d stone=%d gold=%d",
		first.GetOfferId(), food, wood, iron, stone, gold)
}

// smokeINTG020GetCityStateBuildingLevelGateway logs first building slot_key and level (CLIENT-082/088 upgrade preview).
func smokeINTG020GetCityStateBuildingLevelGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		intg020Failf(t, "get city state building level", "player_id=%d no player city", playerID)
	}
	smokeStep(t, fmt.Sprintf("INTG-020 DOM: gateway GetCityState city_id=%d first building slot_key+level", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	buildings := st.GetBuildings()
	if len(buildings) < 1 {
		intg020Failf(t, "get city state building level", "city_id=%d empty buildings", cityID)
	}
	first := buildings[0]
	t.Logf("INTG-020: GetCityState city_id=%d first_slot_key=%q first_level=%d building_cfg_id=%d",
		cityID, first.GetSlotKey(), first.GetLevel(), first.GetBuildingCfgId())
	if first.GetSlotKey() == "" {
		intg020Failf(t, "get city state building level", "city_id=%d first building missing slot_key", cityID)
	}
	if first.GetLevel() < 1 {
		intg020Failf(t, "get city state building level", "city_id=%d slot_key=%q level=%d want>=1", cityID, first.GetSlotKey(), first.GetLevel())
	}
}

// smokeINTG020ListPlayerMailUnclaimedAttachmentGateway seeds reward mail, lists inbox, logs total_count and unclaimed attachment rows.
func smokeINTG020ListPlayerMailUnclaimedAttachmentGateway(t *testing.T, ctx context.Context, c *websocket.Conn, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-020 MAIL: gm send-mail (unclaimed attachment probe)")
	mailSvc := mail.NewService(mail.NewPGStore(pool), nil, nil)
	sent, err := mailSvc.Send(ctx, intg006ServerID, playerID, mail.TypeReward, "intg-020-unclaimed", "unclaimed attachment smoke", content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: smokeItemRewardCfgID, Qty: 1}},
	}, mail.SendAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-020", TicketID: "T-i20-unclaimed"})
	if err != nil {
		intg020Failf(t, "gm send-mail unclaimed probe", "player_id=%d err=%v", playerID, err)
	}
	t.Logf("INTG-020: seeded mail_id=%d with attachments (not claimed in this step)", sent.MailID)

	const pageSize = 50
	smokeStep(t, fmt.Sprintf("INTG-020 MAIL: gateway ListPlayerMail total_count + unclaimed_attachment_count page_size=%d", pageSize))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i20-mail-unclaimed", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if listResp.Code != 0 {
		intg020Failf(t, "list player mail unclaimed", "player_id=%d code=%d msg=%s", playerID, listResp.Code, listResp.Msg)
	}
	var out contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(listResp.Data, &out); err != nil {
		intg020Failf(t, "decode list player mail unclaimed", "player_id=%d err=%v", playerID, err)
	}
	unclaimed := smokeINTG020CountMailsWithUnclaimedAttachments(out.GetMails())
	t.Logf("INTG-020: ListPlayerMail player_id=%d total_count=%d page_count=%d unclaimed_attachment_count=%d",
		playerID, out.GetTotalCount(), len(out.GetMails()), unclaimed)
	if unclaimed < 1 {
		intg020Failf(t, "list player mail unclaimed", "player_id=%d unclaimed_attachment_count=0 want>=1 (seed mail_id=%d)", playerID, sent.MailID)
	}
}

func smokeINTG020CountMailsWithUnclaimedAttachments(mails []*contentv1.PlayerMail) int {
	n := 0
	for _, m := range mails {
		if smokeINTG020MailHasUnclaimedAttachments(m) {
			n++
		}
	}
	return n
}

// Equivalent to client mailHasUnclaimedAttachments (has_unclaimed_attachments or attachments+status).
func smokeINTG020MailHasUnclaimedAttachments(m *contentv1.PlayerMail) bool {
	if m == nil {
		return false
	}
	if !smokeINTG020MailHasAttachments(m) {
		return false
	}
	if m.GetClaimedAtMs() > 0 {
		return false
	}
	return m.GetStatus() != int32(mail.StatusClaimed)
}

func smokeINTG020MailHasAttachments(m *contentv1.PlayerMail) bool {
	att := m.GetAttachments()
	if att == nil {
		return false
	}
	if len(att.GetItems()) > 0 {
		return true
	}
	res := att.GetResources()
	if res == nil {
		return false
	}
	return res.GetFood() > 0 || res.GetWood() > 0 || res.GetIron() > 0 || res.GetStone() > 0 || res.GetGold() > 0
}

func intg020Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG020CfgHint, step, fmt.Sprintf(format, args...))
}
