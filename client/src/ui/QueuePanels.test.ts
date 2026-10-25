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
import { DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS } from "@/net/domesticSlotQueueFocusRing";
import {
  QUEUE_ROW_COMPLETE_PULSE_CLASS,
  QUEUE_ROW_COMPLETE_READONLY_CLASS,
} from "@/net/queueCompleteFocusRing";
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
    expect(row?.querySelector(".queue-row-eta-line")).toBeTruthy();
    expect(row?.querySelector(".domestic-queue-eta-segment-label")).toBeTruthy();
    expect(row?.querySelector(".domestic-queue-eta-segment-residual-label")).toBeTruthy();
    expect(row?.querySelector(".queue-row-progress-bar")).toBeTruthy();
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

  it("pulseQueueRowForOverlaySlot adds domestic-slot-queue-focus-ring (CLIENT-228)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [
      { slot_key: "farm", building_cfg_id: 2, level: 2, upgrade_finish_at_ms: now + 120_000 },
    ];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    panel.pulseQueueRowForOverlaySlot("farm");
    const row = mount.querySelector(`#${queueBuildRowDomId("farm")}`);
    expect(row?.classList.contains(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS)).toBe(true);
    expect(row?.getAttribute("data-building-cfg-id")).toBe("2");
  });

  it("notifyBuildJustCompleted adds queue-row-complete-pulse on complete todo row (CLIENT-197)", () => {
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
    expect(row?.classList.contains(QUEUE_ROW_COMPLETE_PULSE_CLASS)).toBe(true);
    expect(row?.classList.contains(QUEUE_ROW_COMPLETE_READONLY_CLASS)).toBe(true);
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

  it("completed recruit row is readonly and gains queue-row-complete-pulse (CLIENT-197)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onLocate = vi.fn();
    const panel = new QueuePanels(
      mount,
      gateway,
      () => session,
      {},
      () => {},
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onLocate,
    );
    panel.attach();
    panel.toggle();
    panel.addRecruitEntry({ queue_id: 7, unit_cfg_id: 1, count: 10, finish_at_ms: now - 1000 });
    panel.notifyRecruitJustCompleted([7]);
    const row = mount.querySelector(`#${queueRecruitRowDomId(7)}`) as HTMLElement;
    expect(row?.classList.contains(QUEUE_ROW_COMPLETE_READONLY_CLASS)).toBe(true);
    expect(row?.classList.contains(QUEUE_ROW_COMPLETE_PULSE_CLASS)).toBe(true);
    row.click();
    expect(onLocate).toHaveBeenCalledWith(RECRUIT_QUEUE_MATRIX_SLOT_KEY);
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

  it("renders preview residual deep line and deep-rings slot on click (CLIENT-261)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onDeepRing = vi.fn();
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onDeepRing,
    );
    panel.attach();
    panel.toggle();
    const deep = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deep-line"]',
    ) as HTMLElement;
    expect(deep?.textContent).toMatch(/巩固扫读/);
    expect(deep?.textContent).toMatch(/内政×1/);
    expect(deep?.getAttribute("data-action")).toBe(
      "domestic-slot-preview-cross-link-residual-deep-ring",
    );
    deep?.click();
    expect(onDeepRing).toHaveBeenCalledWith("farm");
  });

  it("renders preview residual deeper line and deeper-rings slot on click (CLIENT-277)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onDeeperRing = vi.fn();
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onDeeperRing,
    );
    panel.attach();
    panel.toggle();
    const deeper = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deeper-line"]',
    ) as HTMLElement;
    expect(deeper?.textContent).toMatch(/巩固再加深/);
    expect(deeper?.textContent).toMatch(/槽位\(农田\)/);
    expect(deeper?.getAttribute("data-action")).toBe(
      "domestic-slot-preview-cross-link-residual-deeper-ring",
    );
    deeper?.click();
    expect(onDeeperRing).toHaveBeenCalledWith("farm");
  });

  it("renders preview residual deepest line and deepest-rings slot on click (CLIENT-293)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onDeepestRing = vi.fn();
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onDeepestRing,
    );
    panel.attach();
    panel.toggle();
    const deepest = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-line"]',
    ) as HTMLElement;
    expect(deepest?.textContent).toMatch(/巩固再加深一层/);
    expect(deepest?.textContent).toMatch(/槽位\(农田\)/);
    expect(deepest?.getAttribute("data-action")).toBe(
      "domestic-slot-preview-cross-link-residual-deepest-ring",
    );
    const deeper = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deeper-line"]',
    ) as HTMLElement;
    expect(deeper?.textContent).toMatch(/巩固再加深/);
    deepest?.click();
    expect(onDeepestRing).toHaveBeenCalledWith("farm");
  });

  it("renders preview residual deepest-deeper line and deepest-deeper-rings slot on click (CLIENT-309)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onDeepestDeeperRing = vi.fn();
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onDeepestDeeperRing,
    );
    panel.attach();
    panel.toggle();
    const deepestDeeper = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-deeper-line"]',
    ) as HTMLElement;
    expect(deepestDeeper?.textContent).toMatch(/巩固再加深二层/);
    expect(deepestDeeper?.textContent).toMatch(/槽位\(农田\)/);
    expect(deepestDeeper?.getAttribute("data-action")).toBe(
      "domestic-slot-preview-cross-link-residual-deepest-deeper-ring",
    );
    const deepest = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-line"]',
    ) as HTMLElement;
    expect(deepest?.textContent).toMatch(/巩固再加深一层/);
    deepestDeeper?.click();
    expect(onDeepestDeeperRing).toHaveBeenCalledWith("farm");
  });

  it("renders preview residual deepest-deepest-deeper line and rings slot on click (CLIENT-325)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onDeepestDeepestDeeperRing = vi.fn();
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onDeepestDeepestDeeperRing,
    );
    panel.attach();
    panel.toggle();
    const deepestDeepestDeeper = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-deepest-deeper-line"]',
    ) as HTMLElement;
    expect(deepestDeepestDeeper?.textContent).toMatch(/巩固再加深三层/);
    expect(deepestDeepestDeeper?.textContent).toMatch(/槽位\(农田\)/);
    expect(deepestDeepestDeeper?.getAttribute("data-action")).toBe(
      "domestic-slot-preview-cross-link-residual-deepest-deepest-deeper-ring",
    );
    const deepestDeeper = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-deeper-line"]',
    ) as HTMLElement;
    expect(deepestDeeper?.textContent).toMatch(/巩固再加深二层/);
    deepestDeepestDeeper?.click();
    expect(onDeepestDeepestDeeperRing).toHaveBeenCalledWith("farm");
  });

  it("renders preview residual deepest-deepest-deepest-deeper line and rings slot on click (CLIENT-357)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onDeepestDeepestDeepestDeeperRing = vi.fn();
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onDeepestDeepestDeepestDeeperRing,
    );
    panel.attach();
    panel.toggle();
    const deepestDeepestDeepestDeeper = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-deepest-deepest-deeper-line"]',
    ) as HTMLElement;
    expect(deepestDeepestDeepestDeeper?.textContent).toMatch(/巩固再加深五层/);
    expect(deepestDeepestDeepestDeeper?.textContent).toMatch(/槽位\(农田\)/);
    expect(deepestDeepestDeepestDeeper?.getAttribute("data-action")).toBe(
      "domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-deeper-ring",
    );
    expect(deepestDeepestDeepestDeeper?.getAttribute("data-slot-key")).toBe("farm");
    const deepestDeepestDeepest = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-deepest-deepest-line"]',
    ) as HTMLElement;
    expect(deepestDeepestDeepest?.textContent).toMatch(/巩固再加深四层/);
    deepestDeepestDeepestDeeper?.click();
    expect(onDeepestDeepestDeepestDeeperRing).toHaveBeenCalledWith("farm");
  });

  it("renders preview residual deepest-deepest-deepest-deepest-deeper line and rings slot on click (CLIENT-373)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onDeepestDeepestDeepestDeepestDeeperRing = vi.fn();
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onDeepestDeepestDeepestDeepestDeeperRing,
    );
    panel.attach();
    panel.toggle();
    const deepestDeepestDeepestDeepestDeeper = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-deepest-deepest-deepest-deeper-line"]',
    ) as HTMLElement;
    expect(deepestDeepestDeepestDeepestDeeper?.textContent).toMatch(/巩固再加深五层/);
    expect(deepestDeepestDeepestDeepestDeeper?.textContent).toMatch(/最深六层链/);
    expect(deepestDeepestDeepestDeepestDeeper?.textContent).toMatch(/槽位\(农田\)/);
    expect(deepestDeepestDeepestDeepestDeeper?.getAttribute("data-action")).toBe(
      "domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-deepest-deeper-ring",
    );
    expect(deepestDeepestDeepestDeepestDeeper?.getAttribute("data-slot-key")).toBe("farm");
    const deepestDeepestDeepestDeeper = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-deepest-deepest-deeper-line"]',
    ) as HTMLElement;
    expect(deepestDeepestDeepestDeeper?.textContent).toMatch(/最深五层链/);
    deepestDeepestDeepestDeepestDeeper?.click();
    expect(onDeepestDeepestDeepestDeepestDeeperRing).toHaveBeenCalledWith("farm");
  });

  it("renders preview residual deepest-deepest-deepest line and rings slot on click (CLIENT-341)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onDeepestDeepestDeepestRing = vi.fn();
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onDeepestDeepestDeepestRing,
    );
    panel.attach();
    panel.toggle();
    const deepestDeepestDeepest = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-deepest-deepest-line"]',
    ) as HTMLElement;
    expect(deepestDeepestDeepest?.textContent).toMatch(/巩固再加深四层/);
    expect(deepestDeepestDeepest?.textContent).toMatch(/槽位\(农田\)/);
    expect(deepestDeepestDeepest?.getAttribute("data-action")).toBe(
      "domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-ring",
    );
    expect(deepestDeepestDeepest?.getAttribute("data-slot-key")).toBe("farm");
    const deepestDeepestDeeper = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-deepest-deepest-deeper-line"]',
    ) as HTMLElement;
    expect(deepestDeepestDeeper?.textContent).toMatch(/巩固再加深三层/);
    deepestDeepestDeepest?.click();
    expect(onDeepestDeepestDeepestRing).toHaveBeenCalledWith("farm");
  });

  it("renders preview residual line and pulses slot on click (CLIENT-245)", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const onMarginRing = vi.fn();
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onMarginRing,
    );
    panel.attach();
    panel.toggle();
    const residual = mount.querySelector(
      '[data-role="queue-next-finish-preview-residual-line"]',
    ) as HTMLElement;
    expect(residual?.textContent).toMatch(/残余扫读/);
    expect(residual?.textContent).toMatch(/cfg#2/);
    expect(residual?.getAttribute("data-action")).toBe(
      "domestic-slot-complete-margin-residual-ring",
    );
    residual?.click();
    expect(onMarginRing).toHaveBeenCalledWith("farm");
  });

  it("renders next-finish preview and opens daily anchor on click (CLIENT-218)", () => {
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
    const preview = mount.querySelector('[data-role="queue-next-finish-preview"]') as HTMLElement;
    expect(preview?.textContent).toMatch(/下一完成/);
    expect(preview?.textContent).toMatch(/农田/);
    preview?.click();
    expect(onOpenDaily).toHaveBeenCalledWith(1032);
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
