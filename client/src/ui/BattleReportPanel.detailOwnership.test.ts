import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import { BattleReportPanel } from "./BattleReportPanel";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const response = (id: number, name: string) => ({ report: { summary: { report_id: id, location_x: id, location_y: 20 }, detail: { result: name } } });
async function setup() {
  const mount = document.createElement("div"), status = vi.fn(); let generation = 1;
  const gateway = { getSessionGeneration: () => generation,
    listBattleReports: vi.fn().mockResolvedValue({ reports: [{ report_id: 1 }, { report_id: 2 }], total: 2 }),
    getBattleReport: vi.fn().mockResolvedValue(response(2, "最新详情")) };
  const panel = new BattleReportPanel(mount, gateway as unknown as GatewayPort, status);
  panel.attach(); panel.toggle(); await flush();
  const click = (id: number) => panel.getRoot().querySelector<HTMLLIElement>(`li[data-report-id="${id}"]`)!.click();
  const detail = () => panel.getRoot().querySelector('[data-role="report-detail"]')!.textContent;
  return { panel, gateway, status, click, detail, relogin: () => { generation++; } };
}
describe("battle report detail ownership", () => {
  it("late old detail cannot replace latest selection", async () => {
    const { panel, gateway, click, detail } = await setup(); const old = deferred();
    gateway.getBattleReport.mockReturnValueOnce(old.promise as never);
    click(1); click(2); await flush(); old.resolve(response(1, "旧详情")); await flush();
    expect(detail()).toContain("最新详情"); expect(detail()).not.toContain("旧详情"); panel.detach();
  });
  it("old error cannot replace current pending detail", async () => {
    const { panel, gateway, click, detail, status } = await setup(); const old = deferred(), fresh = deferred();
    gateway.getBattleReport.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    click(1); click(2); status.mockClear(); old.reject(new Error("旧错误")); await flush();
    expect(detail()).not.toContain("旧错误"); expect(status).not.toHaveBeenCalled();
    fresh.resolve(response(2, "最新详情")); await flush(); expect(detail()).toContain("最新详情"); panel.detach();
  });
  it.each([false, true])("ABA selection rejects first same-ID completion (reject=%s)", async (reject) => {
    const { panel, gateway, click, detail, status } = await setup(); const old = deferred();
    gateway.getBattleReport.mockReturnValueOnce(old.promise as never);
    click(1); click(2); click(1); await flush(); status.mockClear();
    if (reject) old.reject(new Error("旧错误")); else old.resolve(response(1, "旧详情")); await flush();
    expect(detail()).toContain("最新详情"); expect(status).not.toHaveBeenCalled(); panel.detach();
  });
  it("same-ID retry owns completion independently", async () => {
    const { panel, gateway, click, detail } = await setup(); const old = deferred();
    gateway.getBattleReport.mockReturnValueOnce(old.promise as never);
    click(1); click(1); await flush(); old.resolve(response(1, "旧详情")); await flush();
    expect(detail()).toContain("最新详情"); panel.detach();
  });
  it.each([false, true])("detached panel ignores completion (reject=%s)", async (reject) => {
    const { panel, gateway, click, detail, status } = await setup(); const old = deferred();
    gateway.getBattleReport.mockReturnValueOnce(old.promise as never); click(1); panel.detach(); status.mockClear();
    const before = detail();
    if (reject) old.reject(new Error("旧错误")); else old.resolve(response(1, "旧详情")); await flush();
    expect(detail()).toBe(before); expect(status).not.toHaveBeenCalled();
    click(2); expect(gateway.getBattleReport).toHaveBeenCalledTimes(1);
  });
  it("remount accepts new request without old completion", async () => {
    const { panel, gateway, click, detail, status } = await setup(); const old = deferred();
    gateway.getBattleReport.mockReturnValueOnce(old.promise as never); click(1); panel.detach(); panel.attach();
    panel.openPanel(); await flush(); click(2); await flush(); status.mockClear();
    old.resolve(response(1, "旧详情")); await flush(); expect(detail()).toContain("最新详情"); expect(status).not.toHaveBeenCalled(); panel.detach();
  });
  it.each([false, true])("relogin rejects previous session detail (reject=%s)", async (reject) => {
    const { panel, gateway, click, detail, status, relogin } = await setup(); const old = deferred();
    gateway.getBattleReport.mockReturnValueOnce(old.promise as never); click(1); relogin(); status.mockClear(); const before = detail();
    if (reject) old.reject(new Error("旧错误")); else old.resolve(response(1, "旧详情")); await flush();
    expect(detail()).toBe(before); expect(status).not.toHaveBeenCalled();
    click(2); await flush(); expect(detail()).toContain("最新详情"); panel.detach();
  });
  it("current failure remains visible and can retry", async () => {
    const { panel, gateway, click, detail, status } = await setup();
    gateway.getBattleReport.mockRejectedValueOnce(new Error("当前错误")); click(1); await flush();
    expect(status).toHaveBeenCalledWith("详情加载失败：当前错误");
    click(1); await flush(); expect(detail()).toContain("最新详情"); panel.detach();
  });

});
