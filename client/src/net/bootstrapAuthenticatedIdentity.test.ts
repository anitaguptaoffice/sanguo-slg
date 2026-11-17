import { afterEach, expect, it, vi } from "vitest";
import { GatewayClient } from "./GatewayClient";
import { bootstrapMainCity } from "./bootstrapSession";
import { getTypes, Routes } from "./loadProto";

const types = getTypes();
afterEach(() => vi.restoreAllMocks());
it.each([undefined, "0", "9223372036854775807"])("bootstrap exposes only live authenticated identity (%s)", async account_id => {
  const gateway = new GatewayClient();
  const profile = { server_id: 1, player_id: 7 };
  const responses = new Map([
    [Routes.Login, [types.LoginResponse, { session_id: "same-token", player: profile }]],
    [Routes.EnterGameServer, [types.EnterGameServerResponse, { session_id: "same-token", server_id: 1, player: profile, account_id }]],
    [Routes.ListPlayerCities, [types.ListPlayerCitiesResponse, { cities: [{ city_id: 1, is_capital: true }] }]],
    [Routes.GetCityState, [types.GetCityStateResponse, {}]],
  ] as const);
  vi.spyOn(gateway as never, "sendAndWait").mockImplementation(async (packet: Uint8Array) => {
    const request = types.ClientPacket.decode(packet) as unknown as { route: string; trace_id: string };
    const [type, value] = responses.get(request.route as never)!;
    return Uint8Array.from(types.ServerPacket.encode({ code: 0, trace_id: request.trace_id,
      data: type.encode(type.fromObject(value)).finish() }).finish()).buffer;
  });
  const session = await bootstrapMainCity(gateway, "name", "test-only", 1);
  expect(session.getAuthenticatedIdentity?.()).toBe(gateway.getAuthenticatedIdentity());
  if (account_id && account_id !== "0") expect(session.getAuthenticatedIdentity?.()?.accountId).toBe(account_id);
  else expect(session.getAuthenticatedIdentity?.()).toBeNull();
  expect({ ...session, serverId: 2 }.getAuthenticatedIdentity?.()).toBeNull();
  expect({ ...session, player: { server_id: 1, player_id: 8 } }.getAuthenticatedIdentity?.()).toBeNull();
  expect({ ...session, player: { ...session.player, server_id: 2 } }.getAuthenticatedIdentity?.()).toBeNull();
  await gateway.login("same-account", "test-only", 1);
  await gateway.enterGameServer(1);
  expect(session.getAuthenticatedIdentity?.()).toBeNull(); // Same token/actor, new generation.
  const current = await bootstrapMainCity(gateway, "name", "test-only", 1);
  gateway.close(); expect(current.getAuthenticatedIdentity?.()).toBeNull();
});
it("does not trust an arbitrary bootstrap entry field without gateway authority", async () => {
  const gateway = new GatewayClient();
  vi.spyOn(gateway, "login").mockResolvedValue({ session_id: "token" });
  vi.spyOn(gateway, "enterGameServer").mockResolvedValue({ account_id: "123", player: { server_id: 1, player_id: 7 } });
  vi.spyOn(gateway, "listPlayerCities").mockResolvedValue({ cities: [{ city_id: 1 }] });
  vi.spyOn(gateway, "getCityState").mockResolvedValue({});
  const session = await bootstrapMainCity(gateway, "name", "test-only", 1);
  expect(session.getAuthenticatedIdentity?.()).toBeNull();
});
