import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY,
} from "@/net/battleReportListState";
import { BattleReportUnreadSession } from "@/net/battleReportUnread";
import type { GatewayPort } from "@/net/GatewayClient";
import { battleReportRoundRowDomId } from "@/net/battleReportDetailNav";
import {
  BATTLE_REPORT_ADJ_NAV_KEYBOARD_ATTR,
  BATTLE_REPORT_DETAIL_REGION_ARIA_LABEL,
} from "@/net/battleReportListNav";
import { BattleReportPanel } from "@/ui/BattleReportPanel";

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

function flushPromises(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe("BattleReportPanel", () => {
  const storage = mockStorage();
  const sessionProto = {
    getItem: (k: string) => storage.getItem(k),
    setItem: (k: string, v: string) => storage.setItem(k, v),
    removeItem: (k: string) => storage.removeItem(k),
    clear: () => storage.clear(),
    key: () => null,
    length: 0,
  };

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("sessionStorage", sessionProto);
  });

  it("battle report panel has center-panel id and scroll body for list+detail (CLIENT-086)", () => {
    const mount = document.createElement("div");
    const panel = new BattleReportPanel(mount, { listBattleReports: vi.fn() } as never, () => {});
    panel.attach();
    expect(mount.querySelector('[data-center-panel="battle-report"]')).toBeTruthy();
    const scroll = mount.querySelector('[data-center-panel="battle-report"] .panel-scroll-body');
    expect(scroll?.querySelector('[data-role="report-list"]')).toBeTruthy();
    expect(scroll?.querySelector('[data-role="report-detail"]')).toBeTruthy();
  });

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
    expect(ul?.querySelector(".battle-report-row-coord")?.textContent).toContain("坐标(8,9)");
    mount.querySelector('li[data-report-id="2"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    expect(gateway.getBattleReport).toHaveBeenCalledWith(2);
    const detail = mount.querySelector('[data-role="report-detail"]');
    expect(detail?.textContent).toContain("守方获胜");
    expect(detail?.querySelector(".battle-report-rounds-table")).toBeTruthy();
    expect(detail?.querySelector(".battle-report-detail-coord")?.textContent).toContain("坐标(8,9)");
    expect(detail?.querySelector('[data-action="view-on-map"]')).toBeTruthy();
  });

  it("shows 相关日常 when outcome win/loss and daily march in progress", async () => {
    const mount = document.createElement("div");
    const summary = { report_id: 6, outcome: 1, created_at_ms: 0 };
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({ reports: [summary], total: 1 }),
      getBattleReport: vi.fn().mockResolvedValue({
        report: {
          summary,
          detail: { result: "attacker_win", rounds: [{ round: 1 }] },
        },
      }),
    } as unknown as GatewayPort;
    const onOpenRelatedDaily = vi.fn();
    const panel = new BattleReportPanel(mount, gateway, () => {}, {
      getDailyChainRows: () => [
        { quest_cfg_id: 1033, quest_code: "daily_march_1", chain_id: 400, state: 2 },
      ],
      onOpenRelatedDaily,
    });
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="6"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const dailyBtn = mount.querySelector('[data-action="open-related-daily"]') as HTMLButtonElement;
    expect(dailyBtn?.textContent).toBe("相关日常");
    dailyBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onOpenRelatedDaily).toHaveBeenCalledWith(1033);
  });

  it("shows 相关邮件 when detail has mail source hint", async () => {
    const mount = document.createElement("div");
    const summary = {
      report_id: 4,
      outcome: 1,
      created_at_ms: 0,
    };
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({ reports: [summary], total: 1 }),
      getBattleReport: vi.fn().mockResolvedValue({
        report: {
          summary,
          detail: { result: "attacker_win mail_id=6002", rounds: [{ round: 1 }] },
        },
      }),
    } as unknown as GatewayPort;
    const onOpenRelatedMail = vi.fn();
    const panel = new BattleReportPanel(mount, gateway, () => {}, { onOpenRelatedMail });
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="4"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const mailBtn = mount.querySelector('[data-action="open-related-mail"]') as HTMLButtonElement;
    expect(mailBtn?.textContent).toBe("相关邮件");
    mailBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onOpenRelatedMail).toHaveBeenCalledWith(6002);
  });

  it("invokes onViewOnMap when clicking 在地图查看", async () => {
    const mount = document.createElement("div");
    const summary = {
      report_id: 3,
      location_x: 4,
      location_y: 5,
      outcome: 1,
      created_at_ms: 0,
    };
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({ reports: [summary], total: 1 }),
      getBattleReport: vi.fn().mockResolvedValue({
        report: { summary, detail: { result: "attacker_win", rounds: [] } },
      }),
    } as unknown as GatewayPort;
    const onViewOnMap = vi.fn();
    const panel = new BattleReportPanel(mount, gateway, () => {}, { onViewOnMap });
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="3"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    mount.querySelector('[data-action="view-on-map"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    expect(onViewOnMap).toHaveBeenCalledWith(summary);
  });

  it("clears map replay when switching selected report", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 1, location_x: 1, location_y: 1, outcome: 1, created_at_ms: 0 },
          { report_id: 2, location_x: 2, location_y: 2, outcome: 2, created_at_ms: 0 },
        ],
        total: 2,
      }),
      getBattleReport: vi.fn().mockImplementation((id: number) =>
        Promise.resolve({
          report: {
            summary: { report_id: id, location_x: id, location_y: id, outcome: 1 },
            detail: { result: "attacker_win", rounds: [] },
          },
        }),
      ),
    } as unknown as GatewayPort;
    const onClearMapReplay = vi.fn();
    const panel = new BattleReportPanel(mount, gateway, () => {}, { onClearMapReplay });
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="1"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    onClearMapReplay.mockClear();
    mount.querySelector('li[data-report-id="2"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    expect(onClearMapReplay).toHaveBeenCalled();
  });

  it("opens deep link with latest report after list refresh", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 10, outcome: 1, created_at_ms: 0 },
          { report_id: 8, outcome: 2, created_at_ms: 0 },
        ],
        total: 2,
      }),
      getBattleReport: vi.fn().mockResolvedValue({
        report: {
          summary: { report_id: 10, outcome: 1 },
          detail: { result: "attacker_win", rounds: [{ round: 1 }] },
        },
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    await panel.openPanelWithDeepLink(8);
    await flushPromises();
    expect(gateway.getBattleReport).toHaveBeenCalledWith(8);
    expect(mount.querySelector('li[data-report-id="8"]')?.classList.contains("selected")).toBe(
      true,
    );
  });

  it("renders troop scan summary and jumps to round row", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          {
            report_id: 4,
            location_x: 1,
            location_y: 2,
            attacker_player_id: 7,
            defender_player_id: 8,
            outcome: 1,
            created_at_ms: 0,
          },
        ],
        total: 1,
      }),
      getBattleReport: vi.fn().mockResolvedValue({
        report: {
          summary: {
            report_id: 4,
            location_x: 1,
            location_y: 2,
            attacker_player_id: 7,
            defender_player_id: 8,
            outcome: 1,
          },
          detail: {
            result: "attacker_win",
            rounds: [
              {
                round: 1,
                attacker_troops: { infantry: 40 },
                defender_troops: { cavalry: 20 },
                attacker_to_def_hp: 5,
                defender_to_att_hp: 0,
              },
              {
                round: 2,
                attacker_troops: { infantry: 35 },
                defender_troops: { cavalry: 15 },
              },
            ],
          },
        },
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="4"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    const detail = mount.querySelector('[data-role="report-detail"]');
    expect(detail?.querySelector(".battle-report-troop-scan")?.textContent).toContain("步兵 40");
    expect(detail?.querySelector(".battle-report-troop-scan")?.textContent).toContain(
      "攻方玩家#7",
    );
    mount.querySelector('[data-action="jump-round"][data-round="2"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    const row = mount.querySelector(`#${battleReportRoundRowDomId(2)}`);
    expect(row?.classList.contains("battle-report-round-row-highlight")).toBe(true);
  });

  it("collapses long round tables until expand", async () => {
    const mount = document.createElement("div");
    const rounds = Array.from({ length: 10 }, (_, i) => ({ round: i + 1 }));
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [{ report_id: 1, outcome: 1, created_at_ms: 0 }],
        total: 1,
      }),
      getBattleReport: vi.fn().mockResolvedValue({
        report: {
          summary: { report_id: 1, outcome: 1 },
          detail: { result: "attacker_win", rounds },
        },
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="1"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    const detail = mount.querySelector('[data-role="report-detail"]');
    expect(detail?.querySelector(".battle-report-rounds-table tbody tr")).toBeFalsy();
    const expand = mount.querySelector('[data-action="expand-rounds"]') as HTMLElement;
    expect(expand?.textContent).toContain("展开全部回合");
    expand.dispatchEvent(new Event("click", { bubbles: true }));
    expect(detail?.querySelectorAll(".battle-report-rounds-table tbody tr").length).toBe(10);
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
    const loadMoreAfter = mount.querySelector('[data-action="load-more-reports"]') as HTMLButtonElement;
    expect(loadMoreAfter.disabled).toBe(true);
    expect(loadMoreAfter.textContent).toContain("已加载全部 2 条");
  });

  it("keeps loaded rows when load more fails", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi
        .fn()
        .mockResolvedValueOnce({
          reports: [{ report_id: 1, outcome: 1, created_at_ms: 0 }],
          total: 3,
        })
        .mockRejectedValueOnce(new Error("网关繁忙")),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const loadMore = mount.querySelector('[data-action="load-more-reports"]') as HTMLButtonElement;
    loadMore.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(mount.querySelectorAll("li[data-report-id]").length).toBe(1);
    const status = mount.querySelector('[data-role="report-list-status"]');
    expect(status?.textContent).toContain("加载更多失败");
    expect(status?.textContent).toContain("网关繁忙");
  });

  it("restores outcome filter from sessionStorage on attach", async () => {
    storage.setItem(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY, "win");
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 1, outcome: 1, created_at_ms: 0 },
          { report_id: 2, outcome: 2, created_at_ms: 0 },
        ],
        total: 2,
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    expect(mount.querySelector('button[data-filter="win"]')?.classList.contains("active")).toBe(
      true,
    );
    expect(mount.querySelectorAll("li[data-report-id]").length).toBe(1);
  });

  it("open-replay-world-tile on list row invokes callback without selecting report", async () => {
    const mount = document.createElement("div");
    const onOpenReplayWorldTile = vi.fn();
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          {
            report_id: 9,
            outcome: 1,
            location_x: 40,
            location_y: 41,
            created_at_ms: 0,
          },
        ],
        total: 1,
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {}, {
      onOpenReplayWorldTile,
    });
    panel.attach();
    panel.toggle();
    await flushPromises();
    const btn = mount.querySelector(
      '[data-action="open-replay-world-tile"]',
    ) as HTMLButtonElement;
    expect(btn?.textContent).toContain("40");
    btn.click();
    expect(onOpenReplayWorldTile).toHaveBeenCalledWith(
      expect.objectContaining({ report_id: 9, location_x: 40, location_y: 41 }),
    );
    expect(mount.querySelector('li[data-report-id="9"]')?.classList.contains("selected")).toBe(
      false,
    );
    expect(mount.querySelector('[data-role="report-detail"]')?.textContent).toBe("");
  });

  it("persists outcome filter when user changes filter", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [{ report_id: 1, outcome: 2, created_at_ms: 0 }],
        total: 1,
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('button[data-filter="loss"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    expect(storage.getItem(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY)).toBe("loss");
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

  it("filters list by time window and shows outcome summary chips", async () => {
    const now = Date.UTC(2024, 5, 10, 12, 0, 0);
    vi.spyOn(Date, "now").mockReturnValue(now);
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 1, outcome: 1, created_at_ms: Date.UTC(2024, 5, 10, 8, 0, 0) },
          { report_id: 2, outcome: 2, created_at_ms: Date.UTC(2024, 5, 9, 8, 0, 0) },
          { report_id: 3, outcome: 3, created_at_ms: Date.UTC(2024, 5, 1, 8, 0, 0) },
        ],
        total: 3,
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const summary = mount.querySelector('[data-role="report-outcome-summary"]');
    expect(summary?.textContent).toContain("胜 1");
    expect(summary?.textContent).toContain("负 1");
    expect(summary?.textContent).toContain("平 1");
    const select = mount.querySelector('[data-action="filter-time-window"]') as HTMLSelectElement;
    select.value = "today";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(mount.querySelectorAll("li[data-report-id]").length).toBe(1);
    expect(mount.querySelector('li[data-report-id="1"]')).toBeTruthy();
    expect(summary?.textContent).toContain("胜 1");
    expect(summary?.textContent).toContain("负 0");
    vi.mocked(Date.now).mockRestore();
  });

  it("restores time window filter from sessionStorage on attach", async () => {
    storage.setItem(BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY, "last7d");
    const now = Date.UTC(2024, 5, 10, 12, 0, 0);
    vi.spyOn(Date, "now").mockReturnValue(now);
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 1, outcome: 1, created_at_ms: Date.UTC(2024, 5, 10, 8, 0, 0) },
          { report_id: 2, outcome: 2, created_at_ms: Date.UTC(2024, 5, 1, 8, 0, 0) },
        ],
        total: 2,
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const select = mount.querySelector('[data-action="filter-time-window"]') as HTMLSelectElement;
    expect(select.value).toBe("last7d");
    expect(mount.querySelectorAll("li[data-report-id]").length).toBe(1);
    vi.mocked(Date.now).mockRestore();
  });

  it("persists time window filter separately from outcome filter", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [{ report_id: 1, outcome: 1, created_at_ms: 0 }],
        total: 1,
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const select = mount.querySelector('[data-action="filter-time-window"]') as HTMLSelectElement;
    select.value = "today";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(storage.getItem(BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY)).toBe("today");
    expect(storage.getItem(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY)).toBeNull();
  });

  it("openListFilteredByGrid applies location filter (CLIENT-108)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 1, location_x: 5, location_y: 5, outcome: 1, created_at_ms: 0 },
          { report_id: 2, location_x: 9, location_y: 9, outcome: 1, created_at_ms: 0 },
        ],
        total: 2,
      }),
      getBattleReport: vi.fn().mockResolvedValue({
        summary: { report_id: 1, location_x: 5, location_y: 5, outcome: 1 },
        detail: {},
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    await panel.openListFilteredByGrid(5, 5, 1);
    expect(panel.getLocationFilter()).toEqual({ x: 5, y: 5 });
    const ul = mount.querySelector('[data-role="report-list"]');
    expect(ul?.textContent).toContain("(5,5)");
    expect(ul?.textContent).not.toContain("(9,9)");
    mount.querySelector('[data-action="clear-location-filter"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    expect(panel.getLocationFilter()).toBeNull();
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

  it("shows streak chip alongside outcome summary", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 3, outcome: 1, created_at_ms: 0 },
          { report_id: 2, outcome: 1, created_at_ms: 0 },
          { report_id: 1, outcome: 2, created_at_ms: 0 },
        ],
        total: 3,
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    const summary = mount.querySelector('[data-role="report-outcome-summary"]');
    expect(summary?.textContent).toContain("胜 2");
    expect(summary?.querySelector(".battle-report-streak-chip")?.textContent).toBe("连胜 2");
  });

  it("navigates prev/next within filtered list and preserves round highlight", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 10, outcome: 1, created_at_ms: 0 },
          { report_id: 8, outcome: 2, created_at_ms: 0 },
        ],
        total: 2,
      }),
      getBattleReport: vi.fn().mockImplementation((id: number) =>
        Promise.resolve({
          report: {
            summary: { report_id: id, outcome: 1 },
            detail: {
              result: "attacker_win",
              rounds: [{ round: 1 }, { round: 2 }],
            },
          },
        }),
      ),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="10"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    mount.querySelector('[data-action="jump-round"][data-round="2"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    const nextBtn = mount.querySelector('[data-action="nav-next-report"]') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);
    nextBtn.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.getBattleReport).toHaveBeenLastCalledWith(8);
    const row = mount.querySelector(`#${battleReportRoundRowDomId(2)}`);
    expect(row?.classList.contains("battle-report-round-row-highlight")).toBe(true);
    const prevBtn = mount.querySelector('[data-action="nav-prev-report"]') as HTMLButtonElement;
    prevBtn.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.getBattleReport).toHaveBeenLastCalledWith(10);
  });

  it("exposes detail region aria-label and navigates with arrows when detail focused (CLIENT-094)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 1, outcome: 1, created_at_ms: 0 },
          { report_id: 2, outcome: 1, created_at_ms: 0 },
        ],
        total: 2,
      }),
      getBattleReport: vi.fn().mockImplementation((id: number) =>
        Promise.resolve({
          report: {
            summary: { report_id: id, outcome: 1 },
            detail: { result: "attacker_win", rounds: [] },
          },
        }),
      ),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="1"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    const detail = mount.querySelector('[data-role="report-detail"]') as HTMLElement;
    expect(detail.getAttribute("role")).toBe("region");
    expect(detail.getAttribute("aria-label")).toBe(BATTLE_REPORT_DETAIL_REGION_ARIA_LABEL);
    let focusedNavAction = "";
    const nativeFocus = HTMLButtonElement.prototype.focus;
    const focusSpy = vi
      .spyOn(HTMLButtonElement.prototype, "focus")
      .mockImplementation(function (this: HTMLButtonElement) {
        const action = this.getAttribute("data-action");
        if (action === "nav-prev-report" || action === "nav-next-report") {
          focusedNavAction = action;
        }
        return nativeFocus.call(this);
      });
    detail.focus();
    detail.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await flushPromises();
    focusSpy.mockRestore();
    expect(gateway.getBattleReport).toHaveBeenLastCalledWith(2);
    expect(focusedNavAction).toMatch(/^nav-(prev|next)-report$/);
  });

  it("does not navigate arrows on panel root without detail or Alt (CLIENT-094)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [{ report_id: 1, outcome: 1, created_at_ms: 0 }],
        total: 1,
      }),
      getBattleReport: vi.fn().mockResolvedValue({
        report: {
          summary: { report_id: 1, outcome: 1 },
          detail: { result: "attacker_win", rounds: [] },
        },
      }),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="1"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    const root = mount.querySelector(".battle-report-panel") as HTMLElement;
    root.focus();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await flushPromises();
    expect(gateway.getBattleReport).toHaveBeenCalledTimes(1);
  });

  it("supports Alt+arrow adjacent nav from filter bar and data attr off disables keys (CLIENT-094)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({
        reports: [
          { report_id: 1, outcome: 1, created_at_ms: 0 },
          { report_id: 2, outcome: 1, created_at_ms: 0 },
        ],
        total: 2,
      }),
      getBattleReport: vi.fn().mockImplementation((id: number) =>
        Promise.resolve({
          report: {
            summary: { report_id: id, outcome: 1 },
            detail: { result: "attacker_win", rounds: [] },
          },
        }),
      ),
    } as unknown as GatewayPort;
    const panel = new BattleReportPanel(mount, gateway, () => {});
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="1"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    const filterBtn = mount.querySelector('button[data-filter="all"]') as HTMLButtonElement;
    filterBtn.focus();
    filterBtn.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }),
    );
    await flushPromises();
    expect(gateway.getBattleReport).toHaveBeenLastCalledWith(2);

    const root = mount.querySelector(".battle-report-panel") as HTMLElement;
    root.setAttribute(BATTLE_REPORT_ADJ_NAV_KEYBOARD_ATTR, "off");
    filterBtn.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }),
    );
    await flushPromises();
    expect(gateway.getBattleReport).toHaveBeenCalledTimes(2);
    expect(gateway.getBattleReport).toHaveBeenLastCalledWith(2);
  });

  it("shows side summary and opens viewer hero from battle link (CLIENT-100)", async () => {
    const mount = document.createElement("div");
    const summary = {
      report_id: 11,
      attacker_player_id: 42,
      defender_player_id: 99,
      attacker_display_name: "我",
      attacker_hero_id: 5,
      outcome: 1,
      created_at_ms: 0,
    };
    const gateway: GatewayPort = {
      listBattleReports: vi.fn().mockResolvedValue({ reports: [summary], total: 1 }),
      getBattleReport: vi.fn().mockResolvedValue({
        report: {
          summary,
          detail: { result: "attacker_win", rounds: [{ round: 1 }], attacker_hero_level: 3 },
        },
      }),
    } as unknown as GatewayPort;
    const onOpenHero = vi.fn();
    const onReadonly = vi.fn();
    const panel = new BattleReportPanel(mount, gateway, () => {}, {
      getBattleReportLinkContext: () => ({
        viewerPlayerId: 42,
        viewerHeroes: [{ hero_id: 5, level: 1 }],
      }),
      onOpenBattleReportHero: onOpenHero,
      onBattleReportReadonlyHint: onReadonly,
    });
    panel.attach();
    panel.toggle();
    await flushPromises();
    mount.querySelector('li[data-report-id="11"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    const detail = mount.querySelector('[data-role="report-detail"]');
    expect(detail?.querySelector(".battle-report-detail-side-line")?.textContent).toContain("我");
    expect(detail?.querySelector('[data-action="open-battle-rank"]')).toBeTruthy();
    (
      detail?.querySelector(
        '[data-action="open-battle-hero"][data-side="attacker"]',
      ) as HTMLButtonElement
    )?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onOpenHero).toHaveBeenCalledWith(5);
    (
      detail?.querySelector(
        '[data-action="open-battle-hero"][data-side="defender"]',
      ) as HTMLButtonElement
    )?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onReadonly).toHaveBeenCalled();
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
