import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayClient } from "@/net/GatewayClient";
import { getTypes } from "@/net/loadProto";
import type { MainCitySession } from "@/net/bootstrapSession";
import { SocialPanels } from "./SocialPanels";

// Source-grounded fixture: mirrors guild/service.go JoinGuild membership-first
// rejection and ListGuildMembers public same-shard roster, encoded with production protos.
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const ownedGuild = { guild_id: 7001, server_id: 1, name: "虎贲营", leader_player_id: 10001,
  member_count: 1, member_limit: 50, created_at_ms: 1 };
const otherGuild = { ...ownedGuild, guild_id: 7002, name: "另一军团", leader_player_id: 10002 };
const actor = { player_id: 10001, display_name: "本服君主", role: 1, power: 5000, joined_at_ms: 1 };
const panelsToDetach: SocialPanels[] = [];
beforeEach(() => sessionStorage.clear());
afterEach(() => { panelsToDetach.forEach(p => p.detach()); panelsToDetach.length = 0; vi.restoreAllMocks(); });
async function fixture(initiallyMember: boolean) {
  const gateway = new GatewayClient(); const types = getTypes();
  let member = initiallyMember;
  const routes: string[] = [];
  const reply = (name: keyof typeof types, fields: object, trace: string, code = 0, msg = "") => {
    const data = code ? new Uint8Array() : types[name].encode(types[name].fromObject(fields)).finish();
    return Uint8Array.from(types.ServerPacket.encode({ code, msg, trace_id: trace, data }).finish()).buffer;
  };
  vi.spyOn(gateway as never, "sendAndWait").mockImplementation(async (packet: Uint8Array) => {
    const request = types.ClientPacket.toObject(types.ClientPacket.decode(packet), { longs: Number }) as any;
    routes.push(request.route);
    if (request.route === "account.v1.Login") return reply("LoginResponse", { session_id: "fixture-session" }, request.trace_id);
    if (request.route === "guild.v1.JoinGuild") {
      if (member) return reply("JoinGuildResponse", {}, request.trace_id, 60002, "already in a guild");
      member = true; return reply("JoinGuildResponse", { guild: ownedGuild }, request.trace_id);
    }
    if (request.route === "guild.v1.ListGuildMembers") {
      const q = types.ListGuildMembersRequest.toObject(types.ListGuildMembersRequest.decode(request.payload), { longs: Number }) as any;
      expect(q.page_size).toBe(50);
      return reply("ListGuildMembersResponse", { guild: q.guild_id === 7001 ? ownedGuild : otherGuild,
        members: [{ ...actor, player_id: q.guild_id === 7001 ? 10001 : 10002 }], total_count: 1 }, request.trace_id);
    }
    if (request.route === "chat.v1.ListChatMessages") return reply("ListChatMessagesResponse", { messages: [] }, request.trace_id);
    if (request.route === "chat.v1.SendChatMessage") {
      const chat = types.SendChatMessageRequest.toObject(types.SendChatMessageRequest.decode(request.payload), { longs: Number }) as any;
      expect(chat.guild_id).toBe(7001);
      return member ? reply("SendChatMessageResponse", {}, request.trace_id)
        : reply("SendChatMessageResponse", {}, request.trace_id, 61001, "channel forbidden");
    }
    throw new Error(`Unexpected route ${request.route}`);
  });
  await gateway.login("fixture", "unused-fixture", 1);
  const session = { serverId: 1, cityId: 1, cityName: "城", player: { ...actor },
    wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const mount = document.createElement("div"), status = vi.fn();
  const panels = new SocialPanels(mount, gateway, () => session, status);
  panels.attach(); panels.toggleGuild(); panelsToDetach.push(panels);
  const join = async (gid: number) => {
    mount.querySelector<HTMLInputElement>('[data-field="join-guild-id"]')!.value = String(gid);
    mount.querySelector<HTMLButtonElement>('[data-action="join-guild"]')!.click(); await flush(); await flush();
  };
  const openAndSendGuildChat = async () => {
    mount.querySelector<HTMLButtonElement>('[data-action="open-guild-chat-channel"]')!.click(); await flush();
    mount.querySelector<HTMLInputElement>('[data-field="chat-content"]')!.value = "军团同伴好";
    mount.querySelector<HTMLButtonElement>('[data-action="send-chat"]')!.click(); await flush();
  };
  return { gateway, panels, mount, routes, status, session, join, openAndSendGuildChat };
}
describe("guild re-entry audit via production gateway decode", () => {
  it("CONTROL: a fresh successful join enables the mounted guild channel", async () => {
    const f = await fixture(false); await f.join(7001); await f.openAndSendGuildChat();
    expect(f.panels.getGuildId()).toBe(7001);
    expect(f.routes).toContain("guild.v1.ListGuildMembers");
    expect(f.routes).toContain("chat.v1.SendChatMessage");
  });
  it("existing member re-entry recovers only after verified roster", async () => {
    const f = await fixture(true); await f.join(7001);
    expect(f.status).toHaveBeenLastCalledWith(expect.stringContaining("已恢复军团"));
    expect(f.routes).not.toContain("chat.v1.SendChatMessage");
    await f.openAndSendGuildChat();
    expect(f.routes.filter(r => r === "guild.v1.JoinGuild")).toHaveLength(1);
    expect(f.panels.getGuildId()).toBe(7001);
    expect(f.routes).toContain("guild.v1.ListGuildMembers");
    expect(f.routes).toContain("chat.v1.SendChatMessage");
  });
  it("AUTHORITY: production member read returns matching shard and actor only for their own guild", async () => {
    const f = await fixture(true);
    const own = await f.gateway.listGuildMembers(1, 7001, 1) as any;
    const other = await f.gateway.listGuildMembers(1, 7002, 1) as any;
    expect(own.guild).toMatchObject({ guild_id: 7001, server_id: 1 });
    expect(own.members.some((m: any) => m.player_id === 10001)).toBe(true);
    expect(other.guild).toMatchObject({ guild_id: 7002, server_id: 1 });
    expect(other.members.some((m: any) => m.player_id === 10001)).toBe(false);
    expect(f.panels.getGuildId()).toBe(0);
  });
  it("CONTROL: already-member error for a different guild must not grant local guild chat", async () => {
    const f = await fixture(true); await f.join(7002); await f.openAndSendGuildChat();
    expect(f.panels.getGuildId()).toBe(0);
    expect(f.routes).not.toContain("chat.v1.SendChatMessage");
  });
});


const confirmedRoster = () => ({ guild: { ...ownedGuild }, members: [{ ...actor }] });
it.each([
  ["wrong guild", { guild: { ...ownedGuild, guild_id: 7002 }, members: [actor] }],
  ["wrong shard", { guild: { ...ownedGuild, server_id: 2 }, members: [actor] }],
  ["missing guild", { members: [actor] }],
  ["zero guild", { guild: { ...ownedGuild, guild_id: 0 }, members: [actor] }],
  ["missing shard", { guild: { guild_id: 7001 }, members: [actor] }],
  ["missing actor", { guild: ownedGuild, members: [{ ...actor, player_id: 10002 }] }],
  ["empty page", { guild: ownedGuild, members: [], total_count: 70 }],
  ["zero actor", { guild: ownedGuild, members: [{ ...actor, player_id: 0 }] }],
])("never adopts unverified roster: %s", async (_name, roster) => {
  const f = await fixture(true);
  const read = vi.spyOn(f.gateway, "listGuildMembers").mockResolvedValue(roster);
  await f.join(7001);
  expect(read).toHaveBeenCalledTimes(1);
  expect(f.panels.getGuildId()).toBe(0);
  expect(f.routes.filter(r => r === "guild.v1.JoinGuild")).toHaveLength(1);
});
it.each([0, -1, NaN, undefined])("requires positive authenticated player ID: %s", async id => {
  const f = await fixture(true); f.session.player.player_id = id;
  const read = vi.spyOn(f.gateway, "listGuildMembers");
  await f.join(7001); expect(read).not.toHaveBeenCalled(); expect(f.panels.getGuildId()).toBe(0);
});
it("non-membership errors and create errors never start recovery", async () => {
  const f = await fixture(true), read = vi.spyOn(f.gateway, "listGuildMembers");
  vi.spyOn(f.gateway, "joinGuild").mockRejectedValue({ code: 60001 });
  await f.join(7001); expect(read).not.toHaveBeenCalled();
  vi.spyOn(f.gateway, "createGuild").mockRejectedValue({ code: 60002 });
  f.mount.querySelector<HTMLInputElement>('[data-field="guild-name"]')!.value = "new";
  f.mount.querySelector<HTMLButtonElement>('[data-action="create-guild"]')!.click(); await flush();
  expect(read).not.toHaveBeenCalled(); expect(f.panels.getGuildId()).toBe(0);
});
it("a failed roster read never replays join or adopts membership", async () => {
  const f = await fixture(true);
  const read = vi.spyOn(f.gateway, "listGuildMembers").mockRejectedValue(new Error("offline"));
  await f.join(7001); await flush();
  expect(read).toHaveBeenCalledTimes(1); expect(f.panels.getGuildId()).toBe(0);
  expect(f.routes.filter(r => r === "guild.v1.JoinGuild")).toHaveLength(1);
});
it("holds shared mutation lock throughout recovery", async () => {
  const f = await fixture(true); let resolve!: (value: any) => void;
  vi.spyOn(f.gateway, "listGuildMembers").mockImplementationOnce(() => new Promise(ok => { resolve = ok; }));
  await f.join(7001);
  f.mount.querySelector<HTMLButtonElement>('[data-action="join-guild"]')!.click();
  f.mount.querySelector<HTMLButtonElement>('[data-action="create-guild"]')!.click();
  expect(f.routes.filter(r => r === "guild.v1.JoinGuild")).toHaveLength(1);
  resolve(confirmedRoster()); await flush(); await flush();
  expect(f.panels.getGuildId()).toBe(7001);
});
it.each(["detach", "relogin"])("discards old verified roster after %s", async mode => {
  const f = await fixture(true); let resolve!: (value: any) => void;
  const read = vi.spyOn(f.gateway, "listGuildMembers").mockImplementationOnce(() => new Promise(ok => { resolve = ok; }));
  await f.join(7001);
  if (mode === "detach") { f.panels.detach(); f.panels.attach(); }
  else await f.gateway.login("fixture", "unused-fixture", 1);
  f.status.mockClear(); resolve(confirmedRoster()); await flush(); await flush();
  expect(f.panels.getGuildId()).toBe(0); expect(read).toHaveBeenCalledTimes(1);
  expect(f.status).not.toHaveBeenCalled();
});
