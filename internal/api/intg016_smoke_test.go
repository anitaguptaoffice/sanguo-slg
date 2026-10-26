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
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

const smokeINTG016CfgHint = smokeINTG015CfgHint + "; INTG-016: ListPlayerHeroes+GetHeroDetail; ListPlayerMail page_size=5; GetCityState buildings upgrade_finish_at_ms"

// TestINTG016Wave19SmokePath extends INTG-015 with hero detail, mail inbox pagination, and city building queue fields.
func TestINTG016Wave19SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-016 wave:19 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG016Wave19Smoke(t)
}

func runINTG016Wave19Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg016Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg016Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg016Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg016_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
	smokeINTG016ListPlayerHeroesGetHeroDetailGateway(t, c, sid, playerID)

	marchID, cityID, wantToX, wantToY, departAtMs, arriveAtMs := smokeStartMarchListMarchesGateway(t, c, apiSrv, sid, playerID)
	smokeINTG015StartMarchTimestampsGateway(t, marchID, departAtMs, arriveAtMs)
	smokeINTG014ListMarchesDestinationGateway(t, c, sid, cityID, marchID, wantToX, wantToY)
	reportID := smokeINTG015ListBattleReportsPaginationGateway(t, c, sid, playerID)
	smokeINTG014GetBattleReportGateway(t, c, sid, playerID, reportID)

	smokeINTG016ListPlayerMailPaginationGateway(t, c, sid, playerID)
	smokeINTG016GetCityStateBuildingsGateway(t, c, sid, playerID)

	speedupUsed := smokeINTG011BuildSpeedupGateway(t, ctx, c, apiSrv, sid, playerID)
	ext.Base.Bag2003 += smokeINTG011DailyTrainOrBuildMandatory(t, ctx, c, apiSrv, pool, sid, playerID)

	ext.Base.Gold = smokeINTG010DualLeaderboardGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG011DailyMarchOptional(t, ctx, c, apiSrv, pool, sid, playerID)
	smokeINTG012MailMarkReadGateway(t, ctx, c, pool, sid, playerID)
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

// smokeINTG016ListPlayerHeroesGetHeroDetailGateway lists heroes and loads detail for the first hero_id.
func smokeINTG016ListPlayerHeroesGetHeroDetailGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-016 HERO: gateway ListPlayerHeroes")
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerHeroes, TraceId: "i16-heroes", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.ListPlayerHeroesRequest{ServerId: intg006ServerID}),
	})
	if listResp.Code != 0 {
		intg016Failf(t, "list player heroes", "player_id=%d code=%d msg=%s", playerID, listResp.Code, listResp.Msg)
	}
	var listOut herov1.ListPlayerHeroesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg016Failf(t, "decode hero list", "player_id=%d err=%v", playerID, err)
	}
	if len(listOut.GetHeroes()) == 0 {
		intg016Failf(t, "list player heroes", "player_id=%d empty heroes total_count=%d", playerID, listOut.GetTotalCount())
	}
	first := listOut.GetHeroes()[0]
	heroID := first.GetHeroId()
	if heroID == 0 {
		intg016Failf(t, "list player heroes", "player_id=%d first row missing hero_id", playerID)
	}
	t.Logf("INTG-016: ListPlayerHeroes player_id=%d total_count=%d count=%d first_hero_id=%d",
		playerID, listOut.GetTotalCount(), len(listOut.GetHeroes()), heroID)

	smokeStep(t, fmt.Sprintf("INTG-016 HERO: gateway GetHeroDetail hero_id=%d", heroID))
	detailResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetHeroDetail, TraceId: "i16-hero-detail", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.GetHeroDetailRequest{ServerId: intg006ServerID, HeroId: heroID}),
	})
	if detailResp.Code != 0 {
		intg016Failf(t, "get hero detail", "hero_id=%d code=%d msg=%s", heroID, detailResp.Code, detailResp.Msg)
	}
	var detailOut herov1.GetHeroDetailResponse
	if err := proto.Unmarshal(detailResp.Data, &detailOut); err != nil {
		intg016Failf(t, "decode hero detail", "hero_id=%d err=%v", heroID, err)
	}
	if detailOut.GetHeroId() != heroID {
		intg016Failf(t, "get hero detail", "hero_id=%d response hero_id=%d", heroID, detailOut.GetHeroId())
	}
	if detailOut.GetTemplateCfgId() == 0 {
		intg016Failf(t, "get hero detail", "hero_id=%d missing template_cfg_id", heroID)
	}
	attrs := detailOut.GetAttributes()
	if attrs == nil {
		intg016Failf(t, "get hero detail", "hero_id=%d missing attributes", heroID)
	}
	t.Logf("INTG-016: GetHeroDetail ok hero_id=%d template_cfg_id=%d force=%d intel=%d politics=%d command=%d",
		heroID, detailOut.GetTemplateCfgId(), attrs.GetForce(), attrs.GetIntel(), attrs.GetPolitics(), attrs.GetCommand())
}

// smokeINTG016ListPlayerMailPaginationGateway pages mail with page_size=5 page_offset=0 then offset=page size.
func smokeINTG016ListPlayerMailPaginationGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	const pageSize = int32(5)
	smokeStep(t, fmt.Sprintf("INTG-016 MAIL: gateway ListPlayerMail page_size=%d page_offset=0", pageSize))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i16-mail-page1", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: 0,
		}),
	})
	if resp.Code != 0 {
		intg016Failf(t, "list player mail page1", "player_id=%d code=%d msg=%s", playerID, resp.Code, resp.Msg)
	}
	var out contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg016Failf(t, "decode mail list page1", "player_id=%d err=%v", playerID, err)
	}
	pageCount := int32(len(out.GetMails()))
	t.Logf("INTG-016: ListPlayerMail page1 player_id=%d total_count=%d count=%d", playerID, out.GetTotalCount(), pageCount)
	if pageCount > pageSize {
		intg016Failf(t, "list player mail page1", "player_id=%d count=%d exceeds page_size=%d", playerID, pageCount, pageSize)
	}

	smokeStep(t, fmt.Sprintf("INTG-016 MAIL: gateway ListPlayerMail page_size=%d page_offset=%d", pageSize, pageCount))
	resp2 := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListPlayerMail, TraceId: "i16-mail-page2", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&contentv1.ListPlayerMailRequest{
			ServerId:   intg006ServerID,
			Filter:     contentv1.MailInboxFilter_MAIL_INBOX_FILTER_ALL,
			PageSize:   pageSize,
			PageOffset: pageCount,
		}),
	})
	if resp2.Code != 0 {
		intg016Failf(t, "list player mail page2", "player_id=%d page_offset=%d code=%d msg=%s", playerID, pageCount, resp2.Code, resp2.Msg)
	}
	var out2 contentv1.ListPlayerMailResponse
	if err := proto.Unmarshal(resp2.Data, &out2); err != nil {
		intg016Failf(t, "decode mail list page2", "player_id=%d page_offset=%d err=%v", playerID, pageCount, err)
	}
	page2Count := int32(len(out2.GetMails()))
	if page2Count > pageSize {
		intg016Failf(t, "list player mail page2", "page_offset=%d count=%d exceeds page_size=%d", pageCount, page2Count, pageSize)
	}
	t.Logf("INTG-016: ListPlayerMail page2 page_offset=%d count=%d total_count=%d", pageCount, page2Count, out2.GetTotalCount())
}

// smokeINTG016GetCityStateBuildingsGateway logs building count and first row upgrade_finish_at_ms (0 = idle).
func smokeINTG016GetCityStateBuildingsGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		intg016Failf(t, "get city state", "player_id=%d no player city", playerID)
	}
	smokeStep(t, fmt.Sprintf("INTG-016 DOM: gateway GetCityState city_id=%d buildings probe", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	buildings := st.GetBuildings()
	var firstFinish int64
	if len(buildings) > 0 {
		firstFinish = buildings[0].GetUpgradeFinishAtMs()
	}
	t.Logf("INTG-016: GetCityState city_id=%d buildings_count=%d first_upgrade_finish_at_ms=%d (0=idle)",
		cityID, len(buildings), firstFinish)
	if len(buildings) == 0 {
		intg016Failf(t, "get city state buildings", "city_id=%d empty buildings", cityID)
	}
}

func intg016Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG016CfgHint, step, fmt.Sprintf(format, args...))
}
