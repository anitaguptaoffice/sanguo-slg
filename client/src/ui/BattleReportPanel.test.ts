import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import { BattleReportPanel } from "@/ui/BattleReportPanel";

function flushPromises(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe("BattleReportPanel", () => {
  it("renders empty list placeholder after refresh", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({ reports: [], total: 0 }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const ul = mount.querySelector('[data-role="report-list"]');
    expect(ul?.textContent).toContain("暂无战报");
    expect(gateway.listBattleReports).toHaveBeenCalledWith(20, 0);
  });

  it("renders report lines with outcome and coord", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          {
            report_id: 2,
            location_x: 8,
            location_y: 9,
            outcome: 2,
            created_at_ms: Date.UTC(2024, 5, 1, 10, 0, 0),
          },
        ],
        total: 1,
      }),
      getBattleReport: vi.fn().mockResolvedValue({
        report: {
          summary: {
            report_id: 2,
            location_x: 8,
            location_y: 9,
            outcome: 2,
            created_at_ms: Date.UTC(2024, 5, 1, 10, 0, 0),
          },
          detail: { result: "defender_win", rounds: [{ round: 1 }] },
        },
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const ul = mount.querySelector('[data-role="report-list"]');
    expect(ul?.textContent).toContain("守胜");
    expect(ul?.textContent).toContain("坐标(8,9)");
    mount.querySelector('li[data-report-id="2"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    expect(gateway.getBattleReport).toHaveBeenCalledWith(2);
    const pre = mount.querySelector('[data-role="report-detail"]');
    expect(pre?.textContent).toContain("defender_win");
  });

  it("shows list load failure in panel", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockRejectedValue(new Error("网关超时")),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const status = mount.querySelector('[data-role="report-list-status"]');
    expect(status?.textContent).toContain("加载失败");
    expect(status?.textContent).toContain("网关超时");
  });
});
