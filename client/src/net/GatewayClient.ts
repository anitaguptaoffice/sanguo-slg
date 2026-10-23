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
  getSessionId(): string;
  close(): void;
};

export class GatewayClient implements GatewayPort {
  private ws: WebSocket | null = null;
  private sessionId = "";

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
    return data;
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
  }
}
