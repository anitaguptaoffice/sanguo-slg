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
	herov1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/hero/v1"
	rankv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/rank/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/anitaguptaoffice/sanguo-slg/internal/guild"
	guildv1 "github.com/anitaguptaoffice/sanguo-slg/internal/guild/pb/sanguo/guild/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/hero"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

const smokeINTG021CfgHint = smokeINTG020CfgHint + "; INTG-021: GetLeaderboard my_rank+my_score (power+resource); ListGuildMembers first role; optional RecruitHero"

// TestINTG021Wave24SmokePath extends INTG-020 with dual leaderboard self-rank/score, guild member role, and optional recruit hero.
func TestINTG021Wave24SmokePath(t *testing.T) {
	if testing.Short() {
		t.Skip("INTG-021 wave:24 smoke skipped in -short mode (see tools/smoke/README.md)")
	}
	runINTG021Wave24Smoke(t)
}

func runINTG021Wave24Smoke(t *testing.T) {
	pool := openDB(t)
	ctx := context.Background()
	root := runtime.RepoRoot()
	if err := db.ApplySpecs(ctx, pool, root+"/spec/db"); err != nil {
		intg021Failf(t, "apply spec/db", "err=%v", err)
	}
	if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
		intg021Failf(t, "seed dev server", "err=%v", err)
	}
	applyData002CoreSubsetSeeds(t, ctx, pool)

	worldStore := world.NewPGStore(pool)
	if err := world.InitServerMap(ctx, worldStore, intg006ServerID); err != nil {
		intg021Failf(t, "init server map", "err=%v", err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiSrv, ts, wsURL := startData002SmokeGateway(t, log, pool, worldStore)
	defer ts.Close()

	c := dial(t, wsURL)
	defer func() { _ = c.Close() }()

	loginName := fmt.Sprintf("intg021_%d", time.Now().UnixNano())
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

	smokeINTG021DualLeaderboardMyRankScoreGateway(t, ctx, c, apiSrv, pool, sid, playerID)
	consumed2001 := smokeINTG010UseConsumableGateway(t, c, sid)
	smokeINTG010SocialOptional(t, c, sid)
	smokeINTG021ListGuildMembersRoleGateway(t, ctx, pool, c, sid, playerID)
	smokeINTG021RecruitHeroOptional(t, ctx, c, apiSrv, sid, playerID)
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

// smokeINTG021DualLeaderboardMyRankScoreGateway refreshes power and resource boards and logs my_rank + my_score for each.
func smokeINTG021DualLeaderboardMyRankScoreGateway(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, pool *pgxpool.Pool, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-021 RANK: seed power + RefreshRanks for PLAYER_POWER leaderboard")
	_, err := pool.Exec(ctx, `UPDATE player SET power = 3200 WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg021Failf(t, "seed power for leaderboard", "err=%v", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		intg021Failf(t, "refresh ranks power", "err=%v", err)
	}
	smokeINTG021AssertLeaderboardMyRankScore(t, c, sid, rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_POWER, playerID)

	smokeStep(t, "INTG-021 RANK: seed wallet + RefreshRanks for PLAYER_RESOURCE leaderboard")
	_, err = pool.Exec(ctx, `
		UPDATE player_wallet SET food = 8000, wood = 7000, iron = 1000, stone = 500, gold = 0
		WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID)
	if err != nil {
		intg021Failf(t, "seed wallet for resource rank", "err=%v", err)
	}
	if err := apiSrv.RefreshRanks(ctx); err != nil {
		intg021Failf(t, "refresh ranks resource", "err=%v", err)
	}
	smokeINTG021AssertLeaderboardMyRankScore(t, c, sid, rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE, playerID)
}

func smokeINTG021AssertLeaderboardMyRankScore(t *testing.T, c *websocket.Conn, sid string, lbType rankv1.LeaderboardType, viewerPlayerID int64) {
	t.Helper()
	trace := "i21-rank-power"
	typeLabel := "PLAYER_POWER"
	if lbType == rankv1.LeaderboardType_LEADERBOARD_TYPE_PLAYER_RESOURCE {
		trace = "i21-rank-resource"
		typeLabel = "PLAYER_RESOURCE"
	}
	smokeStep(t, fmt.Sprintf("INTG-021 RANK: gateway GetLeaderboard type=%s my_rank+my_score", typeLabel))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteGetLeaderboard, TraceId: trace, SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&rankv1.GetLeaderboardRequest{
			ServerId: intg006ServerID,
			Type:     lbType,
			Page:     1,
			PageSize: 20,
		}),
	})
	if resp.Code != 0 {
		intg021Failf(t, "get leaderboard", "type=%s code=%d msg=%s", typeLabel, resp.Code, resp.Msg)
	}
	var out rankv1.GetLeaderboardResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg021Failf(t, "decode leaderboard", "type=%s err=%v", typeLabel, err)
	}
	myRank := out.GetMyRank()
	myScore := out.GetMyScore()
	t.Logf("INTG-021: GetLeaderboard type=%s total_count=%d my_rank=%d my_score=%d viewer_player_id=%d",
		typeLabel, out.GetTotalCount(), myRank, myScore, viewerPlayerID)
	if out.GetTotalCount() < 1 || len(out.GetEntries()) == 0 {
		t.Logf("INTG-021: dev empty leaderboard type=%s — my_rank=%d hint only (RefreshRanks / make dev-up); see tools/smoke/README.md", typeLabel, myRank)
		return
	}
	if myRank == 0 {
		intg021Failf(t, "leaderboard my_rank", "type=%s viewer_player_id=%d total=%d my_rank=0 want>0", typeLabel, viewerPlayerID, out.GetTotalCount())
	}
	for i, row := range out.GetEntries() {
		if row.GetEntityId() == 0 {
			intg021Failf(t, "leaderboard entry entity_id", "type=%s index=%d rank=%d", typeLabel, i, row.GetRank())
		}
	}
}

// smokeINTG021ListGuildMembersRoleGateway logs first member GuildMemberRole when the player is in a guild.
func smokeINTG021ListGuildMembersRoleGateway(t *testing.T, ctx context.Context, pool *pgxpool.Pool, c *websocket.Conn, sid string, playerID int64) {
	t.Helper()
	var guildID int64
	err := pool.QueryRow(ctx, `SELECT guild_id FROM guild_member WHERE server_id = $1 AND player_id = $2`, intg006ServerID, playerID).Scan(&guildID)
	if errors.Is(err, pgx.ErrNoRows) || guildID == 0 {
		t.Logf("INTG-021: skip ListGuildMembers role (player not in guild — join guild via guild.v1.CreateGuild or INTG-010 optional social; see tools/smoke/README.md)")
		return
	}
	if err != nil {
		intg021Failf(t, "lookup guild membership", "player_id=%d err=%v", playerID, err)
	}
	smokeStep(t, fmt.Sprintf("INTG-021 GUILD: gateway ListGuildMembers guild_id=%d first member role", guildID))
	resp := mustSend(t, c, &commonv1.ClientPacket{
		Route: guild.RouteListGuildMembers, TraceId: "i21-guild-role", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&guildv1.ListGuildMembersRequest{
			ServerId: intg006ServerID,
			GuildId:  guildID,
			Page:     1,
			PageSize: 50,
		}),
	})
	if resp.Code != 0 {
		intg021Failf(t, "list guild members", "guild_id=%d player_id=%d code=%d msg=%s", guildID, playerID, resp.Code, resp.Msg)
	}
	var out guildv1.ListGuildMembersResponse
	if err := proto.Unmarshal(resp.Data, &out); err != nil {
		intg021Failf(t, "decode list guild members", "guild_id=%d err=%v", guildID, err)
	}
	members := out.GetMembers()
	t.Logf("INTG-019: ListGuildMembers guild_id=%d members_count=%d total_count=%d", guildID, len(members), out.GetTotalCount())
	if len(members) < 1 {
		intg021Failf(t, "list guild members", "guild_id=%d empty members", guildID)
	}
	first := members[0]
	role := first.GetRole()
	t.Logf("INTG-021: ListGuildMembers guild_id=%d first_player_id=%d first_role=%s",
		guildID, first.GetPlayerId(), role.String())
	if role == guildv1.GuildMemberRole_GUILD_MEMBER_ROLE_UNSPECIFIED {
		intg021Failf(t, "list guild members role", "guild_id=%d first_player_id=%d role unspecified", guildID, first.GetPlayerId())
	}
}

// smokeINTG021RecruitHeroOptional grants recruit cost when possible and logs hero_id + template_cfg_id; failures are non-fatal.
func smokeINTG021RecruitHeroOptional(t *testing.T, ctx context.Context, c *websocket.Conn, apiSrv *api.Server, sid string, playerID int64) {
	t.Helper()
	smokeStep(t, "INTG-021 optional: hero.v1.RecruitHero (non-blocking)")
	audit := api.GmAudit{OperatorID: "smoke", OperatorName: "smoke", Reason: "intg-021", TicketID: "T-i21-hero"}
	_, _, err := apiSrv.Gm().GrantReward(ctx, "", audit, intg006ServerID, playerID, content.RewardPackage{
		Items: []content.RewardItem{{ItemCfgID: hero.RecruitScrollID, Qty: 2}},
		Resources: map[string]int64{
			"food": 25000, "wood": 25000, "iron": 25000, "stone": 25000,
		},
	}, "intg-021-hero-seed")
	if err != nil {
		t.Logf("INTG-021 optional RecruitHero skipped: gm grant err=%v", err)
		return
	}
	recruitResp := mustSend(t, c, &commonv1.ClientPacket{
		Route: api.RouteRecruitHero, TraceId: "i21-recruit", SessionId: sid, ServerId: intg006ServerID,
		Payload: mustMarshal(&herov1.RecruitHeroRequest{ServerId: intg006ServerID, TemplateCfgId: smokeHeroTemplateCfgID}),
	})
	if recruitResp.Code != 0 {
		t.Logf("INTG-021 optional RecruitHero skipped: template_cfg_id=%d code=%d msg=%s", smokeHeroTemplateCfgID, recruitResp.Code, recruitResp.Msg)
		return
	}
	var recruitOut herov1.RecruitHeroResponse
	if err := proto.Unmarshal(recruitResp.Data, &recruitOut); err != nil {
		t.Logf("INTG-021 optional RecruitHero skipped: decode err=%v", err)
		return
	}
	heroID := recruitOut.GetHeroId()
	tplID := recruitOut.GetTemplateCfgId()
	if heroID == 0 && tplID == 0 {
		t.Logf("INTG-021 optional RecruitHero skipped: empty hero_id/template_cfg_id in response")
		return
	}
	t.Logf("INTG-021: RecruitHero hero_id=%d template_cfg_id=%d", heroID, tplID)
}

func intg021Failf(t *testing.T, step string, format string, args ...any) {
	t.Helper()
	t.Fatalf("%s | step=%q | %s", smokeINTG021CfgHint, step, fmt.Sprintf(format, args...))
}
