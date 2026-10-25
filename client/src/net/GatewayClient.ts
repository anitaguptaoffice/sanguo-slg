import { GATEWAY_WS_URL } from "@/config";
import {
  parseBeginHeroExprResponse,
  parseCancelHeroExprResponse,
  parseHeroExprFinishResponse,
} from "@/net/heroDetailExpr";
import { parseHeroPointResponse } from "@/net/heroDetailPoints";
import { parseUpgradeHeroResponse } from "@/net/heroDetailUpgrade";
import { parseRestHeroResponse } from "@/net/heroDetailForce";
import { parseGetHeroDetailResponse, requireHeroIdForDetail } from "@/net/heroMailState";
import { getTypes, Routes } from "@/net/loadProto";
import type protobuf from "protobufjs";

export type GatewayHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
};

type ServerPacketShape = {
  code: number;
  msg?: string;
  data: Uint8Array;
  trace_id?: string;
};

export type GatewayPort = {
  connect(handlers?: GatewayHandlers): Promise<void>;
  register(loginName: string, password: string): Promise<unknown>;
  login(loginName: string, password: string, serverId: number): Promise<unknown>;
  listPlayerCities(): Promise<unknown>;
  createCity(serverId: number, name: string, x: number, y: number): Promise<unknown>;
  getCityState(cityId: number): Promise<unknown>;
  startBuildingUpgrade(cityId: number, slotKey: string, buildingCfgId: number): Promise<unknown>;
  recruitTroop(cityId: number, unitCfgId: number, count: number): Promise<unknown>;
  startMarch(
    cityId: number,
    toX: number,
    toY: number,
    purpose: number,
    heroId: number,
    troops: { unit_cfg_id: number; count: number }[],
  ): Promise<unknown>;
  listMarches(cityId?: number, limit?: number, offset?: number): Promise<unknown>;
  listBattleReports(limit?: number, offset?: number): Promise<unknown>;
  getBattleReport(reportId: number): Promise<unknown>;
  listGameServers(page?: number, pageSize?: number): Promise<unknown>;
  enterGameServer(serverId: number): Promise<unknown>;
  sendChatMessage(
    serverId: number,
    channel: number,
    content: string,
    opts?: { recipientPlayerId?: number; guildId?: number },
  ): Promise<unknown>;
  listChatMessages(
    serverId: number,
    channel: number,
    opts?: { peerPlayerId?: number; guildId?: number; limit?: number },
  ): Promise<unknown>;
  createGuild(serverId: number, name: string): Promise<unknown>;
  joinGuild(serverId: number, guildId: number): Promise<unknown>;
  listGuildMembers(serverId: number, guildId: number, page?: number): Promise<unknown>;
  getLeaderboard(serverId: number, type: number, page?: number, pageSize?: number): Promise<unknown>;
  listPlayerQuests(serverId: number, opts?: { chainId?: number; includeCompleted?: boolean }): Promise<unknown>;
  acceptQuest(serverId: number, questCfgId: number): Promise<unknown>;
  reportQuestProgress(
    serverId: number,
    questCfgId: number,
    absolute: boolean,
    progressValue: number,
  ): Promise<unknown>;
  claimQuestReward(serverId: number, questCfgId: number): Promise<unknown>;
  listShopShelf(serverId: number, shelfId?: number): Promise<unknown>;
  purchaseShopOffer(serverId: number, offerId: number, purchaseCount?: number): Promise<unknown>;
  listPlayerBag(serverId: number): Promise<unknown>;
  useConsumable(serverId: number, itemCfgId: number, count: number): Promise<unknown>;
  listPlayerMail(
    serverId: number,
    opts?: { filter?: number; pageSize?: number; pageOffset?: number },
  ): Promise<unknown>;
  markPlayerMailRead(serverId: number, mailId: number): Promise<unknown>;
  claimPlayerMailAttachments(serverId: number, mailId: number): Promise<unknown>;
  listPlayerHeroes(serverId: number, opts?: { pageSize?: number; pageOffset?: number }): Promise<unknown>;
  getHeroDetail(serverId: number, heroId: number): Promise<unknown>;
  upgradeHero(serverId: number, heroId: number): Promise<ReturnType<typeof parseUpgradeHeroResponse>>;
  addHeroPoint(
    serverId: number,
    heroId: number,
    targets: { force: number; intel: number; politics: number },
  ): Promise<ReturnType<typeof parseHeroPointResponse>>;
  clearHeroPoint(serverId: number, heroId: number): Promise<ReturnType<typeof parseHeroPointResponse>>;
  beginHeroExpr(serverId: number, heroId: number, hours: number): Promise<ReturnType<typeof parseBeginHeroExprResponse>>;
  cancelHeroExpr(serverId: number, heroId: number): Promise<ReturnType<typeof parseCancelHeroExprResponse>>;
  finishHeroExpr(serverId: number, heroId: number): Promise<ReturnType<typeof parseHeroExprFinishResponse>>;
  fasterHeroExpr(serverId: number, heroId: number): Promise<ReturnType<typeof parseHeroExprFinishResponse>>;
  restHero(serverId: number, heroId: number): Promise<ReturnType<typeof parseRestHeroResponse>>;
  recruitHero(
    serverId: number,
    templateCfgId: number,
    opts?: { itemCfgId?: number; pool?: string },
  ): Promise<unknown>;
  listRecruitTemplates(
    serverId: number,
    opts?: { pool?: string; pageSize?: number; pageOffset?: number },
  ): Promise<unknown>;
  listHotelRecruitCandidates(serverId: number, cityId: number): Promise<unknown>;
  refreshHotelRecruitPool(serverId: number, cityId: number): Promise<unknown>;
  recruitHotelCandidate(serverId: number, cityId: number, candidateId: number): Promise<unknown>;
  listPersuadeTargets(serverId: number): Promise<unknown>;
  persuadeHero(serverId: number, cityId: number, npcCfgId: number): Promise<unknown>;
  lionizeHero(serverId: number, cityId: number, npcCfgId: number): Promise<unknown>;
  largessHero(
    serverId: number,
    heroId: number,
    giftKind: number,
    itemCfgId?: number,
  ): Promise<unknown>;
  listCaptiveHeroes(serverId: number): Promise<unknown>;
  trySummonCaptive(serverId: number, cityId: number, heroId: number): Promise<unknown>;
  sureSummonCaptive(serverId: number, cityId: number, heroId: number): Promise<unknown>;
  releaseCaptive(serverId: number, cityId: number, heroId: number): Promise<unknown>;
  listComingHeroes(serverId: number): Promise<unknown>;
  tryAcceptComing(serverId: number, cityId: number, heroId: number): Promise<unknown>;
  sureAcceptComing(serverId: number, cityId: number, heroId: number): Promise<unknown>;
  rejectComing(serverId: number, cityId: number, heroId: number): Promise<unknown>;
  getCityChief(serverId: number, cityId: number): Promise<unknown>;
  setCityChief(serverId: number, cityId: number, heroId: number): Promise<unknown>;
  clearCityChief(serverId: number, cityId: number): Promise<unknown>;
  getBoundServerId(): number;
  getSessionId(): string;
  close(): void;
};

export class GatewayClient implements GatewayPort {
  private ws: WebSocket | null = null;
  private sessionId = "";
  private boundServerId = 0;

  constructor(private readonly url = GATEWAY_WS_URL) {}

  connect(handlers: GatewayHandlers = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = "arraybuffer";
      this.ws.onopen = () => {
        handlers.onOpen?.();
        resolve();
      };
      this.ws.onerror = (e) => {
        handlers.onError?.(e);
        reject(e);
      };
      this.ws.onclose = () => handlers.onClose?.();
    });
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getBoundServerId(): number {
    return this.boundServerId;
  }

  async register(loginName: string, password: string) {
    const { RegisterResponse } = getTypes();
    return this.rpc(Routes.Register, "RegisterRequest", { login_name: loginName, password }, RegisterResponse, false);
  }

  async login(loginName: string, password: string, serverId: number) {
    const { LoginResponse } = getTypes();
    const data = (await this.rpc(
      Routes.Login,
      "LoginRequest",
      { login_name: loginName, password, server_id: serverId },
      LoginResponse,
      false,
    )) as { session_id: string };
    this.sessionId = data.session_id;
    this.boundServerId = serverId;
    return data;
  }

  async listGameServers(page = 1, pageSize = 20) {
    const { ListGameServersResponse } = getTypes();
    const withSession = this.sessionId !== "";
    return this.rpc(
      Routes.ListGameServers,
      "ListGameServersRequest",
      { page, page_size: pageSize },
      ListGameServersResponse,
      withSession,
    );
  }

  async enterGameServer(serverId: number) {
    const { EnterGameServerResponse } = getTypes();
    const data = (await this.rpc(
      Routes.EnterGameServer,
      "EnterGameServerRequest",
      { server_id: serverId },
      EnterGameServerResponse,
      true,
    )) as { session_id?: string; server_id?: number };
    if (data.session_id) this.sessionId = data.session_id;
    this.boundServerId = data.server_id ?? serverId;
    return data;
  }

  async sendChatMessage(
    serverId: number,
    channel: number,
    content: string,
    opts: { recipientPlayerId?: number; guildId?: number } = {},
  ) {
    const { SendChatMessageResponse } = getTypes();
    return this.rpc(
      Routes.SendChatMessage,
      "SendChatMessageRequest",
      {
        server_id: serverId,
        channel,
        content,
        recipient_player_id: opts.recipientPlayerId ?? 0,
        guild_id: opts.guildId ?? 0,
      },
      SendChatMessageResponse,
      true,
    );
  }

  async listChatMessages(
    serverId: number,
    channel: number,
    opts: { peerPlayerId?: number; guildId?: number; limit?: number } = {},
  ) {
    const { ListChatMessagesResponse } = getTypes();
    return this.rpc(
      Routes.ListChatMessages,
      "ListChatMessagesRequest",
      {
        server_id: serverId,
        channel,
        peer_player_id: opts.peerPlayerId ?? 0,
        guild_id: opts.guildId ?? 0,
        before_message_id: 0,
        limit: opts.limit ?? 30,
      },
      ListChatMessagesResponse,
      true,
    );
  }

  async createGuild(serverId: number, name: string) {
    const { CreateGuildResponse } = getTypes();
    return this.rpc(
      Routes.CreateGuild,
      "CreateGuildRequest",
      { server_id: serverId, name },
      CreateGuildResponse,
      true,
    );
  }

  async joinGuild(serverId: number, guildId: number) {
    const { JoinGuildResponse } = getTypes();
    return this.rpc(
      Routes.JoinGuild,
      "JoinGuildRequest",
      { server_id: serverId, guild_id: guildId },
      JoinGuildResponse,
      true,
    );
  }

  async listGuildMembers(serverId: number, guildId: number, page = 1) {
    const { ListGuildMembersResponse } = getTypes();
    return this.rpc(
      Routes.ListGuildMembers,
      "ListGuildMembersRequest",
      { server_id: serverId, guild_id: guildId, page, page_size: 50 },
      ListGuildMembersResponse,
      true,
    );
  }

  async getLeaderboard(serverId: number, type: number, page = 1, pageSize = 20) {
    const { GetLeaderboardResponse } = getTypes();
    return this.rpc(
      Routes.GetLeaderboard,
      "GetLeaderboardRequest",
      { server_id: serverId, type, page, page_size: pageSize },
      GetLeaderboardResponse,
      true,
    );
  }

  async listPlayerCities() {
    const { ListPlayerCitiesResponse } = getTypes();
    return this.rpc(Routes.ListPlayerCities, "ListPlayerCitiesRequest", {}, ListPlayerCitiesResponse, true);
  }

  async createCity(serverId: number, name: string, x: number, y: number) {
    const { CreateCityResponse } = getTypes();
    return this.rpc(
      Routes.CreateCity,
      "CreateCityRequest",
      { server_id: serverId, name, x, y },
      CreateCityResponse,
      true,
    );
  }

  async getCityState(cityId: number) {
    const { GetCityStateResponse } = getTypes();
    return this.rpc(Routes.GetCityState, "GetCityStateRequest", { city_id: cityId }, GetCityStateResponse, true);
  }

  async startBuildingUpgrade(cityId: number, slotKey: string, buildingCfgId: number) {
    const { StartBuildingUpgradeResponse } = getTypes();
    return this.rpc(
      Routes.StartBuildingUpgrade,
      "StartBuildingUpgradeRequest",
      { city_id: cityId, slot_key: slotKey, building_cfg_id: buildingCfgId },
      StartBuildingUpgradeResponse,
      true,
    );
  }

  async recruitTroop(cityId: number, unitCfgId: number, count: number) {
    const { RecruitTroopResponse } = getTypes();
    return this.rpc(
      Routes.RecruitTroop,
      "RecruitTroopRequest",
      { city_id: cityId, unit_cfg_id: unitCfgId, count },
      RecruitTroopResponse,
      true,
    );
  }

  async startMarch(
    cityId: number,
    toX: number,
    toY: number,
    purpose: number,
    heroId: number,
    troops: { unit_cfg_id: number; count: number }[],
  ) {
    const { StartMarchResponse } = getTypes();
    return this.rpc(
      Routes.StartMarch,
      "StartMarchRequest",
      { city_id: cityId, to_x: toX, to_y: toY, purpose, hero_id: heroId, troops },
      StartMarchResponse,
      true,
    );
  }

  async listMarches(cityId?: number, limit = 20, offset = 0) {
    const { ListMarchesResponse } = getTypes();
    const payload: { limit: number; offset: number; city_id?: number } = { limit, offset };
    if (cityId != null && cityId > 0) payload.city_id = cityId;
    return this.rpc(
      Routes.ListMarches,
      "ListMarchesRequest",
      payload,
      ListMarchesResponse,
      true,
    );
  }

  async listBattleReports(limit = 20, offset = 0) {
    const { ListBattleReportsResponse } = getTypes();
    return this.rpc(
      Routes.ListBattleReports,
      "ListBattleReportsRequest",
      { limit, offset },
      ListBattleReportsResponse,
      true,
    );
  }

  async getBattleReport(reportId: number) {
    const { GetBattleReportResponse } = getTypes();
    return this.rpc(
      Routes.GetBattleReport,
      "GetBattleReportRequest",
      { report_id: reportId },
      GetBattleReportResponse,
      true,
    );
  }

  async listPlayerQuests(serverId: number, opts: { chainId?: number; includeCompleted?: boolean } = {}) {
    const { ListPlayerQuestsResponse } = getTypes();
    return this.rpc(
      Routes.ListPlayerQuests,
      "ListPlayerQuestsRequest",
      {
        server_id: serverId,
        chain_id: opts.chainId ?? 0,
        include_completed: opts.includeCompleted ?? true,
      },
      ListPlayerQuestsResponse,
      true,
    );
  }

  async acceptQuest(serverId: number, questCfgId: number) {
    const { AcceptQuestResponse } = getTypes();
    return this.rpc(
      Routes.AcceptQuest,
      "AcceptQuestRequest",
      { server_id: serverId, quest_cfg_id: questCfgId },
      AcceptQuestResponse,
      true,
    );
  }

  async reportQuestProgress(
    serverId: number,
    questCfgId: number,
    absolute: boolean,
    progressValue: number,
  ) {
    const { ReportQuestProgressResponse } = getTypes();
    return this.rpc(
      Routes.ReportQuestProgress,
      "ReportQuestProgressRequest",
      {
        server_id: serverId,
        quest_cfg_id: questCfgId,
        absolute,
        progress_value: progressValue,
      },
      ReportQuestProgressResponse,
      true,
    );
  }

  async claimQuestReward(serverId: number, questCfgId: number) {
    const { ClaimQuestRewardResponse } = getTypes();
    return this.rpc(
      Routes.ClaimQuestReward,
      "ClaimQuestRewardRequest",
      { server_id: serverId, quest_cfg_id: questCfgId },
      ClaimQuestRewardResponse,
      true,
    );
  }

  async listShopShelf(serverId: number, shelfId = 0) {
    const { ListShopShelfResponse } = getTypes();
    return this.rpc(
      Routes.ListShopShelf,
      "ListShopShelfRequest",
      { server_id: serverId, shelf_id: shelfId },
      ListShopShelfResponse,
      true,
    );
  }

  async purchaseShopOffer(serverId: number, offerId: number, purchaseCount = 1) {
    const { PurchaseShopOfferResponse } = getTypes();
    return this.rpc(
      Routes.PurchaseShopOffer,
      "PurchaseShopOfferRequest",
      {
        server_id: serverId,
        offer_id: offerId,
        purchase_count: purchaseCount,
      },
      PurchaseShopOfferResponse,
      true,
    );
  }

  async listPlayerBag(serverId: number) {
    const { ListPlayerBagResponse } = getTypes();
    return this.rpc(
      Routes.ListPlayerBag,
      "ListPlayerBagRequest",
      { server_id: serverId },
      ListPlayerBagResponse,
      true,
    );
  }

  async useConsumable(serverId: number, itemCfgId: number, count: number) {
    const { UseConsumableResponse } = getTypes();
    return this.rpc(
      Routes.UseConsumable,
      "UseConsumableRequest",
      { server_id: serverId, item_cfg_id: itemCfgId, count },
      UseConsumableResponse,
      true,
    );
  }

  async listPlayerMail(
    serverId: number,
    opts: { filter?: number; pageSize?: number; pageOffset?: number } = {},
  ) {
    const { ListPlayerMailResponse } = getTypes();
    return this.rpc(
      Routes.ListPlayerMail,
      "ListPlayerMailRequest",
      {
        server_id: serverId,
        filter: opts.filter ?? 0,
        page_size: opts.pageSize ?? 50,
        page_offset: opts.pageOffset ?? 0,
      },
      ListPlayerMailResponse,
      true,
    );
  }

  async markPlayerMailRead(serverId: number, mailId: number) {
    const { MarkPlayerMailReadResponse } = getTypes();
    return this.rpc(
      Routes.MarkPlayerMailRead,
      "MarkPlayerMailReadRequest",
      { server_id: serverId, mail_id: mailId },
      MarkPlayerMailReadResponse,
      true,
    );
  }

  async claimPlayerMailAttachments(serverId: number, mailId: number) {
    const { ClaimPlayerMailAttachmentsResponse } = getTypes();
    return this.rpc(
      Routes.ClaimPlayerMailAttachments,
      "ClaimPlayerMailAttachmentsRequest",
      { server_id: serverId, mail_id: mailId },
      ClaimPlayerMailAttachmentsResponse,
      true,
    );
  }

  async listPlayerHeroes(serverId: number, opts: { pageSize?: number; pageOffset?: number } = {}) {
    const { ListPlayerHeroesResponse } = getTypes();
    return this.rpc(
      Routes.ListPlayerHeroes,
      "ListPlayerHeroesRequest",
      {
        server_id: serverId,
        page_size: opts.pageSize ?? 50,
        page_offset: opts.pageOffset ?? 0,
      },
      ListPlayerHeroesResponse,
      true,
    );
  }

  async getHeroDetail(serverId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { GetHeroDetailResponse } = getTypes();
    const raw = await this.rpc(
      Routes.GetHeroDetail,
      "GetHeroDetailRequest",
      { server_id: serverId, hero_id: heroId },
      GetHeroDetailResponse,
      true,
    );
    return parseGetHeroDetailResponse(raw);
  }

  async upgradeHero(serverId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { UpgradeHeroResponse } = getTypes();
    const raw = await this.rpc(
      Routes.UpgradeHero,
      "UpgradeHeroRequest",
      { server_id: serverId, hero_id: heroId },
      UpgradeHeroResponse,
      true,
    );
    return parseUpgradeHeroResponse(raw);
  }

  async addHeroPoint(
    serverId: number,
    heroId: number,
    targets: { force: number; intel: number; politics: number },
  ) {
    requireHeroIdForDetail(heroId);
    const { AddHeroPointResponse } = getTypes();
    const raw = await this.rpc(
      Routes.AddHeroPoint,
      "AddHeroPointRequest",
      {
        server_id: serverId,
        hero_id: heroId,
        force: targets.force,
        intel: targets.intel,
        politics: targets.politics,
      },
      AddHeroPointResponse,
      true,
    );
    return parseHeroPointResponse(raw);
  }

  async clearHeroPoint(serverId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { ClearHeroPointResponse } = getTypes();
    const raw = await this.rpc(
      Routes.ClearHeroPoint,
      "ClearHeroPointRequest",
      { server_id: serverId, hero_id: heroId },
      ClearHeroPointResponse,
      true,
    );
    return parseHeroPointResponse(raw);
  }

  async beginHeroExpr(serverId: number, heroId: number, hours: number) {
    requireHeroIdForDetail(heroId);
    const { BeginHeroExprResponse } = getTypes();
    const raw = await this.rpc(
      Routes.BeginHeroExpr,
      "BeginHeroExprRequest",
      { server_id: serverId, hero_id: heroId, hours },
      BeginHeroExprResponse,
      true,
    );
    return parseBeginHeroExprResponse(raw);
  }

  async cancelHeroExpr(serverId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { CancelHeroExprResponse } = getTypes();
    const raw = await this.rpc(
      Routes.CancelHeroExpr,
      "CancelHeroExprRequest",
      { server_id: serverId, hero_id: heroId },
      CancelHeroExprResponse,
      true,
    );
    return parseCancelHeroExprResponse(raw);
  }

  async finishHeroExpr(serverId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { FinishHeroExprResponse } = getTypes();
    const raw = await this.rpc(
      Routes.FinishHeroExpr,
      "FinishHeroExprRequest",
      { server_id: serverId, hero_id: heroId },
      FinishHeroExprResponse,
      true,
    );
    return parseHeroExprFinishResponse(raw);
  }

  async fasterHeroExpr(serverId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { FasterHeroExprResponse } = getTypes();
    const raw = await this.rpc(
      Routes.FasterHeroExpr,
      "FasterHeroExprRequest",
      { server_id: serverId, hero_id: heroId },
      FasterHeroExprResponse,
      true,
    );
    return parseHeroExprFinishResponse(raw);
  }

  async restHero(serverId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { RestHeroResponse } = getTypes();
    const raw = await this.rpc(
      Routes.RestHero,
      "RestHeroRequest",
      { server_id: serverId, hero_id: heroId },
      RestHeroResponse,
      true,
    );
    return parseRestHeroResponse(raw);
  }

  async recruitHero(
    serverId: number,
    templateCfgId: number,
    opts: { itemCfgId?: number; pool?: string } = {},
  ) {
    const { RecruitHeroResponse } = getTypes();
    return this.rpc(
      Routes.RecruitHero,
      "RecruitHeroRequest",
      {
        server_id: serverId,
        template_cfg_id: templateCfgId,
        item_cfg_id: opts.itemCfgId ?? 0,
        pool: opts.pool ?? "",
      },
      RecruitHeroResponse,
      true,
    );
  }

  async listRecruitTemplates(
    serverId: number,
    opts: { pool?: string; pageSize?: number; pageOffset?: number } = {},
  ) {
    const { ListRecruitTemplatesResponse } = getTypes();
    return this.rpc(
      Routes.ListRecruitTemplates,
      "ListRecruitTemplatesRequest",
      {
        server_id: serverId,
        pool: opts.pool ?? "",
        page_size: opts.pageSize ?? 50,
        page_offset: opts.pageOffset ?? 0,
      },
      ListRecruitTemplatesResponse,
      true,
    );
  }

  async listHotelRecruitCandidates(serverId: number, cityId: number) {
    const { ListHotelRecruitCandidatesResponse } = getTypes();
    return this.rpc(
      Routes.ListHotelRecruitCandidates,
      "ListHotelRecruitCandidatesRequest",
      { server_id: serverId, city_id: cityId },
      ListHotelRecruitCandidatesResponse,
      true,
    );
  }

  async refreshHotelRecruitPool(serverId: number, cityId: number) {
    const { RefreshHotelRecruitPoolResponse } = getTypes();
    return this.rpc(
      Routes.RefreshHotelRecruitPool,
      "RefreshHotelRecruitPoolRequest",
      { server_id: serverId, city_id: cityId },
      RefreshHotelRecruitPoolResponse,
      true,
    );
  }

  async recruitHotelCandidate(serverId: number, cityId: number, candidateId: number) {
    const { RecruitHotelCandidateResponse } = getTypes();
    return this.rpc(
      Routes.RecruitHotelCandidate,
      "RecruitHotelCandidateRequest",
      { server_id: serverId, city_id: cityId, candidate_id: candidateId },
      RecruitHotelCandidateResponse,
      true,
    );
  }

  async listPersuadeTargets(serverId: number) {
    const { ListPersuadeTargetsResponse } = getTypes();
    return this.rpc(
      Routes.ListPersuadeTargets,
      "ListPersuadeTargetsRequest",
      { server_id: serverId },
      ListPersuadeTargetsResponse,
      true,
    );
  }

  async persuadeHero(serverId: number, cityId: number, npcCfgId: number) {
    const { PersuadeHeroResponse } = getTypes();
    return this.rpc(
      Routes.PersuadeHero,
      "PersuadeHeroRequest",
      { server_id: serverId, city_id: cityId, npc_cfg_id: npcCfgId },
      PersuadeHeroResponse,
      true,
    );
  }

  async lionizeHero(serverId: number, cityId: number, npcCfgId: number) {
    const { LionizeHeroResponse } = getTypes();
    return this.rpc(
      Routes.LionizeHero,
      "LionizeHeroRequest",
      { server_id: serverId, city_id: cityId, npc_cfg_id: npcCfgId },
      LionizeHeroResponse,
      true,
    );
  }

  async largessHero(serverId: number, heroId: number, giftKind: number, itemCfgId = 0) {
    requireHeroIdForDetail(heroId);
    const { LargessHeroResponse } = getTypes();
    return this.rpc(
      Routes.LargessHero,
      "LargessHeroRequest",
      {
        server_id: serverId,
        hero_id: heroId,
        gift_kind: giftKind,
        item_cfg_id: itemCfgId,
      },
      LargessHeroResponse,
      true,
    );
  }

  async listCaptiveHeroes(serverId: number) {
    const { ListCaptiveHeroesResponse } = getTypes();
    return this.rpc(
      Routes.ListCaptiveHeroes,
      "ListCaptiveHeroesRequest",
      { server_id: serverId },
      ListCaptiveHeroesResponse,
      true,
    );
  }

  async trySummonCaptive(serverId: number, cityId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { TrySummonCaptiveResponse } = getTypes();
    return this.rpc(
      Routes.TrySummonCaptive,
      "TrySummonCaptiveRequest",
      { server_id: serverId, city_id: cityId, hero_id: heroId },
      TrySummonCaptiveResponse,
      true,
    );
  }

  async sureSummonCaptive(serverId: number, cityId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { SureSummonCaptiveResponse } = getTypes();
    return this.rpc(
      Routes.SureSummonCaptive,
      "SureSummonCaptiveRequest",
      { server_id: serverId, city_id: cityId, hero_id: heroId },
      SureSummonCaptiveResponse,
      true,
    );
  }

  async releaseCaptive(serverId: number, cityId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { ReleaseCaptiveResponse } = getTypes();
    return this.rpc(
      Routes.ReleaseCaptive,
      "ReleaseCaptiveRequest",
      { server_id: serverId, city_id: cityId, hero_id: heroId },
      ReleaseCaptiveResponse,
      true,
    );
  }

  async listComingHeroes(serverId: number) {
    const { ListComingHeroesResponse } = getTypes();
    return this.rpc(
      Routes.ListComingHeroes,
      "ListComingHeroesRequest",
      { server_id: serverId },
      ListComingHeroesResponse,
      true,
    );
  }

  async tryAcceptComing(serverId: number, cityId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { TryAcceptComingResponse } = getTypes();
    return this.rpc(
      Routes.TryAcceptComing,
      "TryAcceptComingRequest",
      { server_id: serverId, city_id: cityId, hero_id: heroId },
      TryAcceptComingResponse,
      true,
    );
  }

  async sureAcceptComing(serverId: number, cityId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { SureAcceptComingResponse } = getTypes();
    return this.rpc(
      Routes.SureAcceptComing,
      "SureAcceptComingRequest",
      { server_id: serverId, city_id: cityId, hero_id: heroId },
      SureAcceptComingResponse,
      true,
    );
  }

  async rejectComing(serverId: number, cityId: number, heroId: number) {
    requireHeroIdForDetail(heroId);
    const { RejectComingResponse } = getTypes();
    return this.rpc(
      Routes.RejectComing,
      "RejectComingRequest",
      { server_id: serverId, city_id: cityId, hero_id: heroId },
      RejectComingResponse,
      true,
    );
  }

  async getCityChief(serverId: number, cityId: number) {
    const { GetCityChiefResponse } = getTypes();
    return this.rpc(
      Routes.GetCityChief,
      "GetCityChiefRequest",
      { server_id: serverId, city_id: cityId },
      GetCityChiefResponse,
      true,
    );
  }

  async setCityChief(serverId: number, cityId: number, heroId: number) {
    const { SetCityChiefResponse } = getTypes();
    return this.rpc(
      Routes.SetCityChief,
      "SetCityChiefRequest",
      { server_id: serverId, city_id: cityId, hero_id: heroId },
      SetCityChiefResponse,
      true,
    );
  }

  async clearCityChief(serverId: number, cityId: number) {
    const { ClearCityChiefResponse } = getTypes();
    return this.rpc(
      Routes.ClearCityChief,
      "ClearCityChiefRequest",
      { server_id: serverId, city_id: cityId },
      ClearCityChiefResponse,
      true,
    );
  }

  private async rpc(
    route: string,
    requestTypeName: keyof ReturnType<typeof getTypes>,
    fields: Record<string, unknown>,
    responseType: protobuf.Type,
    withSession: boolean,
  ): Promise<unknown> {
    const types = getTypes();
    const RequestType = types[requestTypeName] as protobuf.Type;
    const { ClientPacket, ServerPacket } = types;
    const traceId = crypto.randomUUID();
    const payload = RequestType.encode(RequestType.create(fields)).finish();
    const packet = ClientPacket.encode(
      ClientPacket.create({
        route,
        payload,
        trace_id: traceId,
        session_id: withSession ? this.sessionId : "",
        server_id: withSession ? this.boundServerId : 0,
      }),
    ).finish();
    const reply = await this.sendAndWait(packet, traceId);
    const sp = ServerPacket.decode(new Uint8Array(reply)) as unknown as ServerPacketShape;
    if (sp.code !== 0) {
      const err = new Error(sp.msg || `gateway error code=${sp.code}`);
      (err as Error & { code: number }).code = sp.code;
      throw err;
    }
    return responseType.decode(sp.data);
  }

  private sendAndWait(packet: Uint8Array, traceId: string): Promise<ArrayBuffer> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("gateway not connected");
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("gateway timeout")), 15_000);
      const onMessage = (ev: MessageEvent) => {
        const buf = ev.data as ArrayBuffer;
        const { ServerPacket } = getTypes();
        const sp = ServerPacket.decode(new Uint8Array(buf)) as unknown as { trace_id?: string };
        if (sp.trace_id !== traceId) return;
        clearTimeout(timer);
        ws.removeEventListener("message", onMessage);
        resolve(buf);
      };
      ws.addEventListener("message", onMessage);
      ws.send(packet);
    });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.sessionId = "";
    this.boundServerId = 0;
  }
}
