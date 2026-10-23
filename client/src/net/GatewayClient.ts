import { GATEWAY_WS_URL } from "@/config";
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
    troops: { unit_cfg_id: number; count: number }[],
  ): Promise<unknown>;
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
    troops: { unit_cfg_id: number; count: number }[],
  ) {
    const { StartMarchResponse } = getTypes();
    return this.rpc(
      Routes.StartMarch,
      "StartMarchRequest",
      { city_id: cityId, to_x: toX, to_y: toY, purpose, troops },
      StartMarchResponse,
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
