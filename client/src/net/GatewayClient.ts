import { GATEWAY_WS_URL } from "@/config";
import { getTypes } from "@/net/loadProto";

export type GatewayPort = {
  connect(handlers?: GatewayHandlers): Promise<void>;
  login(loginName: string, password: string, serverId: number): Promise<unknown>;
  getSessionId(): string;
  close(): void;
};

export type GatewayHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
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

  async login(loginName: string, password: string, serverId: number) {
    const { ClientPacket, ServerPacket, LoginRequest, LoginResponse } = getTypes();
    const traceId = crypto.randomUUID();
    const payload = LoginRequest.encode(
      LoginRequest.create({ login_name: loginName, password, server_id: serverId }),
    ).finish();
    const packet = ClientPacket.encode(
      ClientPacket.create({
        route: "account.v1.Login",
        payload,
        trace_id: traceId,
        session_id: "",
      }),
    ).finish();
    const reply = await this.sendAndWait(packet, traceId);
    const sp = ServerPacket.decode(new Uint8Array(reply)) as unknown as {
      code: number;
      msg?: string;
      data: Uint8Array;
    };
    if (sp.code !== 0) {
      throw new Error(sp.msg || `login failed code=${sp.code}`);
    }
    const data = LoginResponse.decode(sp.data) as unknown as { session_id: string };
    this.sessionId = data.session_id;
    return LoginResponse.decode(sp.data);
  }

  private sendAndWait(packet: Uint8Array, traceId: string): Promise<ArrayBuffer> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("gateway not connected");
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("gateway timeout")), 10_000);
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
  }
}
