import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import { BattleReportPanel } from "./BattleReportPanel";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const rows = (id: number, total = 30) => ({ reports: [{ report_id: id, location_x: id, location_y: 20 }], total });
function setup() {
  const mount = document.createElement("div"), status = vi.fn(), onUnreadChange = vi.fn(), markPanelOpened = vi.fn(); let generation = 1;
  const gateway = { getSessionGeneration: () => generation,
    listBattleReports: vi.fn().mockResolvedValue(rows(2)), getBattleReport: vi.fn().mockResolvedValue({ report: {} }) };
  const panel = new BattleReportPanel(mount, gateway as unknown as GatewayPort, status, { onUnreadChange, unreadSession: { markPanelOpened } as never });
  panel.attach();
  const click = (action: string) => panel.getRoot().querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  const ids = () => panel.getReportsSnapshot().map((r) => r.report_id);
  return { panel, gateway, status, click, ids, markPanelOpened, onUnreadChange, relogin: () => { generation++; } };
}
describe("battle report list ownership", () => {
  it("old refresh cannot replace newer list", async () => {
    const { panel, gateway, click, ids } = setup(); const old = deferred();
    gateway.listBattleReports.mockReturnValueOnce(old.promise as never); panel.openPanel(); click("refresh-reports"); await flush();
    old.resolve(rows(1)); await flush(); expect(ids()).toEqual([2]); panel.detach();
  });
  it("pagination pending before refresh cannot append to replacement list", async () => {
    const { panel, gateway, click, ids } = setup(); panel.openPanel(); await flush(); const old = deferred();
    gateway.listBattleReports.mockReturnValueOnce(old.promise as never); click("load-more-reports"); click("refresh-reports"); await flush();
    old.resolve(rows(1)); await flush(); expect(ids()).toEqual([2]); panel.detach();
  });
  it.each([false, true])("old completion preserves current loading/status (reject=%s)", async (reject) => {
    const { panel, gateway, click, status, ids } = setup(); const old = deferred(), fresh = deferred();
    gateway.listBattleReports.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    panel.openPanel(); click("refresh-reports"); status.mockClear();
    if (reject) old.reject(new Error("old")); else old.resolve(rows(1)); await flush();
    expect(status).not.toHaveBeenCalled(); expect(ids()).toEqual([]);
    expect(panel.getRoot().querySelector('[data-role="report-list"]')!.textContent).toContain("加载");
    fresh.resolve(rows(2)); await flush(); expect(ids()).toEqual([2]); panel.detach();
  });
  it("stale pagination failure cannot end newer loading", async () => {
    const { panel, gateway, click, status } = setup(); panel.openPanel(); await flush(); const old = deferred(), fresh = deferred();
    gateway.listBattleReports.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    click("load-more-reports"); click("refresh-reports"); status.mockClear(); old.reject(new Error("old page")); await flush();
    expect(status).not.toHaveBeenCalled(); expect(panel.getRoot().querySelector('[data-role="report-list"]')!.textContent).toContain("加载");
    fresh.resolve(rows(2)); await flush(); panel.detach();
  });
  it("current pagination appends and prevents duplicate page clicks", async () => {
    const { panel, gateway, click, ids } = setup(); panel.openPanel(); await flush(); const page = deferred();
    gateway.listBattleReports.mockReturnValueOnce(page.promise as never); click("load-more-reports"); click("load-more-reports");
    expect(gateway.listBattleReports).toHaveBeenCalledTimes(2); expect(gateway.listBattleReports).toHaveBeenLastCalledWith(20, 1);
    page.resolve(rows(1, 2)); await flush(); expect(ids()).toEqual([2, 1]); panel.detach();
  });
  it("latest deep link exclusively opens its report and clears unread", async () => {
    const { panel, gateway, markPanelOpened, onUnreadChange } = setup(); const old = deferred();
    gateway.listBattleReports.mockReturnValueOnce(old.promise as never);
    const first = panel.openPanelWithDeepLink(1); await panel.openPanelWithDeepLink(2);
    old.resolve(rows(1)); await first;
    expect(gateway.getBattleReport).toHaveBeenCalledTimes(1); expect(gateway.getBattleReport).toHaveBeenCalledWith(2);
    expect(markPanelOpened).toHaveBeenCalledTimes(1); expect(onUnreadChange).toHaveBeenCalledTimes(1); panel.detach();
  });
  it("latest filtered deep link preserves selected grid", async () => {
    const { panel, gateway } = setup(); const old = deferred(); gateway.listBattleReports.mockReturnValueOnce(old.promise as never);
    const first = panel.openListFilteredByGrid(1, 20, 1); await panel.openListFilteredByGrid(2, 20, 2);
    old.resolve(rows(1)); await first; expect(panel.getLocationFilter()).toEqual({ x: 2, y: 20 });
    expect(gateway.getBattleReport).toHaveBeenCalledTimes(1); expect(gateway.getBattleReport).toHaveBeenCalledWith(2); panel.detach();
  });
  it("failed open does not clear unread or fetch details, retry works", async () => {
    const { panel, gateway, markPanelOpened, onUnreadChange } = setup(); gateway.listBattleReports.mockRejectedValueOnce(new Error("current"));
    await panel.openPanelWithDeepLink(1); expect(markPanelOpened).not.toHaveBeenCalled(); expect(onUnreadChange).not.toHaveBeenCalled();
    expect(gateway.getBattleReport).not.toHaveBeenCalled(); await panel.openPanelWithDeepLink(2);
    expect(markPanelOpened).toHaveBeenCalledTimes(1); expect(gateway.getBattleReport).toHaveBeenCalledWith(2); panel.detach();
  });
  it("closed open does not clear unread or fetch details", async () => {
    const { panel, gateway, markPanelOpened } = setup(); const old = deferred(); gateway.listBattleReports.mockReturnValueOnce(old.promise as never);
    const pending = panel.openPanelWithDeepLink(1); panel.toggle(); old.resolve(rows(1)); await pending;
    expect(markPanelOpened).not.toHaveBeenCalled(); expect(gateway.getBattleReport).not.toHaveBeenCalled(); panel.detach();
  });
  it.each([false, true])("detached list ignores completion (reject=%s)", async (reject) => {
    const { panel, gateway, status, markPanelOpened, ids } = setup(); const old = deferred(); gateway.listBattleReports.mockReturnValueOnce(old.promise as never);
    const pending = panel.openPanelWithDeepLink(1); panel.detach(); status.mockClear();
    if (reject) old.reject(new Error("old")); else old.resolve(rows(1)); await pending;
    expect(ids()).toEqual([]); expect(status).not.toHaveBeenCalled(); expect(markPanelOpened).not.toHaveBeenCalled(); expect(gateway.getBattleReport).not.toHaveBeenCalled();
  });
  it("remount owns new list", async () => {
    const { panel, gateway, ids } = setup(); const old = deferred(); gateway.listBattleReports.mockReturnValueOnce(old.promise as never);
    const pending = panel.openPanelWithDeepLink(1); panel.detach(); panel.attach(); await panel.openPanelWithDeepLink(2);
    old.resolve(rows(1)); await pending; expect(ids()).toEqual([2]); expect(gateway.getBattleReport).toHaveBeenCalledTimes(1); panel.detach();
  });
  it.each([false, true])("relogin ignores old list and continuation (reject=%s)", async (reject) => {
    const { panel, gateway, status, markPanelOpened, ids, relogin } = setup(); const old = deferred(); gateway.listBattleReports.mockReturnValueOnce(old.promise as never);
    const pending = panel.openPanelWithDeepLink(1); relogin(); status.mockClear();
    if (reject) old.reject(new Error("old")); else old.resolve(rows(1)); await pending;
    expect(ids()).toEqual([]); expect(status).not.toHaveBeenCalled(); expect(markPanelOpened).not.toHaveBeenCalled(); expect(gateway.getBattleReport).not.toHaveBeenCalled();
    await panel.openPanelWithDeepLink(2); expect(ids()).toEqual([2]); panel.detach();
  });

});
