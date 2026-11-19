import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MainCityScene } from "@/scenes/MainCityScene";
import { GatewayClient } from "./GatewayClient";

const address = "ws://127.0.0.1:8080/ws";
const identity = { accountId: "9007199254740993", serverId: 1, playerId: 7, generation: 1 };
const intent = { city_id: "3", unit_cfg_id: 1, count: 20 };
const command = { commandHex: "07".repeat(16), payloadDigest: "08".repeat(32), intent,
  encodeRequest: () => Uint8Array.of(1) };

class Socket {
  static OPEN = 1;
  static latest: Socket | null;
  readyState = Socket.OPEN;
  protocol = "";
  binaryType = "";
  onopen?: () => void;
  close() { this.readyState = 3; }
  constructor(readonly url: string, readonly offer?: string) { Socket.latest = this; }
}

beforeEach(() => {
  Socket.latest = null;
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("location", { hostname: "127.0.0.1" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true }) }));
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

async function active() {
  const gateway = new GatewayClient(address);
  const connecting = gateway.connect();
  const socket = Socket.latest!;
  socket.onopen?.();
  await connecting;
  Object.assign(gateway, { authenticatedIdentity: identity, sessionId: "fixture", boundServerId: 1 });
  return { gateway, socket };
}

it("connects without a subprotocol offer and always uses the durable recruit route", async () => {
  const gateway = new GatewayClient(address);
  const pending = gateway.connect();
  const socket = Socket.latest!;
  expect(socket.offer).toBeUndefined();
  socket.onopen?.();
  await pending;
  await expect(gateway.recruitTroop(3, 1, 20)).rejects.toThrow("V2");
});

it("allows a new deliberate command and only reuses the stored intent on retry", async () => {
  const { gateway } = await active();
  const inspect = vi.fn().mockResolvedValueOnce(null)
    .mockResolvedValue({ phase: "unknown", command });
  const prepare = vi.fn().mockResolvedValue(command);
  const submit = vi.fn().mockResolvedValue("unknown");
  const close = vi.fn();
  vi.spyOn(gateway, "openRecruitSubmission").mockResolvedValue({ inspect, prepare, submit, close });
  expect(await gateway.submitPreparedRecruit(intent)).toBe("unknown");
  expect(await gateway.submitPreparedRecruit({ ...intent, count: 99 })).toBe("retry-required");
  expect(await gateway.submitPreparedRecruit()).toBe("unknown");
  expect(prepare).toHaveBeenCalledExactlyOnceWith(null, intent);
  expect(submit.mock.calls).toEqual([[command], [command]]);
  expect(close).toHaveBeenCalledTimes(3);
});

it("rejects stale socket authorization and keeps a scoped failed-quarantine fence", async () => {
  const { gateway, socket } = await active();
  const prepare = vi.fn();
  const inspect = vi.fn(async () => { socket.readyState = 3; return null; });
  const open = vi.spyOn(gateway, "openRecruitSubmission").mockResolvedValue({
    inspect, prepare, submit: vi.fn(), close: vi.fn(),
  });
  await expect(gateway.submitPreparedRecruit(intent)).rejects.toThrow("当前连接");
  expect(prepare).not.toHaveBeenCalled();
  const policy = open.mock.calls[0][0];
  policy.blockProfile(identity);
  socket.readyState = 1;
  await expect(gateway.submitPreparedRecruit()).rejects.toThrow("记录需要核验");
  expect(open).toHaveBeenCalledTimes(1);
});

it("discards prepared UI replies after relogin and retries independently of form or wallet", async () => {
  const scene = new MainCityScene() as unknown as Record<string, any>;
  let generation = 1;
  let receive!: (value: string) => void;
  const reply = new Promise<string>(resolve => { receive = resolve; });
  const submitPreparedRecruit = vi.fn().mockReturnValueOnce(reply).mockResolvedValue("nothing-to-retry");
  const recruitTroop = vi.fn();
  const panel = document.createElement("div");
  panel.innerHTML = '<p data-role="prepared-recruit-status"></p><input data-field="recruit-count" value="0">';
  Object.assign(scene, {
    session: { serverId: 1, player: { player_id: 7 }, cityId: 3, wallet: { food: 0 } },
    gateway: { preparedRecruit: true, submitPreparedRecruit, recruitTroop, getSessionGeneration: () => generation },
    militaryPanel: panel, cityStateFetch: { clear: vi.fn(), fetch: vi.fn() },
    syncMilitaryPanel: vi.fn(), renderHud: vi.fn(),
  });
  const retrying = scene.recruitPrepared(true);
  expect(submitPreparedRecruit).toHaveBeenCalledWith(undefined);
  generation++;
  await scene.recruitPrepared(true);
  receive("accepted");
  await retrying;
  expect(panel.textContent).toBe("没有待确认的募兵");
  expect(scene.cityStateFetch.fetch).not.toHaveBeenCalled();
  expect(recruitTroop).not.toHaveBeenCalled();
});
