import { afterEach, describe, expect, it, vi } from "vitest";
import { BattleReportPanel } from "./BattleReportPanel";
const flush = () => new Promise((r) => setTimeout(r, 0));
const page = (ids: number[], total: number) => ({ reports: ids.map((report_id) => ({ report_id, outcome: report_id % 2 ? 1 : 2 })), total });
const first = Array.from({ length: 20 }, (_, i) => 21 - i);
const panels: BattleReportPanel[] = [];
afterEach(() => { panels.splice(0).forEach((p) => p.detach()); sessionStorage.clear(); });
async function setup() {
  const mount = document.createElement("div"); let generation = 1;
  const gateway = { getSessionGeneration: () => generation, listBattleReports: vi.fn().mockResolvedValueOnce(page(first, 21)), getBattleReport: vi.fn().mockResolvedValue({ report: {} }) };
  const panel = new BattleReportPanel(mount, gateway as never, vi.fn()); panels.push(panel);
  panel.attach(); panel.openPanel(); await flush();
  const button = (a: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${a}"]`)!;
  const click = (a: string) => button(a).click();
  const ids = () => panel.getReportsSnapshot().map((r) => r.report_id);
  const status = () => mount.querySelector('[data-role="report-list-status"]')!.textContent;
  return { panel, mount, gateway, button, click, ids, status, relogin: () => { generation++; } };
}
describe("battle report page drift", () => {
  it("rejects insertion overlap rather than trapping next navigation", async () => {
    const s = await setup(); s.gateway.listBattleReports.mockResolvedValueOnce(page([2, 1], 22));
    s.click("load-more-reports"); await flush(); expect(s.ids()).toEqual(first);
    expect(s.mount.querySelectorAll('li[data-report-id="2"]')).toHaveLength(1);
    expect(s.status()).toContain("刷新"); expect(s.button("load-more-reports").disabled).toBe(true);
    expect(s.button("load-more-reports").textContent).not.toContain("已加载全部");
    s.mount.querySelector<HTMLElement>('li[data-report-id="2"]')!.click(); await flush();
    expect(s.button("nav-next-report").disabled).toBe(true);
    s.click("load-more-reports"); expect(s.gateway.listBattleReports).toHaveBeenCalledTimes(2);
  });
  it.each([[1, 1], []])("requires refresh for duplicate/non-progress batch %j", async (...ids) => {
    const s = await setup(); s.gateway.listBattleReports.mockResolvedValueOnce(page(ids, 23));
    s.click("load-more-reports"); await flush(); expect(s.ids()).toEqual(first);
    expect(s.status()).toContain("刷新"); expect(s.button("load-more-reports").disabled).toBe(true);
  });
  it.each(["retry-list", "refresh-reports"])("%s resets drift and resumes normal paging", async (action) => {
    const s = await setup(); s.gateway.listBattleReports.mockResolvedValueOnce(page([2, 1], 22)); s.click("load-more-reports"); await flush();
    s.gateway.listBattleReports.mockResolvedValueOnce(page([22, ...first.slice(0, 19)], 22)); s.click(action); await flush();
    expect(s.gateway.listBattleReports).toHaveBeenLastCalledWith(20, 0); expect(s.button("load-more-reports").disabled).toBe(false);
    s.gateway.listBattleReports.mockResolvedValueOnce(page([2, 1], 22)); s.click("load-more-reports"); await flush();
    expect(s.ids()).toEqual([22, ...first, 1]); expect(s.button("load-more-reports").textContent).toContain("已加载全部 22 条");
    s.mount.querySelector<HTMLElement>('li[data-report-id="2"]')!.click(); await flush(); s.click("nav-next-report"); await flush();
    expect(s.gateway.getBattleReport).toHaveBeenLastCalledWith(1);
  });
  it("preserves outcome filtering during drift and refresh", async () => {
    const s = await setup(); s.mount.querySelector<HTMLButtonElement>('[data-filter="win"]')!.click();
    s.gateway.listBattleReports.mockResolvedValueOnce(page([2, 1], 22)); s.click("load-more-reports"); await flush();
    expect(s.mount.querySelectorAll("li[data-report-id]")).toHaveLength(10);
    s.gateway.listBattleReports.mockResolvedValueOnce(page([22, 21], 22)); s.click("retry-list"); await flush();
    expect([...s.mount.querySelectorAll("li[data-report-id]")].map((x) => x.getAttribute("data-report-id"))).toEqual(["21"]);
  });
  it("network failure remains retryable at the unchanged offset", async () => {
    const s = await setup(); s.gateway.listBattleReports.mockRejectedValueOnce(new Error("offline")); s.click("load-more-reports"); await flush();
    expect(s.ids()).toEqual(first); expect(s.button("load-more-reports").disabled).toBe(false);
    s.gateway.listBattleReports.mockResolvedValueOnce(page([1], 21)); s.click("load-more-reports"); await flush();
    expect(s.gateway.listBattleReports).toHaveBeenLastCalledWith(20, 20); expect(s.ids()).toEqual([...first, 1]);
  });
  it.each(["refresh", "actor", "detach"])("rejects stale overlapping page after %s", async (change) => {
    const s = await setup(); let resolve!: (v: ReturnType<typeof page>) => void;
    s.gateway.listBattleReports.mockReturnValueOnce(new Promise((r) => { resolve = r; })); s.click("load-more-reports");
    if (change === "refresh") { s.gateway.listBattleReports.mockResolvedValueOnce(page([30], 2)); s.click("refresh-reports"); await flush(); }
    else if (change === "actor") s.relogin(); else s.panel.detach();
    resolve(page([2, 1], 22)); await flush(); expect(s.ids()).toEqual(change === "refresh" ? [30] : first);
    if (change === "refresh") { expect(s.status()).not.toContain("刷新"); expect(s.button("load-more-reports").disabled).toBe(false); }
  });
});
