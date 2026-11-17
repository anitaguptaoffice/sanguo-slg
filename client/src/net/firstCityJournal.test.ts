// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FirstCityJournal } from "./firstCityJournal";
import { GatewayClient } from "./GatewayClient";
import { createFirstCityIntent } from "./firstCityCanonical";
import { decodeFirstCityRequest } from "./firstCityRequestCodec";
import { getProtoRoot, getTypes } from "./loadProto";
import type { FirstCityRoute } from "./firstCityGateway";

const submit = "world.v2.SubmitFirstCity", continuation = "world.v2.ContinueFirstCity";
const discover = "world.v2.DiscoverFirstCityIntent", get = "world.v2.GetFirstCityResult";
const scope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1,
  playerId: 9007199254740993n, accountId: 9223372036854775807n };
const proposal = { commandId: "22222222-2222-4222-8222-222222222222", predecessor: { kind: "empty" as const }, name: "城", x: 0, y: 499 };
const original = createFirstCityIntent(scope, proposal);
const input = (intent = original) => ({ expectedScope: intent.scope, proposal: intent.proposal });
const wireScope = { realm_id: scope.realmId, server_id: 1, player_id: String(scope.playerId), account_id: String(scope.accountId) };
const record = (state = "pending", commandId = proposal.commandId) => ({
  canonical: { scope: wireScope, operation: "world.first_city", operation_version: 2, canonical_version: 1,
    proposal: { command_id: commandId, predecessor: { empty: {} }, name: "城", x: 0, y: 499 } },
  template: { template_version: "v1", rules_version: "r1", catalog_version: "c1", content_encoding_version: 1, content_sha256: new Uint8Array(32) },
  [state]: state === "succeeded" ? { city_id: "9223372036854775807", server_id: 1, player_id: String(scope.playerId), is_capital: true, wall_level: 1, morale: 100 } : {},
});
const outcome = (state = "pending") => ({ outcome: { scope: wireScope, kind: 1,
  requested_command_id: proposal.commandId, command: record(state), head: { command: record(state) } } });
const empty = { scope: wireScope, head: { empty: {} } };
function encode(route: string, value: object) {
  const type = getProtoRoot().lookupType(`sanguo.${route}Response`);
  return Uint8Array.from(type.encode(type.fromObject(value)).finish());
}
let events: string[];
class Store implements Storage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { events.push("get"); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { events.push("set"); this.data.set(key, value); }
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
  send(bytes: Uint8Array) { events.push("send"); this.requests.push(types.ClientPacket.toObject(types.ClientPacket.decode(bytes))); }
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
  await reply(gateway, discover, {}, empty);
  return gateway;
}
async function reply(gateway: GatewayClient, route: FirstCityRoute, value: unknown, response: object) {
  const promise = gateway.requestPersistedFirstCity(route, value);
  Socket.latest.reply(response);
  return promise;
}
let storage: Store;
beforeEach(() => { events = []; storage = new Store(); vi.stubGlobal("localStorage", storage); vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { Socket.latest?.close(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("uses actual readback before both production commands, snapshots input, deduplicates and reloads losslessly", async () => {
  const gateway = await connected(); events.length = 0;
  const mutable = { expectedScope: { ...scope }, proposal: { ...proposal } };
  const pending = gateway.requestPersistedFirstCity(submit, mutable); mutable.proposal.name = "changed";
  expect(events.slice(events.lastIndexOf("set"))).toEqual(["set", "get", "send"]);
  expect(decodeFirstCityRequest(submit, Socket.latest.requests.at(-1)!.payload)).toEqual(input());
  Socket.latest.reply(outcome()); await pending;
  await reply(gateway, continuation, input(), outcome());
  const count = storage.length; events.length = 0;
  await reply(gateway, continuation, input(), outcome());
  expect(storage.length).toBe(count); expect(events).not.toContain("set"); expect(events.indexOf("get")).toBeLessThan(events.indexOf("send"));
  const history = new GatewayClient().readFirstCityHistory(scope);
  expect(history.unavailable).toBe(false); expect(history.intents.every(intent => original.matches(intent.encode()))).toBe(true);
  const bytes = history.intents[0].encode(); bytes.fill(0); expect(original.matches(history.intents[0].encode())).toBe(true);
  expect(() => (history.intents as any[]).push(original)).toThrow(); expect(Object.isFrozen(history.observations[0].scope)).toBe(true);
  expect([...storage.data.values()].join("")).not.toContain("test-session");
});
it.each(["noop", "quota", "read", "unequal"])("blocks actual sending on %s storage failure and retains the proposal", async failure => {
  const gateway = await connected(); const count = Socket.latest.requests.length;
  if (failure === "noop") vi.spyOn(storage, "setItem").mockImplementation(() => {});
  if (failure === "quota") vi.spyOn(storage, "setItem").mockImplementation(() => { throw Error("secret quota"); });
  if (failure === "read") vi.spyOn(storage, "getItem").mockImplementation(() => { throw Error("secret read"); });
  if (failure === "unequal") vi.spyOn(storage, "setItem").mockImplementation((key, value) => storage.data.set(key, value + " "));
  await expect(gateway.requestPersistedFirstCity(submit, input())).rejects.toThrow(/^First-city outcome UNKNOWN$/);
  expect(Socket.latest.requests.length).toBe(count);
  const history = gateway.readFirstCityHistory(scope);
  expect(history.unavailable).toBe(true); expect(history.intents[0].proposal.commandId).toBe(proposal.commandId);
});
it.each(["clear", "remove", "overwrite"])("keeps terminal and local evidence after external %s, quarantining only that scope", async change => {
  const gateway = await connected(); await reply(gateway, submit, input(), outcome("succeeded"));
  const key = [...storage.data.keys()][0];
  if (change === "clear") storage.clear();
  if (change === "remove") storage.removeItem(key);
  if (change === "overwrite") storage.setItem(key, "{}");
  const history = gateway.readFirstCityHistory(scope);
  expect(history.unavailable).toBe(true); expect(history.intents).toHaveLength(1);
  expect(history.observations.some(r => r.kind === "command" && r.command?.state.kind === "succeeded")).toBe(true);
  const count = Socket.latest.requests.length;
  await expect(gateway.requestPersistedFirstCity(continuation, input())).rejects.toThrow("UNKNOWN");
  expect(Socket.latest.requests.length).toBe(count);
  expect(gateway.readFirstCityHistory({ ...scope, shard: 2 })).toEqual({ intents: [], observations: [], unavailable: false });
});
it("retains success learned before its write fails and keeps quarantine after storage recovers", async () => {
  const gateway = await connected(); const pending = gateway.requestPersistedFirstCity(submit, input());
  const write = vi.spyOn(storage, "setItem").mockImplementation(() => { throw Error("quota"); });
  Socket.latest.reply(outcome("succeeded")); await expect(pending).rejects.toThrow("UNKNOWN"); write.mockRestore();
  expect(gateway.readFirstCityHistory(scope)).toMatchObject({ unavailable: true });
  expect(gateway.readFirstCityHistory(scope).observations.at(-1)).toMatchObject({ command: { state: { kind: "succeeded", cityId: 9223372036854775807n } } });
});
it.each(["realmId", "shard", "playerId", "accountId"])("isolates %s across independent instances and interleaved append operations", field => {
  const a = new FirstCityJournal(), b = new FirstCityJournal();
  const second = createFirstCityIntent(scope, { ...proposal, commandId: "33333333-3333-4333-8333-333333333333" });
  a.prepare(submit, original); const first = new Map(storage.data); b.prepare(submit, second); a.prepare(continuation, original);
  for (const [key, value] of first) expect(storage.getItem(key)).toBe(value);
  expect(new Set(b.read(scope).intents.map(i => i.proposal.commandId))).toEqual(new Set([proposal.commandId, second.proposal.commandId]));
  const changed = { ...scope, [field]: field === "realmId" ? second.proposal.commandId : field === "shard" ? 2 : 9007199254740992n };
  const other = createFirstCityIntent(changed, proposal); b.prepare(submit, other);
  expect(a.read(changed).intents).toHaveLength(1); expect(a.read(changed).intents[0].scope).toEqual(changed);
});
it.each(["json", "extra", "version", "hex", "c1", "scope", "key"])("rejects restored %s corruption without manufacturing absence", corruption => {
  new FirstCityJournal().prepare(submit, original);
  const [key, text] = [...storage.data][0]; const entry = JSON.parse(text);
  if (corruption === "extra") entry.extra = 1;
  if (corruption === "version") entry.version = 2;
  if (corruption === "hex") entry.data = "FF";
  if (corruption === "c1") entry.c1 = "00";
  storage.clear();
  const target = corruption === "scope" ? key.replace(":1:", ":2:") : corruption === "key" ? key + "bad" : key;
  storage.setItem(target, corruption === "json" ? "{" : JSON.stringify(entry));
  const history = new FirstCityJournal().read(corruption === "scope" ? { ...scope, shard: 2 } : scope);
  expect(history.unavailable).toBe(true); expect(history.intents).toHaveLength(0);
});
it("preserves winner, UNKNOWN, EMPTY and NOT_OBSERVED without executing or replacing known identities", async () => {
  const gateway = await connected();
  const winner = record("pending", "33333333-3333-4333-8333-333333333333");
  await reply(gateway, submit, input(), { outcome: { scope: wireScope, kind: 3, requested_command_id: proposal.commandId, head: { command: winner } } });
  const count = Socket.latest.requests.length; await Promise.resolve(); expect(Socket.latest.requests.length).toBe(count);
  const abort = new AbortController(); const unknown = gateway.requestPersistedFirstCity(continuation, input(), { signal: abort.signal });
  abort.abort(); await expect(unknown).rejects.toThrow("UNKNOWN");
  await reply(gateway, discover, {}, empty);
  await reply(gateway, get, { expectedScope: scope, commandId: proposal.commandId }, { outcome: { scope: wireScope, kind: 4, requested_command_id: proposal.commandId, head: { empty: {} } } });
  const history = gateway.readFirstCityHistory(scope);
  expect(history.unavailable).toBe(false); expect(history.intents.every(i => i.proposal.commandId === proposal.commandId)).toBe(true);
  expect(history.observations.some(r => r.kind === "headConflict" && r.head.kind === "command" && r.head.record.intent.proposal.commandId !== proposal.commandId)).toBe(true);
  const login = gateway.login("again", "test-only", 1); Socket.latest.reply({ session_id: "test-session" }); await login;
  await expect(gateway.requestPersistedFirstCity(continuation, input())).rejects.toThrow("UNKNOWN");
  const retained = gateway.readFirstCityHistory(scope);
  expect(retained.intents.map(i => [...i.encode()])).toEqual(history.intents.map(i => [...i.encode()]));
  expect(retained.observations.map(r => r.kind)).toEqual(history.observations.map(r => r.kind));
});
it("constructs lazily without browser storage and keeps raw legacy transport usable", async () => {
  vi.stubGlobal("localStorage", undefined);
  const gateway = new GatewayClient(); expect(gateway.readFirstCityHistory(scope).unavailable).toBe(true);
  const opening = gateway.connect(); Socket.latest.onopen?.(); await opening;
  const login = gateway.login("test", "test-only", 1); Socket.latest.reply({ session_id: "test-session" }); await login;
  const read = gateway.requestFirstCity(discover, {}); Socket.latest.reply(empty); await expect(read).resolves.toMatchObject({ kind: "discovery" });
});
it("retains terminal knowledge through timeout and later read-only absence observations", async () => {
  const gateway = await connected(); await reply(gateway, submit, input(), outcome("succeeded")); vi.useFakeTimers();
  const pending = expect(gateway.requestPersistedFirstCity(continuation, input(), { timeoutMs: 10 })).rejects.toThrow("UNKNOWN");
  const count = Socket.latest.requests.length; await vi.advanceTimersByTimeAsync(10); await pending;
  expect(Socket.latest.requests.length).toBe(count);
  await reply(gateway, discover, {}, empty);
  await reply(gateway, get, { expectedScope: scope, commandId: proposal.commandId }, { outcome: { scope: wireScope, kind: 4, requested_command_id: proposal.commandId, head: { empty: {} } } });
  const history = gateway.readFirstCityHistory(scope);
  expect(history.observations.some(r => r.kind === "command" && r.command?.state.kind === "succeeded")).toBe(true);
  expect(history.intents.every(i => original.matches(i.encode()))).toBe(true);
});
it.each(["abort", "login", "close", "discovery"])("fences synchronous %s during storage readback before sending", async action => {
  const gateway = await connected(); const controller = new AbortController(); let next: Promise<unknown> | undefined;
  vi.spyOn(storage, "setItem").mockImplementation((key, value) => {
    if (JSON.parse(value).kind === "intent") {
      if (action === "abort") controller.abort();
      if (action === "login") next = gateway.login("again", "test-only", 1);
      if (action === "close") gateway.close();
      if (action === "discovery") next = gateway.requestFirstCity(discover, {});
    }
    storage.data.set(key, value);
  });
  await expect(gateway.requestPersistedFirstCity(submit, input(), { signal: controller.signal })).rejects.toThrow("UNKNOWN");
  expect(Socket.latest.requests.filter(request => request.route === submit)).toHaveLength(0);
  expect(gateway.readFirstCityHistory(scope).intents).toHaveLength(1);
  if (next) { Socket.latest.reply(action === "login" ? { session_id: "test-session" } : empty); await next; }
});
