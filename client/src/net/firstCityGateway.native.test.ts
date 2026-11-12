// @vitest-environment node
import { expect, it } from "vitest";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import { GatewayClient } from "./GatewayClient";
import { getProtoRoot, getTypes } from "./loadProto";
import type { FirstCityRoute } from "./firstCityGateway";

it("uses Node native WebSocket against a controlled binary protocol peer, not a V2 game server", async () => {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 }); await once(server, "listening");
  const address = server.address(); if (typeof address !== "object" || !address) throw Error("missing address");
  const types = getTypes(); const requests: { route: string; binary: boolean }[] = []; let mode = "valid";
  const discovery = Buffer.from("0a3b0a2431313131313131312d313131312d343131312d383131312d313131313131313131313131100118818080808080801020ffffffffffffffff7f12020a00", "hex");
  const scope = { realm_id: "11111111-1111-4111-8111-111111111111", server_id: 1, player_id: "9007199254740993", account_id: "9223372036854775807" };
  const proposal = { command_id: "22222222-2222-4222-8222-222222222222", predecessor: { empty: {} }, name: "城", x: 0, y: 499 };
  const record = { canonical: { scope, proposal, operation: "world.first_city", operation_version: 2, canonical_version: 1 },
    template: { template_version: "v1", rules_version: "r1", catalog_version: "c1", content_encoding_version: 1, content_sha256: new Uint8Array(32) },
    succeeded: { city_id: "9223372036854775807", server_id: 1, player_id: scope.player_id, is_capital: true, wall_level: 1, morale: 100 } };
  server.on("connection", socket => socket.on("message", (bytes, binary) => {
    const packet = types.ClientPacket.toObject(types.ClientPacket.decode(new Uint8Array(bytes as Buffer)));
    requests.push({ route: packet.route, binary });
    const type = getProtoRoot().lookupType(`sanguo.${packet.route}Response`);
    const body = packet.route.endsWith("Login") ? { session_id: "test-session" } : packet.route.endsWith("EnterGameServer") ?
      { session_id: "test-session", server_id: 1, account_id: scope.account_id, player: { server_id: 1, player_id: 7 } } :
      { outcome: { scope, kind: 1, requested_command_id: proposal.command_id, command: record, head: { command: record } } };
    const data = packet.route.endsWith("DiscoverFirstCityIntent") ? discovery : type.encode(type.fromObject(body)).finish();
    const response = types.ServerPacket.encode({ trace_id: packet.trace_id, data, ...(mode === "code" ? { code: 10003, msg: "private" } : {}) }).finish();
    if (mode === "close") return socket.close();
    if (mode === "text") return socket.send("not binary");
    if (mode === "duplicate") return socket.send(Buffer.concat([response, Buffer.from([8, 0, 8, 0])]));
    if (mode === "wrong") socket.send(types.ServerPacket.encode({ trace_id: "wrong", data: Uint8Array.of(255) }).finish());
    setTimeout(() => { if (socket.readyState === 1) socket.send(response); }, mode === "delay" ? 30 : 0);
  }));
  const gateway = new GatewayClient(`ws://127.0.0.1:${address.port}`);
  const route = (method: string) => `world.v2.${method}` as FirstCityRoute;
  try {
    await gateway.connect(); await gateway.login("controlled", "test-only", 1); await gateway.enterGameServer(1);
    const found = await gateway.requestFirstCity(route("DiscoverFirstCityIntent"), {});
    expect(found.scope.playerId).toBe(9007199254740993n); expect(gateway.getAuthenticatedIdentity()?.playerId).toBe(7);
    const proposalValue = { commandId: proposal.command_id, predecessor: { kind: "empty" }, name: "城", x: 0, y: 499 };
    for (const method of ["SubmitFirstCity", "ContinueFirstCity", "GetFirstCityResult"]) {
      const value = method === "GetFirstCityResult" ? { commandId: proposal.command_id } : { proposal: proposalValue };
      await expect(gateway.requestFirstCity(route(method), { expectedScope: found.scope, ...value })).resolves.toMatchObject({ command: { state: { cityId: 9223372036854775807n } } });
    }
    mode = "wrong"; await expect(gateway.requestFirstCity(route("DiscoverFirstCityIntent"), {})).resolves.toMatchObject({ kind: "discovery" });
    for (mode of ["text", "duplicate", "code", "delay", "close"]) {
      await expect(gateway.requestFirstCity(route("DiscoverFirstCityIntent"), {}, { timeoutMs: mode === "delay" ? 5 : 500 })).rejects.toThrow(/^First-city outcome UNKNOWN$/);
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    const count = requests.length; await new Promise(resolve => setTimeout(resolve, 40));
    expect(requests).toHaveLength(count); expect(count).toBe(12); expect(requests.every(request => request.binary)).toBe(true);
  } finally {
    gateway.close(); for (const socket of server.clients) socket.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
