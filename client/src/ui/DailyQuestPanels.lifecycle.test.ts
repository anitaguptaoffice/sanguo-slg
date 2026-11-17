import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { DailyQuestPanels } from "./DailyQuestPanels";

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const rows = [1012, 1014].map((id) => ({ quest_cfg_id: id, chain_id: 400, state: 3 }));
function setup(state = 3) {
  const mount = document.createElement("div");
  const status = vi.fn();
  const patch = vi.fn();
  const session = { serverId: 1, cityId: 1, cityName: "城", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const gateway = {
    getBoundServerId: () => 1,
    listPlayerQuests: vi.fn().mockResolvedValue({ quests: rows.map(row => ({ ...row, state })) }),
    acceptQuest: vi.fn().mockResolvedValue({}),
    claimQuestReward: vi.fn().mockResolvedValue({}),
    listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
    getCityState: vi.fn().mockResolvedValue({ wallet: {} }),
  };
  const panels = new DailyQuestPanels(mount, gateway as unknown as GatewayPort, () => session, patch, status);
  panels.attach();
  const click = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  return { mount, panels, gateway, status, patch, click };
}
beforeEach(() => { sessionStorage.clear(); });
describe("daily action lifecycle", () => {
  it("accept sends once while pending, then allows retry after failure", async () => {
    const { panels, gateway, click } = setup(1);
    panels.toggle(); await flush();
    const pending = deferred();
    gateway.acceptQuest.mockReturnValueOnce(pending.promise);
    click("accept-daily"); click("accept-daily");
    expect(gateway.acceptQuest).toHaveBeenCalledTimes(1);
    pending.reject(new Error("retry")); await flush();
    click("accept-daily"); await flush();
    expect(gateway.acceptQuest).toHaveBeenCalledTimes(2);
    panels.detach();
  });

  it("old list response cannot repopulate a reattached panel", async () => {
    const { panels, gateway, mount, status } = setup();
    const pending = deferred();
    gateway.listPlayerQuests.mockReturnValueOnce(pending.promise as never);
    panels.toggle(); panels.detach(); panels.attach();
    status.mockClear();
    pending.resolve({ quests: rows }); await flush();
    expect(mount.querySelectorAll("li[data-quest-cfg-id]")).toHaveLength(0);
    expect(status).not.toHaveBeenCalled();
    panels.detach();
  });

  it("detached batch finishes issued claim reconciliation but stops later claims", async () => {
    const { panels, gateway, click, status, patch } = setup();
    panels.toggle(); await flush();
    const pending = deferred();
    gateway.claimQuestReward.mockReturnValueOnce(pending.promise);
    click("claim-daily-batch");
    panels.detach(); panels.attach(); status.mockClear();
    pending.resolve({}); await flush(); await flush();
    expect(gateway.claimQuestReward).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    panels.detach();
  });
  it("old accept completion neither refreshes nor unlocks a new mount's acceptance", async () => {
    const { panels, gateway, click, status } = setup(1);
    panels.toggle(); await flush();
    const old = deferred(), fresh = deferred();
    gateway.acceptQuest.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    click("accept-daily");
    panels.detach(); panels.attach(); panels.toggle(); await flush();
    click("accept-daily"); status.mockClear();
    old.resolve({}); await flush();
    click("accept-daily");
    expect(gateway.acceptQuest).toHaveBeenCalledTimes(2);
    expect(gateway.listPlayerQuests).toHaveBeenCalledTimes(2);
    expect(gateway.listPlayerBag).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    fresh.resolve({}); await flush();
    click("accept-daily"); await flush();
    expect(gateway.acceptQuest).toHaveBeenCalledTimes(3);
    panels.detach();
  });

  it.each([false, true])("old claim settlement cannot unlock a new batch (reject=%s)", async (reject) => {
    const { panels, gateway, click, status } = setup();
    panels.toggle(); await flush();
    const old = deferred(), fresh = deferred();
    gateway.claimQuestReward.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    click("claim-daily-batch");
    panels.detach(); panels.attach(); panels.toggle(); await flush();
    click("claim-daily-batch"); status.mockClear();
    if (reject) old.reject(new Error("old failure")); else old.resolve({});
    await flush();
    click("claim-daily");
    expect(gateway.claimQuestReward).toHaveBeenCalledTimes(2);
    expect(status).not.toHaveBeenCalled();
    expect(panels.getRoot().querySelector('[data-role="daily-form-error"]')?.textContent).not.toContain("old failure");
    fresh.resolve({}); await flush(); await flush();
    expect(gateway.claimQuestReward).toHaveBeenCalledTimes(3);
    panels.detach();
  });

  it("old single claim completion leaves a new single claim locked", async () => {
    const { panels, gateway, click, status } = setup();
    panels.toggle(); await flush();
    const old = deferred(), fresh = deferred();
    gateway.claimQuestReward.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    click("claim-daily");
    panels.detach(); panels.attach(); panels.toggle(); await flush();
    click("claim-daily"); status.mockClear();
    old.resolve({}); await flush(); click("claim-daily-batch");
    expect(gateway.claimQuestReward).toHaveBeenCalledTimes(2);
    expect(status).not.toHaveBeenCalled();
    fresh.resolve({}); await flush();
    panels.detach();
  });

  it("old badge deep-link completion preserves the new mount's badge override", async () => {
    const { panels, gateway, mount } = setup();
    const old = deferred(), fresh = deferred();
    gateway.listPlayerQuests.mockReturnValueOnce(old.promise as never);
    panels.openFromTodoBadge(1012, { claimableCount: 2 });
    panels.detach(); panels.attach(); panels.toggle(); await flush();
    gateway.listPlayerQuests.mockReturnValueOnce(fresh.promise as never);
    panels.openFromTodoBadge(1012, { claimableCount: 9 });
    old.resolve({ quests: rows }); await flush();
    // A list render before the current request finishes must still use its override.
    mount.querySelector<HTMLButtonElement>('[data-filter="all"]')!.click();
    expect(mount.querySelector('[data-role="daily-claimable-count-badge"]')?.getAttribute("data-filter-badge-count")).toBe("9");
    fresh.resolve({ quests: rows }); await flush();
    panels.detach();
  });

});
