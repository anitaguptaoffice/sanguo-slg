// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GatewayClient } from "./GatewayClient";
import { getProtoRoot, getTypes } from "./loadProto";
import { createFirstCityIntent } from "./firstCityCanonical";
import { decodeFirstCityRequest } from "./firstCityRequestCodec";
import type { FirstCityRoute } from "./firstCityGateway";

const types = getTypes();
const routes: FirstCityRoute[] = ["DiscoverFirstCityIntent", "SubmitFirstCity", "ContinueFirstCity", "GetFirstCityResult"].map(x => `world.v2.${x}` as FirstCityRoute);
const uuid = "22222222-2222-4222-8222-222222222222";
const scope = { realm_id: "11111111-1111-4111-8111-111111111111", server_id: 1, player_id: "9007199254740993", account_id: "9223372036854775807" };
const proposal = { command_id: uuid, predecessor: { empty: {} }, name: "城", x: 0, y: 499 };
const record = (s = scope, p = proposal) => ({ canonical: { scope: s, proposal: p, operation: "world.first_city", operation_version: 2, canonical_version: 1 },
  template: { template_version: "v1", rules_version: "r1", catalog_version: "c1", content_encoding_version: 1, content_sha256: new Uint8Array(32) }, pending: {} });
const outcome = (kind = 1, s = scope, p = proposal) => ({ outcome: { scope: s, kind, requested_command_id: p.command_id, command: record(s, p), head: { command: record(s, p) } } });
function encode(route: string, value: object) {
  const type = getProtoRoot().lookupType(`sanguo.${route}Response`);
  return type.encode(type.fromObject(value)).finish();
}
const join = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap(p => [...p]));
class Socket extends EventTarget {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  binaryType = "";
  onopen?: () => void;
  onclose?: () => void;
  requests: any[] = [];
  constructor() { super(); Socket.latest = this; }
  send = vi.fn((bytes: Uint8Array) => this.requests.push(types.ClientPacket.toObject(types.ClientPacket.decode(bytes))));
  raw(value: unknown) { this.dispatchEvent(new MessageEvent("message", { data: value })); }
  packet(data: Uint8Array, trace = this.requests.at(-1)!.trace_id, extra = {}) {
    return Uint8Array.from(types.ServerPacket.encode({ data, trace_id: trace, ...extra }).finish());
  }
  reply(value: object, route = this.requests.at(-1)!.route) { this.raw(this.packet(encode(route, value)).buffer); }
  close() { this.readyState = 3; this.onclose?.(); this.dispatchEvent(new Event("close")); }
}
async function connected(session = "same-session", shard = 1) {
  const gateway = new GatewayClient();
  const ready = gateway.connect(); const socket = Socket.latest; socket.onopen?.(); await ready;
  const login = gateway.login("test", "test-only", shard);
  socket.reply({ session_id: session }); await login;
  return { gateway, socket };
}
async function discover(gateway: GatewayClient, socket: Socket, s = scope) {
  const pending = gateway.requestFirstCity(routes[0], {});
  socket.reply({ scope: s, head: { empty: {} } });
  return pending;
}
const intent = (s = scope, p = proposal) => createFirstCityIntent({ realmId: s.realm_id, shard: s.server_id,
  playerId: s.player_id, accountId: s.account_id }, { commandId: p.command_id, predecessor: { kind: "empty" }, name: p.name, x: p.x, y: p.y });
const input = (value = intent()) => ({ expectedScope: value.scope, proposal: value.proposal });
beforeEach(() => { vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(["9007199254740991", "9007199254740992", "9007199254740993", "9223372036854775807"])("uses four production routes with lossless IDs %s", async id => {
  const { gateway, socket } = await connected(); const s = { ...scope, player_id: id, account_id: id };
  expect((await discover(gateway, socket, s)).scope.playerId).toBe(BigInt(id));
  expect(socket.binaryType).toBe("arraybuffer"); expect(gateway.getAuthenticatedIdentity()).toBeNull();
  for (const route of routes.slice(1)) {
    const original = intent(s); const value = route === routes[3] ? { expectedScope: original.scope, commandId: uuid } : input(original);
    const pending = gateway.requestFirstCity(route, value, { knownIntent: original });
    const packet = socket.requests.at(-1)!;
    expect(packet).toMatchObject({ route, server_id: 1, session_id: "same-session" });
    expect(decodeFirstCityRequest(route, packet.payload)).toEqual(value);
    socket.reply(outcome(1, s)); await expect(pending).resolves.toMatchObject({ kind: "command", scope: original.scope });
  }
  expect(socket.send).toHaveBeenCalledTimes(5); gateway.close();
});
it("binds complete request snapshots, keeps original conflict records, and never executes another winner", async () => {
  const { gateway, socket } = await connected(); await discover(gateway, socket);
  for (const route of routes.slice(1)) {
    for (const change of [{ name: "other" }, { x: 1 }, { y: 1 }, { command_id: "33333333-3333-4333-8333-333333333333" }]) {
      const value = route === routes[3] ? { expectedScope: intent().scope, commandId: uuid } : input();
      const pending = gateway.requestFirstCity(route, value, { knownIntent: intent() });
      socket.reply(outcome(1, scope, { ...proposal, ...change })); await expect(pending).rejects.toThrow("UNKNOWN");
    }
  }
  const changed = input(intent(scope, { ...proposal, name: "proposal" }));
  const conflict = gateway.requestFirstCity(routes[1], changed); socket.reply(outcome(2));
  await expect(conflict).resolves.toMatchObject({ kind: "idContentConflict", command: { intent: { proposal: { name: "城" } } } });
  const pending = gateway.requestFirstCity(routes[1], input());
  socket.reply({ outcome: { scope, kind: 3, requested_command_id: uuid, head: { command: record(scope, { ...proposal, command_id: "33333333-3333-4333-8333-333333333333" }) } } });
  await expect(pending).resolves.toMatchObject({ kind: "headConflict" }); const count = socket.send.mock.calls.length;
  await Promise.resolve(); expect(socket.send).toHaveBeenCalledTimes(count); gateway.close();
});
it.each(["realm_id", "server_id", "player_id", "account_id"])("rejects changed %s scope on requests and replies", async key => {
  const { gateway, socket } = await connected(); await discover(gateway, socket);
  const changed = { ...scope, [key]: key === "realm_id" ? uuid : key === "server_id" ? 2 : "1" };
  const count = socket.send.mock.calls.length;
  await expect(gateway.requestFirstCity(routes[1], input(intent(changed)))).rejects.toThrow("UNKNOWN");
  expect(socket.send).toHaveBeenCalledTimes(count);
  const pending = gateway.requestFirstCity(routes[1], input()); socket.reply(outcome(1, changed));
  await expect(pending).rejects.toThrow("UNKNOWN"); gateway.close();
});
it.each(["login", "enter", "connect", "close", "remote"])("cancels and revokes before %s, even for identical tokens", async action => {
  const { gateway, socket } = await connected(); await discover(gateway, socket);
  const pending = expect(gateway.requestFirstCity(routes[1], input())).rejects.toThrow("UNKNOWN");
  const oldTrace = socket.requests.at(-1)!.trace_id;
  let next: Promise<unknown> | undefined;
  if (action === "login") next = gateway.login("same", "test-only", 1);
  if (action === "enter") next = gateway.enterGameServer(2);
  if (action === "connect") { next = gateway.connect(); Socket.latest.onopen?.(); }
  if (action === "close") gateway.close();
  if (action === "remote") socket.close();
  await pending; await expect(gateway.requestFirstCity(routes[0], {})).rejects.toThrow("UNKNOWN");
  if (action === "login" || action === "enter") socket.reply({ session_id: "same-session", server_id: 2 });
  await next; socket.raw(socket.packet(encode(routes[1], outcome()), oldTrace).buffer);
  await expect(gateway.requestFirstCity(routes[1], input())).rejects.toThrow("UNKNOWN"); gateway.close();
});
it("rejects hostile envelopes before decoding; wrong trace cannot supply identity", async () => {
  const { gateway, socket } = await connected();
  const suffixes = [[0], [40, 0], [11, 12], [8, 128, 0], [8, 255, 255, 255, 255, 15], [18, 1, 255], [34, 0], [26, 128], [8, ...Array(10).fill(128)], [8, 0, 8, 0], [18, 0, 18, 0], [26, 0]];
  for (const suffix of suffixes) {
    const pending = gateway.requestFirstCity(routes[0], {});
    socket.raw(join(socket.packet(encode(routes[0], { scope, head: { empty: {} } })), Uint8Array.from(suffix)).buffer);
    await expect(pending).rejects.toThrow("UNKNOWN");
  }
  for (const raw of ["text", new Uint8Array(), new Blob(), socket.packet(new Uint8Array(16385)).buffer]) {
    const pending = gateway.requestFirstCity(routes[0], {}); socket.raw(raw); await expect(pending).rejects.toThrow("UNKNOWN");
  }
  const pending = gateway.requestFirstCity(routes[0], {});
  socket.raw(socket.packet(Uint8Array.of(255), "wrong").buffer);
  socket.reply({ scope, head: { empty: {} } }); await expect(pending).resolves.toMatchObject({ kind: "discovery" });
  const failed = gateway.requestFirstCity(routes[1], input()); socket.raw(socket.packet(new Uint8Array(), undefined, { code: 10003, msg: "secret" }).buffer);
  await expect(failed).rejects.toThrow(/^First-city outcome UNKNOWN$/); gateway.close();
});
it.each(["abort", "timeout", "send", "error", "supersede"])("cleans every %s wait and ignores late data", async failure => {
  const { gateway, socket } = await connected(); vi.useFakeTimers(); const controller = new AbortController();
  const add = vi.spyOn(socket, "addEventListener"); const remove = vi.spyOn(socket, "removeEventListener");
  const detached = vi.spyOn(controller.signal, "removeEventListener");
  if (failure === "send") socket.send.mockImplementationOnce(() => { throw Error("secret"); });
  const pending = expect(gateway.requestFirstCity(routes[0], {}, { signal: controller.signal, timeoutMs: 10 })).rejects.toThrow("UNKNOWN");
  if (failure === "abort") controller.abort();
  if (failure === "timeout") await vi.advanceTimersByTimeAsync(10);
  if (failure === "error") socket.dispatchEvent(new Event("error"));
  if (failure === "supersede") await discover(gateway, socket);
  await pending; expect(vi.getTimerCount()).toBe(0); expect(remove.mock.calls.length).toBe(add.mock.calls.length);
  expect(detached).toHaveBeenCalled(); gateway.close(); socket.reply({ scope, head: { empty: {} } }, routes[0]);
  await expect(gateway.requestFirstCity(routes[1], input())).rejects.toThrow("UNKNOWN");
});
it.each([["", 1], ["a".repeat(129), 1], ["城".repeat(43), 1], ["\ud800", 1], ["ok", 0], ["ok", 1.5], ["ok", 2147483648]])("rejects invalid session/shard %# without sending", async (session, shard) => {
  const { gateway, socket } = await connected(session as string, shard as number); const count = socket.send.mock.calls.length;
  await expect(gateway.requestFirstCity(routes[0], {})).rejects.toThrow("UNKNOWN"); expect(socket.send).toHaveBeenCalledTimes(count); gateway.close();
});
it("rejects already aborted calls without sending and snapshots intent before awaiting", async () => {
  const { gateway, socket } = await connected(); const controller = new AbortController(); controller.abort();
  await expect(gateway.requestFirstCity(routes[0], {}, { signal: controller.signal })).rejects.toThrow("UNKNOWN");
  await expect(gateway.requestFirstCity(routes[1], input())).rejects.toThrow("UNKNOWN"); expect(socket.send).toHaveBeenCalledTimes(1);
  await discover(gateway, socket); const value = { ...input(), proposal: { ...intent().proposal } };
  const pending = gateway.requestFirstCity(routes[1], value); value.proposal.name = "mutated";
  socket.reply(outcome()); await expect(pending).resolves.toMatchObject({ kind: "command" });
  const known = { ...intent(scope, { ...proposal, name: "wrong" }), matches: () => true };
  const lookup = gateway.requestFirstCity(routes[3], { expectedScope: intent().scope, commandId: uuid }, { knownIntent: known });
  socket.reply(outcome()); await expect(lookup).rejects.toThrow("UNKNOWN"); gateway.close();
});
