import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { queueBuildRowDomId } from "@/net/mainCitySlotUpgrade";
import { QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS } from "@/net/buildQueueComplete";
import {
  QUEUE_RECRUIT_SLOT_MUTUAL_HIGHLIGHT_CLASS,
  RECRUIT_QUEUE_MATRIX_SLOT_KEY,
} from "@/net/recruitQueueComplete";
import { QUEUE_ROW_SLOT_HIGHLIGHT_CLASS } from "@/net/citySlotQueueLink";
import { queueRecruitRowDomId, RECRUIT_ROW_PULSE_CLASS } from "@/net/recruitTroopSubmitFeedback";
import { DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS } from "@/net/dailyQueueAnchor";
import {
  BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID,
  DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS as QUEUE_PANEL_ANCHOR_CLASS,
  QUEUE_BUILD_ROW_SELECTED_CLASS,
  QUEUE_DAILY_NEXT_BUTTON_LABEL,
  QueuePanels,
} from "@/ui/QueuePanels";

const baseSession = (): MainCitySession => ({
  serverId: 1,
  player: {},
  wallet: {},
  cityId: 1,
  cityName: "主城",
  buildings: [],
  cityTroops: [],
  bag: [],
});

describe("QueuePanels", () => {
  it("highlights build row when opened from main city slot deep link", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [
      { slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 },
      { slot_key: "hall", level: 1, upgrade_finish_at_ms: now + 60_000 },
    ];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田", hall: "城主府" }, () => {}, () => {}, () => {});
    panel.attach();
    expect(mount.querySelector('[data-center-panel="queue"] .panel-scroll-body')).toBeTruthy();
    panel.openAndHighlightBuildSlot("farm");
    const row = mount.querySelector(`#${queueBuildRowDomId("farm")}`);
    expect(row?.classList.contains(QUEUE_BUILD_ROW_SELECTED_CLASS)).toBe(true);
    const hallRow = mount.querySelector(`#${queueBuildRowDomId("hall")}`);
    expect(hallRow?.classList.contains(QUEUE_BUILD_ROW_SELECTED_CLASS)).toBe(false);
    expect(row?.classList.contains(QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS)).toBe(true);
    expect(row?.querySelector(".queue-row-progress-fill")).toBeTruthy();
  });

  it("clicking build queue row highlights slot via openAndHighlightBuildSlot", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onHighlight = vi.fn();
    const onLocate = vi.fn();
    const panel = new QueuePanels(
      mount,
      gateway,
      () => session,
      { farm: "农田" },
      () => {},
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      onHighlight,
      undefined,
      undefined,
      onLocate,
    );
    panel.attach();
    panel.toggle();
    const row = mount.querySelector(`#${queueBuildRowDomId("farm")}`) as HTMLElement;
    row.click();
    expect(onHighlight).toHaveBeenCalledWith("farm");
    expect(onLocate).toHaveBeenCalledWith("farm");
  });

  it("pulseQueueRowForOverlaySlot adds queue-row-slot-highlight (CLIENT-180)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    panel.pulseQueueRowForOverlaySlot("farm");
    const row = mount.querySelector(`#${queueBuildRowDomId("farm")}`);
    expect(row?.classList.contains(QUEUE_ROW_SLOT_HIGHLIGHT_CLASS)).toBe(true);
  });

  it("notifyBuildJustCompleted adds pulse class on complete todo row", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 3, upgrade_finish_at_ms: 0 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.setBuildCompleteTodoSlots(["farm"]);
    panel.toggle();
    panel.notifyBuildJustCompleted(["farm"]);
    const row = mount.querySelector('li[data-slot-key="farm"]');
    expect(row?.classList.contains("queue-build-complete-pulse")).toBe(true);
    expect(row?.textContent).toContain("Lv3");
  });

  it("notifyRecruitJustCompleted adds queue-recruit-complete-pulse on recruit line", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, {}, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    panel.addRecruitEntry({ queue_id: 7, unit_cfg_id: 1, count: 10, finish_at_ms: now + 90_000 });
    panel.notifyRecruitJustCompleted([7]);
    const row = mount.querySelector(`#${queueRecruitRowDomId(7)}`);
    expect(row?.classList.contains("queue-recruit-complete-pulse")).toBe(true);
    expect(row?.classList.contains(RECRUIT_ROW_PULSE_CLASS)).toBe(false);
  });

  it("pulseRecruitRow adds recruit-row-pulse on queue recruit line", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, {}, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    panel.addRecruitEntry({ queue_id: 3, unit_cfg_id: 1, count: 10, finish_at_ms: now + 90_000 });
    panel.pulseRecruitRow(3);
    const row = mount.querySelector(`#${queueRecruitRowDomId(3)}`);
    expect(row?.classList.contains(RECRUIT_ROW_PULSE_CLASS)).toBe(true);
  });

  it("renders seven-slot matrix and sorts build rows by earliest finish", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [
      { slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 },
      { slot_key: "hall", level: 1, upgrade_finish_at_ms: now + 60_000 },
    ];
    session.wallet = { food: 9_999_999, wood: 9_999_999, stone: 9_999_999, iron: 9_999_999 };
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田", hall: "官府" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    const cells = mount.querySelectorAll(".queue-build-matrix-cell");
    expect(cells.length).toBe(7);
    expect(cells[0]?.getAttribute("data-matrix-index")).toBe("0");
    expect(cells[0]?.getAttribute("data-status")).toBe("upgrading");
    const buildRows = mount.querySelectorAll("#" + queueBuildRowDomId("hall") + ", #" + queueBuildRowDomId("farm"));
    expect(buildRows.length).toBe(2);
    const firstRow = mount.querySelector(`#${queueBuildRowDomId("hall")}`);
    const secondRow = mount.querySelector(`#${queueBuildRowDomId("farm")}`);
    expect(firstRow?.compareDocumentPosition(secondRow!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("recruit row click invokes military jump callback when wired (CLIENT-157)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [];
    session.wallet = { food: 9_999_999, wood: 9_999_999, stone: 9_999_999, iron: 9_999_999 };
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onJump = vi.fn();
    const panel = new QueuePanels(
      mount,
      gateway,
      () => session,
      { barracks: "兵营" },
      () => {},
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onJump,
    );
    panel.attach();
    panel.toggle();
    const entry = { queue_id: 4, unit_cfg_id: 1, count: 6, finish_at_ms: now + 60_000 };
    panel.addRecruitEntry(entry);
    const row = mount.querySelector(`#${queueRecruitRowDomId(4)}`) as HTMLElement;
    row.click();
    expect(onJump).toHaveBeenCalledWith(entry);
  });

  it("barracks matrix cell click mutual-highlights recruit queue row (CLIENT-149)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [];
    session.wallet = { food: 9_999_999, wood: 9_999_999, stone: 9_999_999, iron: 9_999_999 };
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onHighlight = vi.fn();
    const panel = new QueuePanels(
      mount,
      gateway,
      () => session,
      { barracks: "兵营" },
      () => {},
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      onHighlight,
    );
    panel.attach();
    panel.toggle();
    panel.addRecruitEntry({ queue_id: 4, unit_cfg_id: 1, count: 6, finish_at_ms: now + 60_000 });
    const barracksCell = mount.querySelector(
      `.queue-build-matrix-cell[data-slot-key="${RECRUIT_QUEUE_MATRIX_SLOT_KEY}"]`,
    ) as HTMLElement;
    barracksCell.click();
    expect(onHighlight).toHaveBeenCalledWith(RECRUIT_QUEUE_MATRIX_SLOT_KEY);
    const rowAfter = mount.querySelector(`#${queueRecruitRowDomId(4)}`);
    expect(rowAfter?.classList.contains(QUEUE_RECRUIT_SLOT_MUTUAL_HIGHLIGHT_CLASS)).toBe(true);
  });

  it("matrix cell click opens and highlights build slot", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onHighlight = vi.fn();
    const panel = new QueuePanels(
      mount,
      gateway,
      () => session,
      { farm: "农田" },
      () => {},
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      onHighlight,
    );
    panel.attach();
    panel.toggle();
    const cell = mount.querySelector('.queue-build-matrix-cell[data-slot-key="farm"]') as HTMLElement;
    cell.click();
    expect(onHighlight).toHaveBeenCalledWith("farm");
    const cellAfter = mount.querySelector('.queue-build-matrix-cell[data-slot-key="farm"]');
    expect(cellAfter?.classList.contains("queue-build-matrix-cell-selected")).toBe(true);
    expect(cellAfter?.classList.contains(QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS)).toBe(true);
  });

  it("shows upgrade and recruit rows when open", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    panel.addRecruitEntry({ queue_id: 5, unit_cfg_id: 1, count: 12, finish_at_ms: now + 60_000 });
    const text = mount.textContent ?? "";
    expect(text).toContain("农田");
    expect(text).toContain("步兵×12");
    expect(text).toContain("建造 1");
    expect(text).toContain("募兵 1");
    expect(text).toMatch(/最近 剩/);
  });

  it("offers speedup button on build rows and disables without item", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = {
      getCityState: vi.fn(),
      getBoundServerId: vi.fn(() => 1),
      useConsumable: vi.fn(),
    } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    const btn = mount.querySelector('[data-action="speedup-build"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);

    session.bag = [{ item_cfg_id: BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, quantity: 1 }];
    panel.toggle();
    panel.toggle();
    const btn2 = mount.querySelector('[data-action="speedup-build"]') as HTMLButtonElement;
    expect(btn2.disabled).toBe(false);
  });

  it("flashes daily-queue-anchor-highlight on matching build row (CLIENT-186)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.flashDailyQueueAnchorHighlight({ kind: "build", slotKey: "farm" });
    const row = mount.querySelector(`#${queueBuildRowDomId("farm")}`);
    expect(row?.classList.contains(DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS)).toBe(true);
    expect(row?.classList.contains(QUEUE_PANEL_ANCHOR_CLASS)).toBe(true);
    expect(row?.classList.contains(QUEUE_BUILD_ROW_SELECTED_CLASS)).toBe(true);
    expect(row?.classList.contains(QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS)).toBe(true);
    expect(row?.querySelector(".queue-row-progress-fill")).toBeTruthy();
  });

  it("shows daily next link on recruit row when daily_train_1 is in progress", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onOpenDaily = vi.fn();
    const panel = new QueuePanels(
      mount,
      gateway,
      () => session,
      {},
      () => {},
      () => {},
      () => {},
      () => [
        {
          quest_cfg_id: 1014,
          quest_code: "daily_train_1",
          state: 2,
          progress_current: 0,
          progress_target: 1,
        },
      ],
      onOpenDaily,
    );
    panel.attach();
    panel.toggle();
    panel.addRecruitEntry({ queue_id: 9, unit_cfg_id: 1, count: 10, finish_at_ms: now + 90_000 });
    const dailyBtn = mount.querySelector(
      `#${queueRecruitRowDomId(9)} [data-action="daily-build-next"]`,
    ) as HTMLButtonElement;
    expect(dailyBtn?.textContent).toBe(QUEUE_DAILY_NEXT_BUTTON_LABEL);
    dailyBtn.click();
    expect(onOpenDaily).toHaveBeenCalledWith(1014);
  });

  it("shows daily next link on build row when daily_build_1 matches farm upgrade", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onOpenDaily = vi.fn();
    const panel = new QueuePanels(
      mount,
      gateway,
      () => session,
      { farm: "农田" },
      () => {},
      () => {},
      () => {},
      () => [
        {
          quest_cfg_id: 1032,
          quest_code: "daily_build_1",
          state: 2,
          progress_current: 0,
          progress_target: 1,
        },
      ],
      onOpenDaily,
    );
    panel.attach();
    panel.toggle();
    const dailyBtn = mount.querySelector('[data-action="daily-build-next"]') as HTMLButtonElement;
    expect(dailyBtn?.textContent).toBe(QUEUE_DAILY_NEXT_BUTTON_LABEL);
    expect(mount.querySelector(".queue-daily-progress")?.textContent).toMatch(/日课/);
    dailyBtn.click();
    expect(onOpenDaily).toHaveBeenCalledWith(1032);
  });

  it("calls UseConsumable and refreshes city state on success", async () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const finishBefore = now + 120_000;
    const finishAfter = now + 60_000;
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: finishBefore }];
    session.bag = [{ item_cfg_id: BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, quantity: 2 }];
    const useConsumable = vi.fn().mockResolvedValue({
      remaining: 1,
      effect_summary: "建造加速 300 秒",
      speedup_seconds: 300,
    });
    const getCityState = vi.fn().mockResolvedValue({
      buildings: [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: finishAfter }],
    });
    const gateway = {
      getCityState,
      getBoundServerId: vi.fn(() => 1),
      useConsumable,
    } as unknown as GatewayPort;
    const statuses: string[] = [];
    const panel = new QueuePanels(
      mount,
      gateway,
      () => session,
      { farm: "农田" },
      (msg) => statuses.push(msg),
      () => {},
      () => {},
    );
    panel.attach();
    panel.toggle();
    const btn = mount.querySelector('[data-action="speedup-build"]') as HTMLButtonElement;
    btn.click();
    await vi.waitFor(() => expect(useConsumable).toHaveBeenCalledWith(1, BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, 1));
    await vi.waitFor(() => expect(getCityState).toHaveBeenCalledWith(1));
    expect(session.buildings[0].upgrade_finish_at_ms).toBe(finishAfter);
    expect(session.bag).toEqual([{ item_cfg_id: BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, quantity: 1 }]);
    expect(statuses.some((s) => s.includes("建造加速") || s.includes("加速"))).toBe(true);
    const panelStatus = mount.querySelector('[data-role="queue-status"]')?.textContent ?? "";
    expect(panelStatus.length).toBeGreaterThan(0);
  });
});
