import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { SocialPanels } from "./SocialPanels";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
function setup() {
  const mount = document.createElement("div"), status = vi.fn(); let generation = 1;
  const session = { serverId: 1, cityId: 1, cityName: "城", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const gateway = { getBoundServerId: () => 1, getSessionGeneration: () => generation,
    createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 7, name: "new guild" } }),
    joinGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 8, name: "joined guild" } }),
    listGuildMembers: vi.fn().mockResolvedValue({ members: [] }) };
  const panels = new SocialPanels(mount, gateway as unknown as GatewayPort, () => session, status);
  panels.attach();
  const write = (field: string, value: string) => { mount.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!.value = value; };
  const click = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  const summary = () => mount.querySelector('[data-role="guild-summary"]')!.textContent;
  write("guild-name", "name"); write("join-guild-id", "8");
  return { panels, mount, gateway, status, write, click, summary, relogin: () => { generation++; } };
}
beforeEach(() => sessionStorage.clear());
describe("guild membership safety", () => {
  it("shares one lock between duplicate create and join", async () => {
    const { panels, gateway, click } = setup(); const pending = deferred();
    gateway.createGuild.mockReturnValueOnce(pending.promise as never);
    click("create-guild"); click("create-guild"); click("join-guild");
    expect(gateway.createGuild).toHaveBeenCalledTimes(1); expect(gateway.joinGuild).not.toHaveBeenCalled();
    pending.resolve({ guild: { guild_id: 7, name: "new guild" } }); await flush(); panels.detach();
  });
  it.each(["-1", "1.5", "9007199254740992"])("rejects unsafe join ID %s", async (id) => {
    const { panels, gateway, click, write } = setup(); write("join-guild-id", id); click("join-guild"); await flush();
    expect(gateway.joinGuild).not.toHaveBeenCalled(); panels.detach();
  });
  it("old create response cannot populate a replacement panel", async () => {
    const { panels, gateway, click, summary, status } = setup(); const pending = deferred();
    gateway.createGuild.mockReturnValueOnce(pending.promise as never);
    click("create-guild"); panels.detach(); panels.attach(); status.mockClear();
    pending.resolve({ guild: { guild_id: 7, name: "old guild" } }); await flush();
    expect(summary()).not.toContain("old guild"); expect(gateway.listGuildMembers).not.toHaveBeenCalled(); expect(status).not.toHaveBeenCalled(); panels.detach();
  });
  it("holds the shared lock through the member read", async () => {
    const { panels, gateway, click, summary } = setup(); const members = deferred();
    gateway.listGuildMembers.mockReturnValueOnce(members.promise as never);
    click("join-guild"); await flush(); click("join-guild"); click("create-guild");
    expect(gateway.joinGuild).toHaveBeenCalledTimes(1); expect(gateway.createGuild).not.toHaveBeenCalled();
    expect(gateway.joinGuild).toHaveBeenCalledWith(1, 8);
    members.resolve({ members: [] }); await flush(); expect(summary()).toContain("joined guild");
    click("create-guild"); await flush(); expect(gateway.createGuild).toHaveBeenCalledTimes(1); panels.detach();
  });
  it.each(["create", "join"])("failed %s preserves fields and allows explicit retry", async (action) => {
    const { panels, gateway, click, mount } = setup();
    const rpc = action === "create" ? gateway.createGuild : gateway.joinGuild;
    rpc.mockRejectedValueOnce(new Error("retry")); click(`${action}-guild`); await flush();
    expect(mount.querySelector<HTMLInputElement>('[data-field="guild-name"]')!.value).toBe("name");
    expect(mount.querySelector<HTMLInputElement>('[data-field="join-guild-id"]')!.value).toBe("8");
    click(`${action}-guild`); await flush(); expect(rpc).toHaveBeenCalledTimes(2); panels.detach();
  });
  it.each([false, true])("old submit settlement cannot unlock new submission (reject=%s)", async (reject) => {
    const { panels, gateway, click, write, status, summary } = setup(); const old = deferred(), fresh = deferred();
    gateway.createGuild.mockReturnValueOnce(old.promise as never); gateway.joinGuild.mockReturnValueOnce(fresh.promise as never);
    click("create-guild"); panels.detach(); panels.attach(); write("join-guild-id", "8"); click("join-guild"); status.mockClear();
    if (reject) old.reject(new Error("old error")); else old.resolve({ guild: { guild_id: 7, name: "old" } }); await flush();
    click("join-guild"); expect(gateway.joinGuild).toHaveBeenCalledTimes(1); expect(summary()).not.toContain("old"); expect(status).not.toHaveBeenCalled();
    fresh.resolve({ guild: { guild_id: 8, name: "fresh" } }); await flush(); expect(summary()).toContain("fresh"); panels.detach();
  });
  it.each([false, true])("relogin discards pending membership success/error (reject=%s)", async (reject) => {
    const { panels, gateway, click, relogin, summary, status } = setup(); const pending = deferred();
    gateway.joinGuild.mockReturnValueOnce(pending.promise as never); click("join-guild"); relogin(); status.mockClear();
    if (reject) pending.reject(new Error("old error")); else pending.resolve({ guild: { guild_id: 8, name: "old" } }); await flush();
    expect(summary()).not.toContain("old"); expect(status).not.toHaveBeenCalled(); expect(gateway.listGuildMembers).not.toHaveBeenCalled(); panels.detach();
  });
  it.each([false, true])("new membership read is not swallowed or overwritten by old members (reject=%s)", async (reject) => {
    const { panels, gateway, click, summary, status, mount } = setup(); click("join-guild"); await flush();
    const old = deferred(), fresh = deferred();
    gateway.listGuildMembers.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    click("refresh-members"); click("create-guild"); await flush();
    expect(gateway.listGuildMembers).toHaveBeenLastCalledWith(1, 7, 1); status.mockClear();
    if (reject) old.reject(new Error("old members")); else old.resolve({ guild: { name: "old members" }, members: [] }); await flush();
    expect(summary()).not.toContain("old members"); expect(status).not.toHaveBeenCalled();
    expect(mount.querySelector<HTMLButtonElement>('[data-action="refresh-members"]')!.disabled).toBe(true);
    fresh.resolve({ guild: { name: "fresh members" }, members: [] }); await flush();
    expect(summary()).toContain("fresh members"); panels.detach();
  });
  it("detached membership followup cannot update the replacement panel", async () => {
    const { panels, gateway, click, summary, status } = setup(); const pending = deferred();
    gateway.listGuildMembers.mockReturnValueOnce(pending.promise as never); click("create-guild"); await flush();
    panels.detach(); panels.attach(); status.mockClear(); pending.resolve({ guild: { name: "old read" }, members: [] }); await flush();
    expect(summary()).not.toContain("old read"); expect(status).not.toHaveBeenCalled(); panels.detach();
  });

});
