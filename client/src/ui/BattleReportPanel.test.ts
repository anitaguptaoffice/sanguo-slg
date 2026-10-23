import { describe, expect, it, vi } from "vitest";
import { BattleReportUnreadSession } from "@/net/battleReportUnread";
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
    expect(ul?.querySelector(".battle-outcome-chip")?.textContent).toContain("守胜");
    expect(ul?.textContent).toContain("坐标(8,9)");
    mount.querySelector('li[data-report-id="2"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    expect(gateway.getBattleReport).toHaveBeenCalledWith(2);
    const pre = mount.querySelector('[data-role="report-detail"]');
    expect(pre?.textContent).toContain("守方获胜");
  });

  it("filters list by outcome without changing listBattleReports args", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 1, location_x: 1, location_y: 1, outcome: 1, created_at_ms: 0 },
          { report_id: 2, location_x: 2, location_y: 2, outcome: 2, created_at_ms: 0 },
          { report_id: 3, location_x: 3, location_y: 3, outcome: 3, created_at_ms: 0 },
        ],
        total: 3,
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('button[data-filter="win"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    const ul = mount.querySelector('[data-role="report-list"]');
    expect(ul?.textContent).toContain("攻胜");
    expect(ul?.textContent).not.toContain("守胜");
    expect(ul?.textContent).not.toContain("平局");
    expect(gateway.listBattleReports).toHaveBeenCalledWith(20, 0);
    expect(gateway.listBattleReports).toHaveBeenCalledTimes(1);
  });

  it("loads more with offset", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi
        .fn()
        .mockResolvedValueOnce({
          reports: [{ report_id: 1, outcome: 1, created_at_ms: 0 }],
          total: 2,
        })
        .mockResolvedValueOnce({
          reports: [{ report_id: 2, outcome: 2, created_at_ms: 0 }],
          total: 2,
        }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const loadMore = mount.querySelector('[data-action="load-more-reports"]') as HTMLElement;
    expect(loadMore.hidden).toBe(false);
    loadMore.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.listBattleReports).toHaveBeenLastCalledWith(20, 1);
    expect(mount.querySelectorAll("li[data-report-id]").length).toBe(2);
    expect(mount.querySelector('li[data-report-id="1"]')).toBeTruthy();
    expect(mount.querySelector('li[data-report-id="2"]')).toBeTruthy();
  });

  it("clears unread session when panel opens", async () => {
    const mount = document.createElement("div");
    const unread = new BattleReportUnreadSession();
    expect(unread.countUnread([{ report_id: 5 }])).toBe(1);
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [{ report_id: 5, outcome: 1, created_at_ms: 0 }],
        total: 1,
      }),
    } as unknown as GatewayPort;
    let badge = -1;
    const panel = new BattleReportPanel(mount, gateway, () => {}, {
      unreadSession: unread,
      onUnreadChange: (n) => {
        badge = n;
      },
    });
    panel.attach();
    panel.openPanel();
    await flushPromises();
    expect(unread.countUnread([{ report_id: 5 }, { report_id: 6 }])).toBe(1);
    expect(badge).toBe(0);
  });

  it("shows filter-empty placeholder while keeping filter bar", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [{ report_id: 1, location_x: 1, location_y: 1, outcome: 2, created_at_ms: 0 }],
        total: 1,
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('button[data-filter="win"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    const ul = mount.querySelector('[data-role="report-list"]');
    expect(ul?.textContent).toContain("无匹配战报");
    expect(mount.querySelector(".battle-report-filters")).toBeTruthy();
  });

  it("shows list load failure in panel and list hint", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockRejectedValue(new Error("网关超时")),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const status = mount.querySelector('[data-role="report-list-status"]');
    expect(status?.textContent).toContain("列表加载失败");
    expect(status?.textContent).toContain("网关超时");
    const ul = mount.querySelector('[data-role="report-list"]');
    expect(ul?.textContent).toContain("重试");
    expect(mount.querySelector(".battle-report-empty.is-error")).toBeTruthy();
  });
});
