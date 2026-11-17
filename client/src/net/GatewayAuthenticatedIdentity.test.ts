import { afterEach, beforeEach, expect, it, vi } from "vitest";
import protobuf from "protobufjs";
import { GatewayClient } from "./GatewayClient";
import { getTypes, Routes } from "./loadProto";
import { decodeGatewayResponse } from "./decodeGatewayResponse";

const types = getTypes();
const entry = (patch = {}) => ({ session_id: "same-token", server_id: 1,
  player: { server_id: 1, player_id: 7 }, account_id: "9223372036854775807", ...patch });
const body = (value = entry()) => types.EnterGameServerResponse.encode(types.EnterGameServerResponse.fromObject(value)).finish();
const concat = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap(p => [...p]));
const scalar = (tag: number, n: string) => protobuf.Writer.create().uint32(tag).uint64(n).finish();
class Socket extends EventTarget {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  binaryType = "";
  onopen?: () => void;
  onclose?: () => void;
  requests: { route: string; trace_id: string; session_id: string }[] = [];
  constructor() { super(); Socket.latest = this; }
  send = vi.fn((packet: Uint8Array) => {
    this.requests.push(types.ClientPacket.toObject(types.ClientPacket.decode(packet)) as never);
  });
  reply(data: Uint8Array, trace = this.requests.at(-1)!.trace_id, code = 0) {
    const bytes = types.ServerPacket.encode({ code, trace_id: trace, data }).finish();
    this.dispatchEvent(new MessageEvent("message", { data: Uint8Array.from(bytes).buffer }));
  }
  close() { this.readyState = 3; this.onclose?.(); this.dispatchEvent(new Event("close")); }
}
async function connected() {
  const gateway = new GatewayClient();
  const ready = gateway.connect(); const socket = Socket.latest; socket.onopen?.(); await ready;
  const pending = gateway.login("name-is-not-identity", "test-only", 1);
  socket.reply(types.LoginResponse.encode({ session_id: "same-token" }).finish()); await pending;
  return { gateway, socket };
}
async function enter(gateway: GatewayClient, socket: Socket, value = entry(), server = 1) {
  const pending = gateway.enterGameServer(server); socket.reply(body(value)); return pending;
}
beforeEach(() => { vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(["1", "9007199254740991", "9007199254740992", "9007199254740993", "9223372036854775807"])("retains exact account %s through production transport", async account_id => {
  const { gateway, socket } = await connected();
  expect(gateway.getAuthenticatedIdentity()).toBeNull();
  expect((await enter(gateway, socket, entry({ account_id })) as any).account_id).toBe(account_id);
  const identity = gateway.getAuthenticatedIdentity();
  expect(identity).toEqual({ accountId: account_id, serverId: 1, playerId: 7, generation: gateway.getSessionGeneration() });
  expect(Object.isFrozen(identity)).toBe(true);
  expect(socket.requests.map(r => r.route)).toEqual([Routes.Login, Routes.EnterGameServer]);
});
it.each([undefined, "0"])("keeps old server entry playable without identity (%s)", async account_id => {
  const { gateway, socket } = await connected();
  await enter(gateway, socket); await enter(gateway, socket, entry({ account_id }));
  expect(gateway.getAuthenticatedIdentity()).toBeNull();
  expect(gateway.getSessionId()).toBe("same-token"); expect(gateway.getBoundServerId()).toBe(1);
});
it("keeps generic numeric conversion and Register separate from entry identity", () => {
  expect(decodeGatewayResponse(types.RegisterResponse, types.RegisterResponse.encode({ account_id: 7 }).finish()).account_id).toBe(7);
  expect(() => decodeGatewayResponse(types.RegisterResponse, types.RegisterResponse.encode(types.RegisterResponse.fromObject({ account_id: "9223372036854775807" })).finish())).toThrow("safe range");
  expect(() => decodeGatewayResponse(types.EnterGameServerResponse, body(entry({ player: { server_id: 1, player_id: "9007199254740992" } })))).toThrow("safe range");
});
it.each([
  scalar(48, "18446744073709551615"), scalar(48, "9223372036854775808"),
  Uint8Array.of(48, 129, 0), Uint8Array.of(48, ...new Array(9).fill(128), 2),
  scalar(48, "2"), scalar(16, "4294967297"),
  protobuf.Writer.create().uint32(26).bytes(scalar(8, "4294967297")).finish(),
  protobuf.Writer.create().uint32(26).bytes(scalar(16, "18446744073709551617")).finish(),
])("cannot open identity from ambiguous or overflowing wire %#", async suffix => {
  const { gateway, socket } = await connected();
  const pending = gateway.enterGameServer(1); socket.reply(concat(body(), suffix));
  await pending.catch(() => undefined);
  expect(gateway.getAuthenticatedIdentity()).toBeNull();
});
it("retains safe legacy entry for conflicting duplicates", async () => {
  const { gateway, socket } = await connected(); const pending = gateway.enterGameServer(1);
  socket.reply(concat(body(), scalar(48, "2")));
  await expect(pending).resolves.toMatchObject({ server_id: 1, player: { player_id: 7 } });
  expect(gateway.getAuthenticatedIdentity()).toBeNull();
});
it("allows same scalar duplicates and ordinary future unknown fields", async () => {
  const { gateway, socket } = await connected(); const pending = gateway.enterGameServer(1);
  const future = protobuf.Writer.create().uint32(800).uint32(9).uint32(810).string("future").uint32(819).uint32(8).uint32(1).uint32(820).finish();
  socket.reply(concat(body(), scalar(48, "9223372036854775807"), scalar(16, "1"), future)); await pending;
  expect(gateway.getAuthenticatedIdentity()?.accountId).toBe("9223372036854775807");
});
it.each([Uint8Array.of(48, 128), Uint8Array.of(26, 10, 8), Uint8Array.of(48), Uint8Array.of(50, 1, 1)])("does not establish identity from truncated/wrong wire %#", async malformed => {
  const { gateway, socket } = await connected(); const pending = gateway.enterGameServer(1);
  socket.reply(malformed); await pending.catch(() => undefined);
  expect(gateway.getAuthenticatedIdentity()).toBeNull();
});
it.each([{ server_id: 2 }, { player: { server_id: 2, player_id: 7 } }, { player: null }, { player: { server_id: 1, player_id: 0 } }])("rejects conflicting selected scope %j", async patch => {
  const { gateway, socket } = await connected(); await enter(gateway, socket, entry(patch));
  expect(gateway.getAuthenticatedIdentity()).toBeNull();
});
it("cannot derive identity from successful unauthenticated entry or Register", async () => {
  const gateway = new GatewayClient(); const ready = gateway.connect(); const socket = Socket.latest;
  socket.onopen?.(); await ready;
  const registered = gateway.register("name", "test-only"); socket.reply(types.RegisterResponse.encode({ account_id: 123 }).finish()); await registered;
  await enter(gateway, socket); expect(gateway.getAuthenticatedIdentity()).toBeNull();
});
it.each(["login", "entry", "close", "reconnect"])("clears identity on %s and fences delayed responses", async action => {
  const { gateway, socket } = await connected(); await enter(gateway, socket);
  const old = gateway.enterGameServer(1); const oldTrace = socket.requests.at(-1)!.trace_id;
  expect(gateway.getAuthenticatedIdentity()).toBeNull(); const rejected = expect(old).rejects.toThrow();
  if (action === "close") gateway.close();
  else if (action === "reconnect") { const ready = gateway.connect(); Socket.latest.onopen?.(); await ready; }
  else {
    const newer = action === "login" ? gateway.login("other", "test-only", 2) : gateway.enterGameServer(2);
    socket.reply(action === "login" ? types.LoginResponse.encode({ session_id: "same-token" }).finish() : body(entry({ account_id: "2", server_id: 2, player: { server_id: 2, player_id: 8 } })));
    await newer;
  }
  const current = gateway.getAuthenticatedIdentity(); socket.reply(body(), oldTrace); await rejected;
  expect(gateway.getAuthenticatedIdentity()).toBe(current);
  if (action === "entry") expect(current).toMatchObject({ accountId: "2", serverId: 2, playerId: 8 });
  else expect(current).toBeNull();
});
it.each(["login", "entry", "close", "reconnect"])("invalidates established identity on %s before any reply", async action => {
  const { gateway, socket } = await connected(); await enter(gateway, socket);
  let pending: Promise<unknown> | undefined;
  if (action === "login") pending = gateway.login("other", "test-only", 1);
  if (action === "entry") pending = gateway.enterGameServer(1);
  if (action === "close") gateway.close();
  if (action === "reconnect") { pending = gateway.connect(); Socket.latest.onopen?.(); }
  expect(gateway.getAuthenticatedIdentity()).toBeNull();
  if (action === "login" || action === "entry") socket.reply(new Uint8Array(), undefined, 20001);
  await pending?.catch(() => undefined); expect(gateway.getAuthenticatedIdentity()).toBeNull();
});
it("ignores unsolicited/wrong traces and clears on disconnect without deleting retained records", async () => {
  const { gateway, socket } = await connected(); const clear = vi.spyOn(Storage.prototype, "clear");
  const remove = vi.spyOn(Storage.prototype, "removeItem");
  socket.reply(body(), "unsolicited"); expect(gateway.getAuthenticatedIdentity()).toBeNull();
  const pending = gateway.enterGameServer(1); socket.reply(body(), "wrong");
  expect(gateway.getAuthenticatedIdentity()).toBeNull(); socket.reply(body()); await pending;
  socket.close(); expect(gateway.getAuthenticatedIdentity()).toBeNull();
  expect(clear).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); clear.mockRestore(); remove.mockRestore();
});
it.each(["timeout", "send", "gateway"])("failed %s entry cannot retain identity or accept late responses", async failure => {
  const { gateway, socket } = await connected(); await enter(gateway, socket); vi.useFakeTimers();
  if (failure === "send") socket.send.mockImplementationOnce(() => { throw new Error("send failed"); });
  const pending = gateway.enterGameServer(1); const rejected = expect(pending).rejects.toThrow();
  expect(gateway.getAuthenticatedIdentity()).toBeNull();
  if (failure === "timeout") await vi.advanceTimersByTimeAsync(15000);
  if (failure === "gateway") socket.reply(body(), undefined, 20001);
  await rejected; socket.reply(body()); expect(gateway.getAuthenticatedIdentity()).toBeNull();
});
it.each([
  concat(body(entry({ account_id: undefined })), Uint8Array.of(48, 129, ...new Array(8).fill(128), 2)),
  concat(body(entry({ account_id: undefined })), Uint8Array.of(48, 129, 0)),
  concat(body(entry({ server_id: undefined })), scalar(16, "4294967297")),
  concat(body(entry({ player: undefined })), protobuf.Writer.create().uint32(26).bytes(concat(scalar(8, "4294967297"), scalar(16, "7"))).finish()),
  concat(body(entry({ player: undefined })), protobuf.Writer.create().uint32(26).bytes(Uint8Array.of(8, 1, 16, 135, ...new Array(8).fill(128), 2)).finish()),
])("rejects sole oversized selected fields before decoder aliasing %#", async raw => {
  const { gateway, socket } = await connected(); const pending = gateway.enterGameServer(1);
  socket.reply(raw); await pending.catch(() => undefined);
  expect(gateway.getAuthenticatedIdentity()).toBeNull();
});
it("renewed credentials preserve stable account, while old socket close cannot erase a newer identity", async () => {
  const { gateway, socket } = await connected(); await enter(gateway, socket);
  const first = gateway.getAuthenticatedIdentity()!;
  const ready = gateway.connect(); const next = Socket.latest; next.onopen?.(); await ready;
  const login = gateway.login("same-account", "test-only", 1);
  next.reply(types.LoginResponse.encode({ session_id: "rotated-token" }).finish()); await login;
  await enter(gateway, next, entry({ session_id: "rotated-token" }));
  const current = gateway.getAuthenticatedIdentity(); socket.close();
  expect(current?.accountId).toBe(first.accountId); expect(current?.generation).toBeGreaterThan(first.generation);
  expect(gateway.getAuthenticatedIdentity()).toBe(current);
});
