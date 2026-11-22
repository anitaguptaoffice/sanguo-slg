import { rememberSuccessfulReadNotice } from "@/net/successfulReadNotice";
import { decodeGatewayResponse } from "@/net/decodeGatewayResponse";
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
import type { AuthenticatedIdentity } from "./authenticatedIdentity";
import { FirstCityGateway } from "./firstCityGateway";
import type { FirstCityRoute, FirstCityCallOptions } from "./firstCityGateway";
import { FirstCityJournal } from "./firstCityJournal";
import type { FirstCityScope } from "./firstCityCanonical";
import { openRecruitSubmissionJournal } from "./recruitJournal";
import type { RecruitJournalIntent, RecruitSubmissionChannel, RecruitSubmissionResult } from "./recruitJournal";


type PreparedRecruitResult = RecruitSubmissionResult | "retry-required" | "nothing-to-retry";

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
  getWorldViewport(centerX: number, centerY: number, radiusX: number, radiusY: number): Promise<unknown>;
  getWorldTileDetail(x: number, y: number): Promise<unknown>;
  listOwnedFields(cityId: number): Promise<unknown>;
  abandonField(cityId: number, x: number, y: number): Promise<unknown>;
  startFieldGather(cityId: number, x: number, y: number): Promise<unknown>;
  listFieldGathers(cityId: number): Promise<unknown>;
  claimFieldGather(gatherId: number): Promise<unknown>;
  createCity(serverId: number, name: string, x: number, y: number): Promise<unknown>;
  getCityState(cityId: number): Promise<unknown>;
  startBuildingUpgrade(cityId: number, slotKey: string, buildingCfgId: number): Promise<unknown>;
  demolishBuilding(cityId: number, slotKey: string): Promise<unknown>;
  getCityCivic(cityId: number): Promise<unknown>;
  applyCityDecree(cityId: number, decree: number, value: number, name?: string): Promise<unknown>;
  listTechnics(cityId: number): Promise<unknown>;
  startTechnicResearch(cityId: number, tid: number): Promise<unknown>;
  listCityOffices(cityId: number): Promise<unknown>;
  setCityOffice(cityId: number, office: number, heroId: number): Promise<unknown>;
  clearCityOffice(cityId: number, office: number): Promise<unknown>;
  payCityOfficeSalary(cityId: number): Promise<unknown>;
  rewardCityOfficeHero(cityId: number, heroId: number): Promise<unknown>;
  listWallDefenses(cityId: number): Promise<unknown>;
  buildWallDefense(cityId: number, defenseType: number): Promise<unknown>;
  healWounded(cityId: number, unitCfgId: number, count: number): Promise<unknown>;
  listHistoricalHeroes(cityId: number): Promise<unknown>;
  searchHistoricalHero(cityId: number, npcCfgId: number): Promise<unknown>;
  persuadeHistoricalHero(cityId: number, npcCfgId: number): Promise<unknown>;
  getHeroEquipment(cityId: number, heroId: number): Promise<unknown>;
  forgeEquipment(cityId: number, slotType: number, tier: number): Promise<unknown>;
  enhanceEquipment(cityId: number, equipmentId: number): Promise<unknown>;
  socketGem(cityId: number, equipmentId: number, gemCfgId: number): Promise<unknown>;
  equipItem(cityId: number, heroId: number, equipmentId: number): Promise<unknown>;
  unequipItem(cityId: number, heroId: number, slotType: number): Promise<unknown>;
  trainMount(cityId: number, equipmentId: number): Promise<unknown>;
  listTacticPresets(cityId: number): Promise<unknown>;
  setTacticPreset(cityId: number, unitCfgId: number, targetType: number, hold: boolean): Promise<unknown>;
  getPlayerRank(): Promise<unknown>;
  promoteRank(cityId: number): Promise<unknown>;
  castTrick(cityId: number, trickType: number, targetMarchId: number): Promise<unknown>;
  runDrill(cityId: number, attacker: { unit_cfg_id: number; count: number }[], defender: { unit_cfg_id: number; count: number }[]): Promise<unknown>;
  getStorehouse(cityId: number): Promise<unknown>;
  getMarket(cityId: number): Promise<unknown>;
  buyFromMerchant(cityId: number, resourceType: number, amount: number): Promise<unknown>;
  sellToMerchant(cityId: number, resourceType: number, amount: number): Promise<unknown>;
  createMarketOffer(cityId: number, resourceType: number, amount: number, priceMilli: number, hours: number): Promise<unknown>;
  cancelMarketOffer(cityId: number, offerId: number): Promise<unknown>;
  buyMarketOffer(cityId: number, offerId: number): Promise<unknown>;
  recruitTroop(cityId: number, unitCfgId: number, count: number): Promise<unknown>;
  readonly preparedRecruit?: boolean;
  submitPreparedRecruit?(intent?: RecruitJournalIntent): Promise<PreparedRecruitResult>;
  recallMarch(marchId: number): Promise<unknown>;
  speedupMarch(marchId: number, itemCfgId: number): Promise<unknown>;
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
  getSessionGeneration?(): number;
  getAuthenticatedIdentity?(): AuthenticatedIdentity | null;
  close(): void;
};

export class GatewayClient implements GatewayPort {
  private ws: WebSocket | null = null;
  private sessionId = "";
  private boundServerId = 0;
  private sessionGeneration = 0;
  private authenticatedIdentity: AuthenticatedIdentity | null = null;
  private cancelConnect: (() => void) | null = null;
  private firstCityReady = false;
  private readonly firstCityJournal = new FirstCityJournal();
  private readonly firstCity = new FirstCityGateway(() => this.firstCityReady ? {
    ws: this.ws, session: this.sessionId, shard: this.boundServerId, generation: this.sessionGeneration,
  } : null);

  requestFirstCity(route: FirstCityRoute, request: unknown, options?: FirstCityCallOptions) {
    return this.firstCity.request(route, request, options);
  }

  requestPersistedFirstCity(route: FirstCityRoute, request: unknown, options?: FirstCityCallOptions) {
    return this.firstCity.request(route, request, options, this.firstCityJournal);
  }

  readFirstCityHistory(scope: FirstCityScope) { return this.firstCityJournal.read(scope); }

  openRecruitSubmission(policy: Pick<RecruitSubmissionChannel, "authorize" | "blockProfile" | "reserve">) {
    return openRecruitSubmissionJournal(() => this.authenticatedIdentity, {
      authorize: identity => policy.authorize(identity),
      blockProfile: identity => policy.blockProfile(identity),
      reserve: policy.reserve,
      exchange: async (payload, identity, signal) => {
        const live = this.authenticatedIdentity;
        if (!live || !this.sessionId || live.generation !== identity.generation ||
            live.accountId !== identity.accountId || live.playerId !== identity.playerId ||
            live.serverId !== identity.serverId || this.boundServerId !== live.serverId) {
          throw new Error("Recruit session unavailable");
        }
        const trace_id = crypto.randomUUID();
        const packet = getTypes().ClientPacket.encode({ route: "military.v1.RecruitTroopV2", payload, trace_id,
          session_id: this.sessionId, server_id: live.serverId }).finish();
        // The journal may persist a late accepted receipt in its original scope.
        return new Uint8Array(await this.sendAndWait(packet, trace_id, signal));
      },
    });
  }

  async submitPreparedRecruit(intent?: RecruitJournalIntent): Promise<PreparedRecruitResult> {
    const socket = this.ws;
    const identity = this.authenticatedIdentity;
    if (!identity) throw new Error("请先登录并进入游戏服");
    const recoveryBlock = `sanguo-recruit-block-v1:${identity.accountId}:${identity.serverId}:${identity.playerId}`;
    const authorize = () => {
      if (!socket || socket !== this.ws || socket.readyState !== WebSocket.OPEN ||
          identity !== this.authenticatedIdentity || !this.sessionId ||
          identity.serverId !== this.boundServerId) {
        throw new Error("当前连接无法使用募兵 V2，请重新登录");
      }
      if (localStorage.getItem(recoveryBlock) !== null) throw new Error("募兵记录需要核验");
    };
    authorize();
    // The journal keeps the command id locally; the server's unique command_id
    // makes a retry idempotent, so no external recovery service is required.
    const journal = await this.openRecruitSubmission({
      authorize,
      blockProfile: () => localStorage.setItem(recoveryBlock, "1"),
    });
    try {
      const last = await journal.inspect();
      authorize();
      if (intent === undefined && last?.phase !== "unknown") return "nothing-to-retry";
      if (intent !== undefined && last?.phase === "unknown") return "retry-required";
      const command = intent === undefined ? last!.command : await journal.prepare(last?.command.commandHex ?? null, intent);
      return await journal.submit(command);
    } finally {
      journal.close();
    }
  }

  private invalidateFirstCity(): void {
    this.firstCityReady = false;
    this.firstCity.reset();
  }

  /** The single durable recruit route is always active; no handshake opt-in. */
  readonly preparedRecruit = true;

  constructor(private readonly url = GATEWAY_WS_URL) {}

  connect(handlers: GatewayHandlers = {}): Promise<void> {
    this.invalidateFirstCity();
    return new Promise((resolve, reject) => {
      this.cancelConnect?.();
      const previous = this.ws;
      this.ws = null;
      previous?.close();
      this.authenticatedIdentity = null;
      this.sessionGeneration++;
      this.sessionId = "";
      this.boundServerId = 0;
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.binaryType = "arraybuffer";
      let pending = true;
      const current = () => this.ws === ws;
      const clearAttempt = () => {
        clearTimeout(timer);
        if (this.cancelConnect === cancel) this.cancelConnect = null;
      };
      const fail = (reason: unknown) => {
        if (!pending || !current()) return;
        pending = false;
        clearAttempt();
        this.ws = null; // Fence queued events before cancelling the owned handshake.
        reject(reason);
        ws.close();
      };
      const cancel = () => fail(new Error("网关连接已取消"));
      const timer = setTimeout(() => fail(new Error("网关连接超时，请刷新列表重试")), 15_000);
      this.cancelConnect = cancel;
      ws.onopen = () => {
        if (!current() || !pending) return;
        pending = false;
        clearAttempt();
        resolve();
        handlers.onOpen?.();
      };
      ws.onerror = (e) => {
        if (!current()) return;
        fail(e);
        handlers.onError?.(e);
      };
      ws.onclose = () => {
        if (!current()) return;
        this.invalidateFirstCity();
        pending = false;
        clearAttempt();
        this.ws = null;
        reject(new Error("网关连接已中断"));
        this.authenticatedIdentity = null;
        this.sessionGeneration++;
        this.sessionId = "";
        this.boundServerId = 0;
        handlers.onClose?.();
      };
    });
  }

  getAuthenticatedIdentity(): AuthenticatedIdentity | null { return this.authenticatedIdentity; }

  getSessionGeneration(): number { return this.sessionGeneration; }

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
    this.invalidateFirstCity();
    this.authenticatedIdentity = null;
    const generation = ++this.sessionGeneration;
    const { LoginResponse } = getTypes();
    const data = (await this.rpc(
      Routes.Login,
      "LoginRequest",
      { login_name: loginName, password, server_id: serverId },
      LoginResponse,
      false,
    )) as { session_id: string };
    if (generation !== this.sessionGeneration) throw new Error("会话已变更，请重新进入游戏");
    this.sessionId = data.session_id;
    this.boundServerId = serverId;
    this.firstCityReady = true;
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
    this.invalidateFirstCity();
    this.authenticatedIdentity = null;
    const generation = ++this.sessionGeneration;
    const authenticated = this.sessionId !== "";
    const { EnterGameServerResponse } = getTypes();
    const data = (await this.rpc(
      Routes.EnterGameServer,
      "EnterGameServerRequest",
      { server_id: serverId },
      EnterGameServerResponse,
      true,
    )) as { session_id?: string; server_id?: number; account_id?: string | null;
      player?: { server_id?: number; player_id?: number } };
    if (generation !== this.sessionGeneration) throw new Error("会话已变更，请重新进入游戏");
    if (data.session_id) this.sessionId = data.session_id;
    this.boundServerId = data.server_id ?? serverId;
    this.firstCityReady = authenticated;
    if (authenticated && data.account_id && Number.isInteger(serverId) && serverId > 0 &&
        data.server_id === serverId && data.player?.server_id === serverId &&
        Number.isSafeInteger(data.player.player_id) && data.player.player_id! > 0) {
      this.authenticatedIdentity = Object.freeze({ accountId: data.account_id, serverId,
        playerId: data.player.player_id!, generation });
    }
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

  async getWorldViewport(centerX: number, centerY: number, radiusX: number, radiusY: number) {
    const { GetWorldViewportResponse } = getTypes();
    return this.rpc(
      Routes.GetWorldViewport,
      "GetWorldViewportRequest",
      { center_x: centerX, center_y: centerY, radius_x: radiusX, radius_y: radiusY },
      GetWorldViewportResponse,
      true,
    );
  }

  async listOwnedFields(cityId: number) {
    const { ListOwnedFieldsResponse } = getTypes();
    return this.rpc(
      Routes.ListOwnedFields,
      "ListOwnedFieldsRequest",
      { city_id: cityId },
      ListOwnedFieldsResponse,
      true,
    );
  }

  async abandonField(cityId: number, x: number, y: number) {
    const { AbandonFieldResponse } = getTypes();
    return this.rpc(
      Routes.AbandonField,
      "AbandonFieldRequest",
      { city_id: cityId, x, y },
      AbandonFieldResponse,
      true,
    );
  }

  async startFieldGather(cityId: number, x: number, y: number) {
    const { StartFieldGatherResponse } = getTypes();
    return this.rpc(
      Routes.StartFieldGather,
      "StartFieldGatherRequest",
      { city_id: cityId, x, y },
      StartFieldGatherResponse,
      true,
    );
  }

  async listFieldGathers(cityId: number) {
    const { ListFieldGathersResponse } = getTypes();
    return this.rpc(
      Routes.ListFieldGathers,
      "ListFieldGathersRequest",
      { city_id: cityId },
      ListFieldGathersResponse,
      true,
    );
  }

  async claimFieldGather(gatherId: number) {
    const { ClaimFieldGatherResponse } = getTypes();
    return this.rpc(
      Routes.ClaimFieldGather,
      "ClaimFieldGatherRequest",
      { gather_id: gatherId },
      ClaimFieldGatherResponse,
      true,
    );
  }

  async getWorldTileDetail(x: number, y: number) {
    const { GetWorldTileDetailResponse } = getTypes();
    return this.rpc(
      Routes.GetWorldTileDetail,
      "GetWorldTileDetailRequest",
      { x, y },
      GetWorldTileDetailResponse,
      true,
    );
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

  async demolishBuilding(cityId: number, slotKey: string) {
    const { DemolishBuildingResponse } = getTypes();
    return this.rpc(
      Routes.DemolishBuilding,
      "DemolishBuildingRequest",
      { city_id: cityId, slot_key: slotKey },
      DemolishBuildingResponse,
      true,
    );
  }

  async getCityCivic(cityId: number) {
    const { GetCityCivicResponse } = getTypes();
    return this.rpc(Routes.GetCityCivic, "GetCityCivicRequest", { city_id: cityId }, GetCityCivicResponse, true);
  }

  async applyCityDecree(cityId: number, decree: number, value: number, name = "") {
    const { ApplyCityDecreeResponse } = getTypes();
    return this.rpc(
      Routes.ApplyCityDecree,
      "ApplyCityDecreeRequest",
      { city_id: cityId, decree, value, name },
      ApplyCityDecreeResponse,
      true,
    );
  }

  async listTechnics(cityId: number) {
    const { ListTechnicsResponse } = getTypes();
    return this.rpc(Routes.ListTechnics, "ListTechnicsRequest", { city_id: cityId }, ListTechnicsResponse, true);
  }

  async startTechnicResearch(cityId: number, tid: number) {
    const { StartTechnicResearchResponse } = getTypes();
    return this.rpc(
      Routes.StartTechnicResearch,
      "StartTechnicResearchRequest",
      { city_id: cityId, tid },
      StartTechnicResearchResponse,
      true,
    );
  }

  async listCityOffices(cityId: number) {
    const { ListCityOfficesResponse } = getTypes();
    return this.rpc(Routes.ListCityOffices, "ListCityOfficesRequest", { city_id: cityId }, ListCityOfficesResponse, true);
  }

  async setCityOffice(cityId: number, office: number, heroId: number) {
    const { SetCityOfficeResponse } = getTypes();
    return this.rpc(Routes.SetCityOffice, "SetCityOfficeRequest", { city_id: cityId, office, hero_id: heroId }, SetCityOfficeResponse, true);
  }

  async clearCityOffice(cityId: number, office: number) {
    const { ClearCityOfficeResponse } = getTypes();
    return this.rpc(Routes.ClearCityOffice, "ClearCityOfficeRequest", { city_id: cityId, office }, ClearCityOfficeResponse, true);
  }

  async payCityOfficeSalary(cityId: number) {
    const { PayCityOfficeSalaryResponse } = getTypes();
    return this.rpc(Routes.PayCityOfficeSalary, "PayCityOfficeSalaryRequest", { city_id: cityId }, PayCityOfficeSalaryResponse, true);
  }

  async rewardCityOfficeHero(cityId: number, heroId: number) {
    const { RewardCityOfficeHeroResponse } = getTypes();
    return this.rpc(Routes.RewardCityOfficeHero, "RewardCityOfficeHeroRequest", { city_id: cityId, hero_id: heroId }, RewardCityOfficeHeroResponse, true);
  }

  async listWallDefenses(cityId: number) {
    const { ListWallDefensesResponse } = getTypes();
    return this.rpc(Routes.ListWallDefenses, "ListWallDefensesRequest", { city_id: cityId }, ListWallDefensesResponse, true);
  }

  async buildWallDefense(cityId: number, defenseType: number) {
    const { BuildWallDefenseResponse } = getTypes();
    return this.rpc(Routes.BuildWallDefense, "BuildWallDefenseRequest", { city_id: cityId, defense_type: defenseType }, BuildWallDefenseResponse, true);
  }

  async healWounded(cityId: number, unitCfgId: number, count: number) {
    const { HealWoundedResponse } = getTypes();
    return this.rpc(Routes.HealWounded, "HealWoundedRequest", { city_id: cityId, unit_cfg_id: unitCfgId, count }, HealWoundedResponse, true);
  }

  async listHistoricalHeroes(cityId: number) {
    const { ListHistoricalHeroesResponse } = getTypes();
    return this.rpc(Routes.ListHistoricalHeroes, "ListHistoricalHeroesRequest", { server_id: 1, city_id: cityId }, ListHistoricalHeroesResponse, true);
  }

  async searchHistoricalHero(cityId: number, npcCfgId: number) {
    const { SearchHistoricalHeroResponse } = getTypes();
    return this.rpc(Routes.SearchHistoricalHero, "SearchHistoricalHeroRequest", { server_id: 1, city_id: cityId, npc_cfg_id: npcCfgId }, SearchHistoricalHeroResponse, true);
  }

  async persuadeHistoricalHero(cityId: number, npcCfgId: number) {
    const { PersuadeHistoricalHeroResponse } = getTypes();
    return this.rpc(Routes.PersuadeHistoricalHero, "PersuadeHistoricalHeroRequest", { server_id: 1, city_id: cityId, npc_cfg_id: npcCfgId }, PersuadeHistoricalHeroResponse, true);
  }

  async getHeroEquipment(cityId: number, heroId: number) {
    const { GetHeroEquipmentResponse } = getTypes();
    return this.rpc(Routes.GetHeroEquipment, "GetHeroEquipmentRequest", { server_id: 1, hero_id: heroId, city_id: cityId }, GetHeroEquipmentResponse, true);
  }

  async forgeEquipment(cityId: number, slotType: number, tier: number) {
    const { ForgeEquipmentResponse } = getTypes();
    return this.rpc(Routes.ForgeEquipment, "ForgeEquipmentRequest", { server_id: 1, city_id: cityId, slot_type: slotType, tier }, ForgeEquipmentResponse, true);
  }

  async enhanceEquipment(cityId: number, equipmentId: number) {
    const { EnhanceEquipmentResponse } = getTypes();
    return this.rpc(Routes.EnhanceEquipment, "EnhanceEquipmentRequest", { server_id: 1, city_id: cityId, equipment_id: equipmentId }, EnhanceEquipmentResponse, true);
  }

  async socketGem(cityId: number, equipmentId: number, gemCfgId: number) {
    const { SocketGemResponse } = getTypes();
    return this.rpc(Routes.SocketGem, "SocketGemRequest", { server_id: 1, city_id: cityId, equipment_id: equipmentId, gem_cfg_id: gemCfgId }, SocketGemResponse, true);
  }

  async equipItem(cityId: number, heroId: number, equipmentId: number) {
    const { EquipItemResponse } = getTypes();
    return this.rpc(Routes.EquipItem, "EquipItemRequest", { server_id: 1, city_id: cityId, hero_id: heroId, equipment_id: equipmentId }, EquipItemResponse, true);
  }

  async unequipItem(cityId: number, heroId: number, slotType: number) {
    const { UnequipItemResponse } = getTypes();
    return this.rpc(Routes.UnequipItem, "UnequipItemRequest", { server_id: 1, city_id: cityId, hero_id: heroId, slot_type: slotType }, UnequipItemResponse, true);
  }

  async trainMount(cityId: number, equipmentId: number) {
    const { TrainMountResponse } = getTypes();
    return this.rpc(Routes.TrainMount, "TrainMountRequest", { server_id: 1, city_id: cityId, equipment_id: equipmentId }, TrainMountResponse, true);
  }

  async listTacticPresets(cityId: number) {
    const { ListTacticPresetsResponse } = getTypes();
    return this.rpc(Routes.ListTacticPresets, "ListTacticPresetsRequest", { city_id: cityId }, ListTacticPresetsResponse, true);
  }

  async setTacticPreset(cityId: number, unitCfgId: number, targetType: number, hold: boolean) {
    const { SetTacticPresetResponse } = getTypes();
    return this.rpc(Routes.SetTacticPreset, "SetTacticPresetRequest", {
      city_id: cityId, unit_cfg_id: unitCfgId, target_type: targetType, hold,
    }, SetTacticPresetResponse, true);
  }

  async getPlayerRank() {
    const { GetPlayerRankResponse } = getTypes();
    return this.rpc(Routes.GetPlayerRank, "GetPlayerRankRequest", { server_id: 1 }, GetPlayerRankResponse, true);
  }

  async promoteRank(cityId: number) {
    const { PromoteRankResponse } = getTypes();
    return this.rpc(Routes.PromoteRank, "PromoteRankRequest", { server_id: 1, city_id: cityId }, PromoteRankResponse, true);
  }

  async castTrick(cityId: number, trickType: number, targetMarchId: number) {
    const { CastTrickResponse } = getTypes();
    return this.rpc(Routes.CastTrick, "CastTrickRequest", { server_id: 1, city_id: cityId, trick_type: trickType, target_march_id: targetMarchId }, CastTrickResponse, true);
  }

  async runDrill(cityId: number, attacker: { unit_cfg_id: number; count: number }[], defender: { unit_cfg_id: number; count: number }[]) {
    const { RunDrillResponse } = getTypes();
    return this.rpc(Routes.RunDrill, "RunDrillRequest", { city_id: cityId, attacker, defender }, RunDrillResponse, true);
  }

  async getStorehouse(cityId: number) {
    const { GetStorehouseResponse } = getTypes();
    return this.rpc(Routes.GetStorehouse, "GetStorehouseRequest", { city_id: cityId }, GetStorehouseResponse, true);
  }

  async getMarket(cityId: number) {
    const { GetMarketResponse } = getTypes();
    return this.rpc(Routes.GetMarket, "GetMarketRequest", { city_id: cityId }, GetMarketResponse, true);
  }

  async buyFromMerchant(cityId: number, resourceType: number, amount: number) {
    const { BuyFromMerchantResponse } = getTypes();
    return this.rpc(Routes.BuyFromMerchant, "BuyFromMerchantRequest", { city_id: cityId, resource_type: resourceType, amount }, BuyFromMerchantResponse, true);
  }

  async sellToMerchant(cityId: number, resourceType: number, amount: number) {
    const { SellToMerchantResponse } = getTypes();
    return this.rpc(Routes.SellToMerchant, "SellToMerchantRequest", { city_id: cityId, resource_type: resourceType, amount }, SellToMerchantResponse, true);
  }

  async createMarketOffer(cityId: number, resourceType: number, amount: number, priceMilli: number, hours: number) {
    const { CreateMarketOfferResponse } = getTypes();
    return this.rpc(Routes.CreateMarketOffer, "CreateMarketOfferRequest", {
      city_id: cityId, resource_type: resourceType, amount, price_milli: priceMilli, hours,
    }, CreateMarketOfferResponse, true);
  }

  async cancelMarketOffer(cityId: number, offerId: number) {
    const { CancelMarketOfferResponse } = getTypes();
    return this.rpc(Routes.CancelMarketOffer, "CancelMarketOfferRequest", { city_id: cityId, offer_id: offerId }, CancelMarketOfferResponse, true);
  }

  async buyMarketOffer(cityId: number, offerId: number) {
    const { BuyMarketOfferResponse } = getTypes();
    return this.rpc(Routes.BuyMarketOffer, "BuyMarketOfferRequest", { city_id: cityId, offer_id: offerId }, BuyMarketOfferResponse, true);
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
    if (this.preparedRecruit) throw new Error("当前连接使用募兵 V2");
    const { RecruitTroopResponse } = getTypes();
    return this.rpc(
      Routes.RecruitTroop,
      "RecruitTroopRequest",
      { city_id: cityId, unit_cfg_id: unitCfgId, count },
      RecruitTroopResponse,
      true,
    );
  }

  async recallMarch(marchId: number) {
    const { RecallMarchResponse } = getTypes();
    return this.rpc(Routes.RecallMarch, "RecallMarchRequest", { march_id: marchId }, RecallMarchResponse, true);
  }

  async speedupMarch(marchId: number, itemCfgId: number) {
    const { SpeedupMarchResponse } = getTypes();
    return this.rpc(
      Routes.SpeedupMarch,
      "SpeedupMarchRequest",
      { march_id: marchId, item_cfg_id: itemCfgId },
      SpeedupMarchResponse,
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
    const generation = this.sessionGeneration;
    const session = this.sessionId;
    const server = this.boundServerId;
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
    if (generation !== this.sessionGeneration || (withSession && (session !== this.sessionId || server !== this.boundServerId))) {
      throw new Error("会话已变更，请重新进入游戏");
    }
    const sp = ServerPacket.decode(new Uint8Array(reply)) as unknown as ServerPacketShape;
    if (sp.code !== 0) {
      const err = new Error(sp.msg || `gateway error code=${sp.code}`);
      (err as Error & { code: number }).code = sp.code;
      throw err;
    }
    const response = decodeGatewayResponse(responseType, sp.data);
    if (withSession && generation === this.sessionGeneration && session === this.sessionId && server === this.boundServerId) {
      rememberSuccessfulReadNotice(response, route, sp.msg);
    }
    return response;
  }

  private sendAndWait(packet: Uint8Array, traceId: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const ws = this.ws;
    if (signal?.aborted) throw new Error("gateway request aborted");
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("gateway not connected");
    }
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        ws.removeEventListener("message", onMessage);
        ws.removeEventListener("close", onClose);
        signal?.removeEventListener("abort", onAbort);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("gateway timeout"));
      }, 15_000);
      const onClose = () => {
        cleanup();
        reject(new Error("gateway disconnected"));
      };
      const onAbort = () => {
        cleanup();
        reject(new Error("gateway request aborted"));
      };
      const onMessage = (ev: MessageEvent) => {
        const buf = ev.data as ArrayBuffer;
        if (signal && !(buf instanceof ArrayBuffer)) return;
        try {
          const sp = getTypes().ServerPacket.decode(new Uint8Array(buf)) as unknown as { trace_id?: string };
          if (sp.trace_id !== traceId) return;
        } catch { return; }
        cleanup();
        resolve(buf);
      };
      ws.addEventListener("message", onMessage);
      ws.addEventListener("close", onClose);
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        ws.send(packet);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  close(): void {
    this.invalidateFirstCity();
    this.cancelConnect?.();
    this.authenticatedIdentity = null;
    this.sessionGeneration++;
    this.ws?.close();
    this.ws = null;
    this.sessionId = "";
    this.boundServerId = 0;
  }
}
