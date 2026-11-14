// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FirstCityController } from "./firstCityController";
import { GatewayClient } from "./GatewayClient";
import { createFirstCityIntent } from "./firstCityCanonical";
import { getProtoRoot, getTypes } from "./loadProto";
import type { FirstCityRoute } from "./firstCityGateway";

const discover = "world.v2.DiscoverFirstCityIntent", submit = "world.v2.SubmitFirstCity";
const scope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1,
  playerId: 9007199254740993n, accountId: 9223372036854775807n };
const proposal = { commandId: "22222222-2222-4222-8222-222222222222", predecessor: { kind: "empty" as const }, name: "城", x: 0, y: 499 };
const input = () => ({ expectedScope: scope, proposal });
const wireScope = { realm_id: scope.realmId, server_id: 1, player_id: String(scope.playerId), account_id: String(scope.accountId) };
const record = (state = "pending") => ({
  canonical: { scope: wireScope, operation: "world.first_city", operation_version: 2, canonical_version: 1,
    proposal: { command_id: proposal.commandId, predecessor: { empty: {} }, name: "城", x: 0, y: 499 } },
  template: { template_version: "v1", rules_version: "r1", catalog_version: "c1", content_encoding_version: 1, content_sha256: new Uint8Array(32) },
  [state]: state === "succeeded" ? { city_id: "9223372036854775807", server_id: 1, player_id: String(scope.playerId), is_capital: true, wall_level: 1, morale: 100 } : {},
});
const outcome = (state = "pending") => ({ outcome: { scope: wireScope, kind: 1,
  requested_command_id: proposal.commandId, command: record(state), head: { command: record(state) } } });
const empty = { scope: wireScope, head: { empty: {} } };
function encode(route: string, value: object) {
  return Uint8Array.from(getProtoRoot().lookupType(`sanguo.${route}Response`).encode(getProtoRoot().lookupType(`sanguo.${route}Response`).fromObject(value)).finish());
}
class Store implements Storage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  clear() { this.data.clear(); }
  removeItem(key: string) { this.data.delete(key); }
}
const types = getTypes();
class Socket extends EventTarget {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  onopen?: () => void;
  onclose?: () => void;
  requests: any[] = [];
  constructor() { super(); Socket.latest = this; }
  send(bytes: Uint8Array) { this.requests.push(types.ClientPacket.toObject(types.ClientPacket.decode(bytes))); }
  reply(value: object) {
    const request = this.requests.at(-1)!;
    const data = request.route === "account.v1.Login" ? types.LoginResponse.encode(value).finish() : encode(request.route, value);
    this.dispatchEvent(new MessageEvent("message", { data: Uint8Array.from(types.ServerPacket.encode({ data, trace_id: request.trace_id }).finish()).buffer }));
  }
  close() { this.readyState = 3; this.onclose?.(); this.dispatchEvent(new Event("close")); }
}
async function connected() {
  const gateway = new GatewayClient();
  const opening = gateway.connect(); Socket.latest.onopen?.(); await opening;
  const login = gateway.login("test", "test-only", 1); Socket.latest.reply({ session_id: "test-session" }); await login;
  const controller = new FirstCityController(gateway);
  return { gateway, controller };
}
let storage: Store;
beforeEach(() => { storage = new Store(); vi.stubGlobal("localStorage", storage); vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { Socket.latest?.close(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("discovers scope and reduces monotonic knowledge from journal evidence", async () => {
  const { controller } = await connected();
  const pending = controller.discover(); Socket.latest.reply(empty); await pending;
  const knowledge = controller.snapshot()!;
  expect(knowledge.scope).toEqual(scope); expect(knowledge.unavailable).toBe(false);
  expect(knowledge.observations.some(value => value.kind === "discovery")).toBe(true);
  const refreshed = controller.refresh(scope);
  expect(refreshed.observations.length).toBe(knowledge.observations.length);
});
it("updates knowledge after persisted submit without implying eligibility", async () => {
  const { controller } = await connected();
  const discovery = controller.discover(); Socket.latest.reply(empty); await discovery;
  const command = controller.submit(input()); Socket.latest.reply(outcome()); const after = await command;
  expect(after.intents).toHaveLength(1);
  expect(createFirstCityIntent(scope, proposal).matches(after.intents[0].encode())).toBe(true);
  expect(after.head?.kind).toBe("command");
  expect(after.records[0]?.state.kind).toBe("pending");
});
it("marks unavailable when storage fails before submit and keeps sticky state on refresh", async () => {
  const { controller } = await connected();
  const discovery = controller.discover(); Socket.latest.reply(empty); await discovery;
  vi.spyOn(storage, "setItem").mockImplementation(() => { throw Error("quota"); });
  await expect(controller.submit(input())).rejects.toThrow(/^First-city outcome UNKNOWN$/);
  const knowledge = controller.refresh(scope);
  expect(knowledge.unavailable).toBe(true);
  expect(knowledge.intents[0]?.proposal.commandId).toBe(proposal.commandId);
});
