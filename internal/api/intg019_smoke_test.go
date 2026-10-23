package api_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG019CfgHint = smokeINTG018CfgHint + "; INTG-019: GetCityState resources+production_rates; ListMarches phase; ListGuildMembers count"

// TestINTG019Wave22SmokePath extends INTG-018 with city resource balances, march phase, and guild member list.
func TestINTG019Wave22SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-019 wave:22 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG019Wave22Smoke(t)
}

func runINTG019Wave22Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg019Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg019Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg019Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg019_%d", time.Now().UnixNano())
	sid, playerID := smokeRegisterLogin(t, c, loginName)

	baseSnap := runData002M4Steps(t, ctx, c, apiSrv, pool, sid, playerID)
	ext := runINTG008DeepenSteps(t, ctx, c, apiSrv, pool, sid, playerID, baseSnap)
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

// smokeINTG019GetCityStateResourcesProductionRatesGateway logs wallet balances (resources) on the same line as production_rates.
func smokeINTG019GetCityStateResourcesProductionRatesGateway(t *testing.T, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	cityID := smokeFirstPlayerCityID(t, c, sid)
	if cityID == 0 {
		intg019Failf(t, "get city state resources", "player_id=%d no player city", playerID)
	}
	smokeStep(t, fmt.Sprintf("INTG-019 DOM: gateway GetCityState city_id=%d resources+production_rates", cityID))
	st := smokeGatewayGetCityState(t, c, sid, cityID)
	wallet := st.GetWallet()
	if wallet == nil {
		intg019Failf(t, "get city state resources", "city_id=%d missing wallet (resources) field", cityID)
	}
	rates := st.GetProductionRates()
	if rates == nil {
		intg019Failf(t, "get city state production_rates", "city_id=%d missing production_rates field", cityID)
	}
	resFood, resWood, resIron, resStone := wallet.GetFood(), wallet.GetWood(), wallet.GetIron(), wallet.GetStone()
	rateFood, rateWood, rateIron, rateStone := rates.GetFood(), rates.GetWood(), rates.GetIron(), rates.GetStone()
	t.Logf("INTG-019: GetCityState city_id=%d resources food=%d wood=%d iron=%d stone=%d | production_rates food=%d/h wood=%d/h iron=%d/h stone=%d/h",
		cityID, resFood, resWood, resIron, resStone, rateFood, rateWood, rateIron, rateStone)
	if rateFood == 0 && rateWood == 0 && rateIron == 0 && rateStone == 0 {
		t.Logf("INTG-019: production_rates all zero (dev empty city or no producer buildings — see tools/smoke/README.md)")
	}
}

// smokeINTG019ListMarchesPhaseGateway logs ListMarches first row phase and march_id (CLIENT-080/085 march phase read).
func smokeINTG019ListMarchesPhaseGateway(t *testing.T, c *websocket.Conn, sid string, cityID int64, marchID int64) {
	t.Helper()
	smokeStep(t, fmt.Sprintf("INTG-019 MIL: gateway ListMarches phase march_id=%d", marchID))
	listResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteListMarches, TraceId: "i19-phase", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&militaryv1.ListMarchesRequest{CityId: cityID, Limit: 20}),
	})
	if listResp.Code != 0 {
		intg019Failf(t, "list marches phase", "march_id=%d code=%d msg=%s", marchID, listResp.Code, listResp.Msg)
	}
	var listOut militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(listResp.Data, &listOut); err != nil {
		intg019Failf(t, "decode list marches phase", "err=%v", err)
	}
	if len(listOut.GetMarches()) < 1 {
		intg019Failf(t, "list marches phase", "march_id=%d empty list total=%d", marchID, listOut.GetTotal())
	}
	first := listOut.GetMarches()[0]
	if first.GetMarchId() != marchID {
		intg019Failf(t, "list marches phase", "first march_id=%d want=%d", first.GetMarchId(), marchID)
	}
	phase := first.GetPhase()
	t.Logf("INTG-019: ListMarches phase march_id=%d phase=%s phase_num=%d", first.GetMarchId(), phase.String(), int32(phase))
	if phase == militaryv1.MarchPhase_MARCH_PHASE_UNSPECIFIED {
		intg019Failf(t, "list marches phase", "march_id=%d phase unspecified", marchID)
	}
}

// smokeINTG019ListGuildMembersGateway lists guild members when the player has membership; otherwise skip with hint.
func smokeINTG019ListGuildMembersGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	var guildID int64
	err := pool.QueryRow(ctx, `SELECT guild_id FROM guild_member WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID).Scan(&guildID)
	if errors.Is(err, pgx.ErrNoRows) || guildID == 0 {
		t.Logf("INTG-019: skip ListGuildMembers (player not in guild — join guild via guild.v1.CreateGuild or JoinGuild; see tools/smoke/README.md)")
		return
	}
	if err != nil {
		intg019Failf(t, "lookup guild membership", "player_id=%d err=%v", playerID, err)
	}
	smokeStep(t, fmt.Sprintf("INTG-019 GUILD: gateway ListGuildMembers guild_id=%d", guildID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: guild.RouteListGuildMembers, TraceId: "i19-guild-members", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&guildv1.ListGuildMembersRequest{
			ServerId: intg006ServerID,
			GuildId:  guildID,
			Page:     1,
			PageSize: 50,
		}),
	})
	if resp.Code != 0 {
		intg019Failf(t, "list guild members", "guild_id=%d player_id=%d code=%d msg=%s", guildID, playerID, resp.Code, resp.Msg)
	}
	var out guildv1.ListGuildMembersResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg019Failf(t, "decode list guild members", "guild_id=%d err=%v", guildID, err)
	}
	members := out.GetMembers()
	t.Logf("INTG-019: ListGuildMembers guild_id=%d members_count=%d total_count=%d", guildID, len(members), out.GetTotalCount())
	if len(members) < 1 {
		intg019Failf(t, "list guild members", "guild_id=%d empty members", guildID)
	}
}

func intg019Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG019CfgHint, step, fmt.Sprintf(format, args...))
}
