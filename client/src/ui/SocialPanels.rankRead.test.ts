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
const page = (name: string) => ({ entries: [{ rank: 1, entity_id: 3, display_name: name, score: 100 }], my_rank: 0 });
function setup() {
  const mount = document.createElement("div"), status = vi.fn(); let generation = 1;
  const session = { serverId: 1, cityId: 1, wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const gateway = { getBoundServerId: () => 1, getSessionGeneration: () => generation, getLeaderboard: vi.fn().mockResolvedValue(page("新榜")) };
  const panels = new SocialPanels(mount, gateway as unknown as GatewayPort, () => session, status); panels.attach();
  const select = (type: number) => { const el = mount.querySelector<HTMLSelectElement>('[data-field="rank-type"]')!; el.value = String(type); el.dispatchEvent(new Event("change", { bubbles: true })); };
  const list = () => mount.querySelector('[data-role="rank-list"]')!.textContent;
  const refresh = () => mount.querySelector<HTMLButtonElement>('[data-action="refresh-rank"]')!.click();
  return { panels, gateway, mount, status, select, list, refresh, relogin: () => { generation++; } };
}
beforeEach(() => sessionStorage.clear());
describe("rank read ownership", () => {
  it("switching boards starts new read and rejects old response", async () => {
    const { panels, gateway, select, list } = setup(); const old = deferred(); gateway.getLeaderboard.mockReturnValueOnce(old.promise as never);
    panels.toggleRank(); await flush(); select(2); await flush(); expect(gateway.getLeaderboard).toHaveBeenCalledTimes(2);
    old.resolve(page("旧榜")); await flush(); expect(list()).toContain("新榜"); expect(list()).not.toContain("旧榜"); panels.detach();
  });
  it("switching boards immediately removes previous actionable rows", async () => {
    const { panels, gateway, select, list } = setup(); panels.toggleRank(); await flush(); expect(list()).toContain("新榜");
    const next = deferred(); gateway.getLeaderboard.mockReturnValueOnce(next.promise as never); select(2); await flush(); expect(list()).not.toContain("新榜");
    next.resolve(page("资源榜")); await flush(); panels.detach();
  });
  it.each([false, true])("old completion cannot change pending new board (reject=%s)", async (reject) => {
    const { panels, gateway, select, list, status, mount } = setup(); const old = deferred(), fresh = deferred();
    gateway.getLeaderboard.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    panels.toggleRank(); await flush(); select(2); await flush(); status.mockClear();
    if (reject) old.reject(new Error("old")); else old.resolve(page("旧榜")); await flush();
    expect(status).not.toHaveBeenCalled(); expect(list()).not.toContain("旧榜");
    expect(mount.querySelector<HTMLButtonElement>('[data-action="refresh-rank"]')!.disabled).toBe(true);
    fresh.resolve(page("新榜")); await flush(); expect(list()).toContain("新榜"); panels.detach();
  });
  it("ABA tab changes fetch independently and reject the first A", async () => {
    const { panels, gateway, select, list } = setup(); const old = deferred(); gateway.getLeaderboard.mockReturnValueOnce(old.promise as never);
    panels.toggleRank(); await flush(); select(2); await flush(); select(1); await flush();
    expect(gateway.getLeaderboard).toHaveBeenCalledTimes(3); old.resolve(page("旧榜")); await flush(); expect(list()).toContain("新榜"); panels.detach();
  });
  it("same target reopening coalesces the active read", async () => {
    const { panels, gateway, list } = setup(); const pending = deferred(); gateway.getLeaderboard.mockReturnValueOnce(pending.promise as never);
    panels.toggleRank(); await flush(); panels.toggleRank(); panels.toggleRank(); await flush(); expect(gateway.getLeaderboard).toHaveBeenCalledTimes(1);
    pending.resolve(page("新榜")); await flush(); expect(list()).toContain("新榜"); panels.detach();
  });
  it("switch during hero IDs continuation cannot paint old board", async () => {
    const { panels, gateway, select, list } = setup(); gateway.getLeaderboard.mockResolvedValueOnce(page("旧榜")); const old = deferred(); const heroes = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue([]);
    panels.setRankDeepLinkHandlers({ getViewerHeroIds: heroes }); panels.toggleRank(); await flush(); select(2); await flush();
    old.resolve([99]); await flush(); expect(list()).toContain("新榜"); expect(list()).not.toContain("旧榜"); expect(heroes).toHaveBeenCalledTimes(2); panels.detach();
  });
  it.each([false, true])("remount ignores prior response (reject=%s)", async (reject) => {
    const { panels, gateway, list, status } = setup(); const old = deferred(); gateway.getLeaderboard.mockReturnValueOnce(old.promise as never);
    panels.toggleRank(); await flush(); panels.detach(); panels.attach(); panels.toggleRank(); await flush(); status.mockClear();
    if (reject) old.reject(new Error("old")); else old.resolve(page("旧榜")); await flush();
    expect(list()).toContain("新榜"); expect(status).not.toHaveBeenCalled(); panels.detach();
  });
  it.each([false, true])("relogin ignores old actor response (reject=%s)", async (reject) => {
    const { panels, gateway, select, list, status, relogin } = setup(); const old = deferred(); gateway.getLeaderboard.mockReturnValueOnce(old.promise as never);
    panels.toggleRank(); await flush(); relogin(); select(2); await flush(); status.mockClear();
    if (reject) old.reject(new Error("old")); else old.resolve(page("旧榜")); await flush();
    expect(list()).toContain("新榜"); expect(status).not.toHaveBeenCalled(); panels.detach();
  });
  it("current refresh failure keeps own board cache and allows retry", async () => {
    const { panels, gateway, refresh, list, status, mount } = setup(); panels.toggleRank(); await flush();
    gateway.getLeaderboard.mockRejectedValueOnce(new Error("current")); refresh(); await flush();
    expect(list()).toContain("新榜"); expect(status.mock.calls.flat().join(" ")).toContain("current");
    expect(mount.querySelector<HTMLButtonElement>('[data-action="refresh-rank"]')!.disabled).toBe(false);
    gateway.getLeaderboard.mockResolvedValueOnce(page("重试")); refresh(); await flush(); expect(list()).toContain("重试");
    expect(mount.querySelector<HTMLButtonElement>('[data-action="refresh-rank"]')!.disabled).toBe(true); panels.detach();
  });
  it("new actor cannot fall back to previous actor cached board", async () => {
    const { panels, gateway, list, refresh, relogin } = setup(); panels.toggleRank(); await flush(); relogin();
    gateway.getLeaderboard.mockRejectedValueOnce(new Error("new actor")); refresh(); await flush(); expect(list()).not.toContain("新榜"); panels.detach();
  });

});
