import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { readRankManualLastRefreshMs } from "@/net/rankRefreshCooldown";
import { SocialPanels } from "./SocialPanels";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const page = (number: number, total = 65, mine = 43) => ({ entries: Array.from({ length: Math.min(20, Math.max(0, total - (number - 1) * 20)) }, (_, i) => ({ rank: (number - 1) * 20 + i + 1, entity_id: (number - 1) * 20 + i + 1, display_name: `[player ${(number - 1) * 20 + i + 1}]`, score: 100 })), total_count: total, my_rank: mine, snapshot_version: 1 });
function deferred() { let resolve!: (value: unknown) => void, reject!: (e: Error) => void; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
async function setup() {
  const mount = document.createElement("div"), status = vi.fn(); let generation = 1;
  const session = { serverId: 1, cityId: 1, player: { player_id: 43 }, wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const gateway = { getBoundServerId: () => 1, getSessionGeneration: () => generation, getLeaderboard: vi.fn().mockImplementation((_sid, _type, p) => Promise.resolve(page(p))) };
  const panels = new SocialPanels(mount, gateway as unknown as GatewayPort, () => session, status); panels.attach(); panels.toggleRank(); await flush();
  const button = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  const click = (action: string) => button(action).click();
  const ranks = () => [...mount.querySelectorAll<HTMLElement>('tr.rank-data-row')].map((el) => el.textContent).join("|");
  const select = (type: number) => { const el = mount.querySelector<HTMLSelectElement>('[data-field="rank-type"]')!; el.value = String(type); el.dispatchEvent(new Event("change", { bubbles: true })); };
  return { panels, gateway, mount, status, button, click, ranks, select, relogin: () => { generation++; } };
}
beforeEach(() => sessionStorage.clear());
describe("rank pagination", () => {
  it("makes rank21 and the viewer rank43 reachable", async () => {
    const s = await setup(); try {
      expect(s.mount.querySelector('[data-action="rank-next-page"]')).not.toBeNull();
      s.click("rank-next-page"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 2, 20); expect(s.ranks()).toContain("[player 21]");
      s.click("rank-my-page"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 3, 20); expect(s.ranks()).toContain("[player 43]");
    } finally { s.panels.detach(); }
  });  it("disables first/last/current-my-page boundaries and navigates back", async () => {
    const s = await setup(); try {
      expect(s.button("rank-prev-page").disabled).toBe(true);
      s.click("rank-my-page"); await flush(); expect(s.button("rank-my-page").disabled).toBe(true);
      s.click("rank-next-page"); await flush(); expect(s.button("rank-next-page").disabled).toBe(true);
      expect(s.mount.querySelector('[data-role="rank-page-status"]')!.textContent).toBe("第 4 / 4 页");
      s.click("rank-prev-page"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 3, 20);
    } finally { s.panels.detach(); }
  });
  it("keeps successful rows and page on failure and retries the requested page", async () => {
    const s = await setup(); try {
      s.gateway.getLeaderboard.mockRejectedValueOnce(new Error("page failed")); s.click("rank-next-page"); await flush();
      expect(s.ranks()).toContain("[player 1]"); expect(s.mount.querySelector('[data-role="rank-page-status"]')!.textContent).toBe("第 1 / 4 页");
      s.click("retry-refresh-rank"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 2, 20); expect(s.ranks()).toContain("[player 21]");
    } finally { s.panels.detach(); }
  });
  it("coalesces repeated navigation and reopening while a page is pending", async () => {
    const s = await setup(); try {
      const pending = deferred(); s.gateway.getLeaderboard.mockReturnValueOnce(pending.promise); s.click("rank-next-page"); s.click("rank-next-page");
      s.panels.toggleRank(); s.panels.toggleRank(); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenCalledTimes(2);
      expect(s.button("rank-prev-page").disabled).toBe(true); expect(s.button("rank-my-page").disabled).toBe(true);
      pending.resolve(page(2)); await flush(); expect(s.ranks()).toContain("[player 21]");
    } finally { s.panels.detach(); }
  });
  it("keeps independent successful page positions when switching boards", async () => {
    const s = await setup(); try {
      s.click("rank-next-page"); await flush(); s.select(2); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 2, 1, 20);
      s.select(1); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 2, 20);
    } finally { s.panels.detach(); }
  });
  it("ignores a late page response after switching boards", async () => {
    const s = await setup(); try {
      const pending = deferred(); s.gateway.getLeaderboard.mockReturnValueOnce(pending.promise); s.click("rank-next-page"); await flush();
      s.select(2); await flush(); pending.resolve(page(2)); await flush();
      expect(s.ranks()).not.toContain("[player 21]"); expect(s.mount.querySelector('[data-role="rank-page-status"]')!.textContent).toBe("第 1 / 4 页");
    } finally { s.panels.detach(); }
  });
  it("refreshes the displayed page instead of returning to the top20", async () => {
    const s = await setup(); try {
      s.click("rank-my-page"); await flush(); s.click("refresh-rank"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 3, 20);
      const count = s.gateway.getLeaderboard.mock.calls.length; s.click("refresh-rank"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenCalledTimes(count);
    } finally { s.panels.detach(); }
  });
  it("corrects an out-of-range page when a new snapshot shrinks", async () => {
    const s = await setup(); try {
      s.gateway.getLeaderboard.mockResolvedValueOnce(page(3, 22, 0)).mockResolvedValueOnce(page(2, 22, 0));
      s.click("rank-my-page"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 2, 20);
      expect(s.ranks()).toContain("[player 21]"); expect(s.mount.querySelector('[data-role="rank-page-status"]')!.textContent).toBe("第 2 / 2 页");
    } finally { s.panels.detach(); }
  });
  it("bounds correction attempts if snapshots keep shrinking", async () => {
    const s = await setup(); try {
      s.gateway.getLeaderboard.mockResolvedValueOnce(page(3, 22, 0)).mockResolvedValueOnce(page(2, 0, 0)); s.click("rank-my-page"); await flush();
      expect(s.gateway.getLeaderboard).toHaveBeenCalledTimes(3); expect(s.ranks()).toContain("[player 1]"); expect(s.status.mock.calls.flat().join(" ")).toContain("排行榜已变化");
    } finally { s.panels.detach(); }
  });
  it("disables pagination on an empty board or unranked viewer", async () => {
    const s = await setup(); try {
      s.gateway.getLeaderboard.mockResolvedValueOnce(page(1, 0, 0)); s.click("refresh-rank"); await flush();
      for (const action of ["rank-prev-page", "rank-next-page", "rank-my-page"]) expect(s.button(action).disabled).toBe(true);
      expect(s.mount.querySelector('[data-role="rank-page-status"]')!.textContent).toBe("第 1 / 1 页");
    } finally { s.panels.detach(); }
  });
  it("new actors start at page1 and cannot reuse previous actor pages", async () => {
    const s = await setup(); try {
      s.click("rank-my-page"); await flush(); s.relogin(); s.click("rank-next-page"); await flush();
      expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 1, 20); expect(s.ranks()).not.toContain("[player 43]");
    } finally { s.panels.detach(); }
  });
});
describe("pagination retry and scroll regressions", () => {
  it("resets overflowing table scroll after navigation", async () => {
    const s = await setup(); try {
      const table = s.mount.querySelector<HTMLElement>(".rank-table-scroll")!;
      Object.defineProperties(table, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } }); table.scrollTop = 700;
      s.click("rank-next-page"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 2, 20); expect(table.scrollTop).toBe(0);
    } finally { s.panels.detach(); }
  });
  it("successful navigation retry does not count as manual refresh", async () => {
    const s = await setup(); try {
      s.gateway.getLeaderboard.mockRejectedValueOnce(new Error("network")); s.click("rank-next-page"); await flush();
      s.click("retry-refresh-rank"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 2, 20); expect(readRankManualLastRefreshMs(1)).toBe(0);
    } finally { s.panels.detach(); }
  });
  it("allows navigation retry during unrelated manual refresh cooldown", async () => {
    const s = await setup(); try {
      s.click("refresh-rank"); await flush(); s.gateway.getLeaderboard.mockRejectedValueOnce(new Error("network")); s.click("rank-next-page"); await flush();
      expect(s.button("retry-refresh-rank").classList.contains("hidden")).toBe(false); expect(s.button("retry-refresh-rank").disabled).toBe(false);
      s.click("retry-refresh-rank"); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 2, 20);
    } finally { s.panels.detach(); }
  });
  it("does not describe page3 entries as the board top three", async () => {
    const s = await setup(); try {
      s.click("rank-my-page"); await flush(); s.click("refresh-rank"); await flush();
      expect(s.mount.querySelector(".rank-refreshed-hint-row")?.textContent ?? "").not.toContain("三甲");
    } finally { s.panels.detach(); }
  });
});
describe("pagination deep-link paths", () => {
  it("returns from own hero detail to page3 and restores table scroll", async () => {
    const s = await setup(); try {
      const hero = vi.fn().mockImplementation(async () => { s.panels.toggleRank(); });
      s.panels.setRankDeepLinkHandlers({ getViewerHeroIds: async () => [900], onOpenHeroDetail: hero });
      s.click("rank-my-page"); await flush();
      const table = s.mount.querySelector<HTMLElement>(".rank-table-scroll")!;
      Object.defineProperties(table, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } }); table.scrollTop = 400;
      s.mount.querySelector<HTMLButtonElement>('tr[data-entity-id="43"] [data-action="rank-view-hero"]')!.click(); await flush(); expect(hero).toHaveBeenCalledWith(900);
      s.panels.toggleRank(); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 3, 20);
      expect(table.scrollTop).toBe(400); expect(s.mount.querySelector('[data-role="rank-page-status"]')!.textContent).toBe("第 3 / 4 页");
    } finally { s.panels.detach(); }
  });
  it("opens the correct resource page2 summary and dismisses it on navigation", async () => {
    const s = await setup(); try {
      s.select(2); await flush(); s.click("rank-next-page"); await flush(); s.mount.querySelector<HTMLElement>('tr[data-entity-id="21"]')!.click(); await flush();
      const summary = s.mount.querySelector<HTMLElement>('[data-role="rank-entry-summary"]')!;
      expect(summary.classList.contains("hidden")).toBe(false); expect(summary.textContent).toContain("21. [player 21]");
      s.click("rank-prev-page"); await flush(); expect(summary.classList.contains("hidden")).toBe(true);
    } finally { s.panels.detach(); }
  });
});
describe("rank return after snapshot shrink", () => {
  it("does not restore page3 scroll onto a corrected page2", async () => {
    const s = await setup(); try {
      s.panels.setRankDeepLinkHandlers({ getViewerHeroIds: async () => [900], onOpenHeroDetail: async () => { s.panels.toggleRank(); } });
      s.click("rank-my-page"); await flush();
      const table = s.mount.querySelector<HTMLElement>(".rank-table-scroll")!;
      Object.defineProperties(table, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } }); table.scrollTop = 400;
      s.mount.querySelector<HTMLButtonElement>('tr[data-entity-id="43"] [data-action="rank-view-hero"]')!.click(); await flush();
      s.gateway.getLeaderboard.mockResolvedValueOnce(page(3, 22, 0)).mockResolvedValueOnce(page(2, 22, 0));
      s.panels.toggleRank(); await flush(); expect(s.gateway.getLeaderboard).toHaveBeenLastCalledWith(1, 1, 2, 20); expect(table.scrollTop).toBe(0);
    } finally { s.panels.detach(); }
  });
});
