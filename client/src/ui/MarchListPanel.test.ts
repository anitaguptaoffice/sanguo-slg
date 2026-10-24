import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MARCH_HIGHLIGHT_SESSION_KEY, MARCH_ROW_RECENT_CLASS } from "@/net/marchHighlight";
import { MILITARY_LIST_FILTER_SESSION_KEY } from "@/net/militaryListFilter";
import { MINIMAP_MARCH_FOCUS_SESSION_KEY } from "@/net/minimapMarchFocus";
import {
  INTEL_PHASE_CHANGE_FLASH_CLASS,
  INTEL_PHASE_CHANGE_FLASH_MS,
} from "@/net/marchIntelPhaseChangeFlash";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS,
} from "@/net/marchIntelPhaseChangeResidualPulse";
import { MarchListPanel } from "@/ui/MarchListPanel";

describe("MarchListPanel", () => {
  let mount: HTMLElement;

  beforeEach(() => {
    mount = document.createElement("div");
    document.body.appendChild(mount);
  });

  afterEach(() => {
    sessionStorage.clear();
    mount.remove();
  });

  it("march intel panel has center-panel id and panel-scroll-body (CLIENT-086)", () => {
    const panel = new MarchListPanel(mount, { listMarches: vi.fn() } as never, () => 1, () => {});
    panel.attach();
    expect(mount.querySelector('[data-center-panel="march"]')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="march"] .panel-scroll-body')).toBeTruthy();
  });

  it("shows empty list hint and calls listMarches on open", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({ marches: [], total: 0 }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 42, () => {});
    panel.attach();
    panel.toggle();

    await vi.waitFor(() => {
      expect(gateway.listMarches).toHaveBeenCalledWith(42, 20, 0);
    });

    const li = mount.querySelector(".march-list li");
    expect(li?.classList.contains("march-list-empty")).toBe(true);
    expect(li?.textContent).toContain("暂无行军");
  });

  it("renders march rows with purpose and phase", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 7,
            purpose: 1,
            phase: 2,
            from_x: 1,
            from_y: 2,
            to_x: 5,
            to_y: 5,
            depart_at_ms: Date.UTC(2024, 0, 1, 8, 0, 0),
            arrive_at_ms: Date.UTC(2024, 0, 1, 9, 0, 0),
          },
        ],
        total: 1,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => undefined, () => {});
    panel.attach();
    panel.toggle();

    await vi.waitFor(() => {
      expect(mount.querySelectorAll(".march-list li").length).toBe(1);
    });

    const row = mount.querySelector(".march-list li[data-march-id]");
    expect(row?.querySelector(".march-row-primary")?.textContent).toContain("攻击");
    expect(row?.querySelector(".march-row-primary")?.textContent).toContain("(5,5)");
    expect(row?.querySelector(".march-row-primary")?.textContent).toContain("#7");
    expect(row?.querySelector('[data-role="march-phase-chip"]')).toBeNull();
    expect(row?.querySelector(".march-row-meta")?.textContent).toMatch(/剩余|即将到达/);
    expect(row?.querySelector(".march-row-meta")?.textContent).toContain("行军中");
  });

  it("ticks remaining labels without extra listMarches RPC", async () => {
    vi.useFakeTimers();
    let nowMs = Date.UTC(2024, 0, 1, 8, 0, 0);
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 1,
            phase: 2,
            purpose: 1,
            depart_at_ms: nowMs,
            arrive_at_ms: nowMs + 120_000,
          },
        ],
        total: 1,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      pollIntervalMs: 60_000,
      nowMs: () => nowMs,
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(gateway.listMarches).toHaveBeenCalledTimes(1));

    const meta = () => mount.querySelector(".march-row-meta")?.textContent ?? "";
    expect(meta()).toContain("剩余 2m");

    nowMs += 70_000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(meta()).toContain("即将到达");
    expect(gateway.listMarches).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("persists minimap march focus session on row select", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [{ march_id: 3, phase: 2, to_x: 8, to_y: 9 }],
        total: 1,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(1));

    mount.querySelector('.march-list li[data-march-id="3"]')!.click();
    expect(sessionStorage.getItem(MINIMAP_MARCH_FOCUS_SESSION_KEY)).toBe("3");

    mount.querySelector('.march-list li[data-march-id="3"]')!.click();
    expect(panel.getSelectedMarchId()).toBeNull();
    expect(sessionStorage.getItem(MINIMAP_MARCH_FOCUS_SESSION_KEY)).toBeNull();
  });

  it("restores minimap focus from session after list refresh", async () => {
    sessionStorage.setItem(MINIMAP_MARCH_FOCUS_SESSION_KEY, "9");
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          { march_id: 9, phase: 2, to_x: 1, to_y: 2 },
          { march_id: 10, phase: 2, to_x: 3, to_y: 4 },
        ],
        total: 2,
      }),
    };
    const onSelectionChange = vi.fn();
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      onSelectionChange,
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(panel.getSelectedMarchId()).toBe(9));
    expect(onSelectionChange).toHaveBeenCalled();
    expect(
      mount.querySelector('.march-list li[data-march-id="9"]')?.classList.contains(
        "march-list-row-selected",
      ),
    ).toBe(true);
  });

  it("shows march-info-card and march-row-selected when row selected (CLIENT-172)", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 5,
            phase: 2,
            purpose: 1,
            from_x: 0,
            from_y: 0,
            to_x: 12,
            to_y: 34,
            arrive_at_ms: Date.now() + 90_000,
            troops: [{ unit_cfg_id: 1, count: 50 }],
          },
        ],
        total: 1,
      }),
    };
    const onViewMarchDestTile = vi.fn();
    const onRemarchFromRow = vi.fn();
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      onViewMarchDestTile,
      onRemarchFromRow,
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(1));

    mount.querySelector('.march-list li[data-march-id="5"]')!.click();
    const card = mount.querySelector(".march-info-card");
    expect(card?.classList.contains("hidden")).toBe(false);
    expect(card?.classList.contains("march-row-selected")).toBe(true);
    expect(mount.querySelector(".march-info-card-primary")?.textContent).toContain("(0,0) → (12,34)");
    expect(mount.querySelector(".march-info-card-secondary")?.textContent).toContain("步兵×50");

    mount.querySelector('[data-action="march-info-view-dest"]')!.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    expect(onViewMarchDestTile).toHaveBeenCalledWith(
      expect.objectContaining({ march_id: 5, to_x: 12, to_y: 34 }),
    );

    mount.querySelector('[data-action="march-info-remarch"]')!.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    expect(onRemarchFromRow).toHaveBeenCalled();
  });

  it("shows eta residual coord subline on march info card (CLIENT-237)", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 2,
            to_x: 9,
            to_y: 10,
            phase: 2,
            arrive_at_ms: Date.now() + 30_000,
          },
        ],
        total: 1,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(1));
    mount.querySelector('.march-list li[data-march-id="2"]')!.click();
    const coord = mount.querySelector('[data-role="march-info-card-eta-residual-coord"]');
    expect(coord?.textContent).toBe("目的格 (9,10)");
    expect(coord?.classList.contains("march-intel-eta-residual-coord")).toBe(true);
  });

  it("shows phase-eta strip and intel-row-phase-subline mutual highlight (CLIENT-205)", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 11,
            phase: 2,
            to_x: 1,
            to_y: 2,
            arrive_at_ms: Date.now() + 60_000,
          },
        ],
        total: 1,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(1));

    const row = mount.querySelector('.march-list li[data-march-id="11"]');
    expect(row?.querySelector(".intel-row-phase-subline")?.textContent).toContain("行军中");

    row!.click();
    const strip = mount.querySelector(".march-intel-phase-eta-strip");
    expect(strip?.textContent).toContain("行军中");
    expect(strip?.classList.contains("march-intel-phase-eta-mutual-highlight")).toBe(true);
    const rowAfter = mount.querySelector('.march-list li[data-march-id="11"]');
    expect(
      rowAfter?.querySelector(".intel-row-phase-subline")?.classList.contains(
        "march-intel-phase-eta-mutual-highlight",
      ),
    ).toBe(true);
  });

  it("march-info-card 复盘战报 uses report_id (CLIENT-191)", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 7,
            phase: 3,
            to_x: 8,
            to_y: 9,
            report_id: 42,
          },
        ],
        total: 1,
      }),
    };
    const onReplayBattleReportFromInfoCard = vi.fn();
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      onReplayBattleReportFromInfoCard,
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(1));
    mount.querySelector('.march-list li[data-march-id="7"]')!.click();
    const replayBtn = mount.querySelector(
      '[data-action="march-info-replay-battle-report"]',
    ) as HTMLButtonElement;
    expect(replayBtn?.disabled).toBe(false);
    replayBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onReplayBattleReportFromInfoCard).toHaveBeenCalledWith(
      expect.objectContaining({ march_id: 7 }),
      42,
    );
  });

  it("selects march row and highlights on click", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          { march_id: 3, phase: 2, to_x: 8, to_y: 9 },
          { march_id: 4, phase: 3, to_x: 1, to_y: 1 },
        ],
        total: 2,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(2));

    const first = mount.querySelector('.march-list li[data-march-id="3"]') as HTMLElement;
    first.click();
    expect(panel.getSelectedMarchId()).toBe(3);
    const selected = mount.querySelector(".march-list li.march-list-row-selected");
    expect(selected?.getAttribute("data-march-id")).toBe("3");
  });

  it("filters rows by destination grid without extra RPC", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          { march_id: 1, phase: 2, to_x: 10, to_y: 20 },
          { march_id: 2, phase: 2, to_x: 99, to_y: 99 },
        ],
        total: 2,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(2));

    panel.setDestFilter(10, 20);
    expect(panel.getDestFilterMode()).toBe("manual");
    expect(mount.querySelectorAll(".march-list li").length).toBe(1);
    expect(mount.querySelector('.march-list li[data-march-id="1"]')).toBeTruthy();
    expect(mount.querySelector(".march-list-row-dest-match")).toBeTruthy();
    expect(gateway.listMarches).toHaveBeenCalledTimes(1);
  });

  it("filters by world selected grid without extra RPC", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          { march_id: 1, phase: 2, to_x: 60, to_y: 60 },
          { march_id: 2, phase: 2, to_x: 1, to_y: 1 },
        ],
        total: 2,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      getWorldSelectedGrid: () => ({ x: 60, y: 60 }),
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(2));

    panel.setDestFilterMode("world");
    expect(mount.querySelectorAll(".march-list li").length).toBe(1);
    expect(gateway.listMarches).toHaveBeenCalledTimes(1);

    panel.setDestFilterMode("all");
    expect(mount.querySelectorAll(".march-list li").length).toBe(2);
  });

  it("openIntelViewForGrid applies manual filter when world grid mismatches", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          { march_id: 1, phase: 2, to_x: 60, to_y: 60 },
          { march_id: 2, phase: 2, to_x: 1, to_y: 1 },
        ],
        total: 2,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      getWorldSelectedGrid: () => ({ x: 60, y: 60 }),
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(2));

    panel.openIntelViewForGrid(1, 1);
    expect(panel.getDestFilterMode()).toBe("manual");
    expect(mount.querySelectorAll(".march-list li").length).toBe(1);

    panel.openIntelViewForGrid(60, 60);
    expect(panel.getDestFilterMode()).toBe("world");
    expect(mount.querySelectorAll(".march-list li").length).toBe(1);
  });

  it("notifyMarchStarted opens panel and shows recent ETA inline (CLIENT-116)", async () => {
    const arriveAt = Date.now() + 30 * 60_000;
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 99,
            phase: 2,
            to_x: 3,
            to_y: 4,
            arrive_at_ms: arriveAt,
          },
        ],
        total: 1,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    expect(panel.isOpen()).toBe(false);
    panel.notifyMarchStarted(99);
    expect(panel.isOpen()).toBe(true);
    await vi.waitFor(() => expect(gateway.listMarches).toHaveBeenCalled());
    expect(panel.getSelectedMarchId()).toBe(99);
    const eta = mount.querySelector('[data-role="march-row-recent-eta"]');
    expect(eta?.textContent).toMatch(/^ETA /);
    expect(
      mount.querySelector('.march-list li[data-march-id="99"]')?.classList.contains(MARCH_ROW_RECENT_CLASS),
    ).toBe(true);
    expect(mount.querySelector('[data-role="march-row-recent-dot"]')).toBeTruthy();
    expect(mount.querySelector('.march-list li[data-march-id="99"]')?.getAttribute("data-ui-filter-row")).toBe(
      "",
    );
    const meta = mount.querySelector('.march-list li[data-march-id="99"] [data-role="march-row-meta"]');
    expect(meta?.textContent).toMatch(/^已提交 ·/);
    expect(
      mount.querySelector('[data-action="march-intel-to-queue-banner"][data-march-id="99"]'),
    ).toBeTruthy();
  });

  it("notifyMarchStarted applies residual deep intel refresh stamp and list row pulse (CLIENT-269)", async () => {
    vi.useFakeTimers();
    const arriveAt = Date.now() + 30 * 60_000;
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [{ march_id: 88, phase: 2, to_x: 3, to_y: 4, arrive_at_ms: arriveAt }],
        total: 1,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.notifyMarchStarted(88, { toX: 3, toY: 4 });
    await vi.waitFor(() => {
      const stamp = mount.querySelector('[data-role="march-submit-intel-refresh-stamp"]');
      expect(stamp?.textContent).toMatch(/新行军 #88/);
      expect(stamp?.classList.contains("march-submit-intel-refresh-stamp-deep")).toBe(true);
      expect(stamp?.classList.contains("march-submit-intel-refresh-stamp-residual-deep")).toBe(true);
    });
    const row = mount.querySelector('.march-list li[data-march-id="88"]');
    expect(row?.classList.contains("intel-list-refresh-march-pulse")).toBe(true);
    const subline = row?.querySelector(".intel-row-phase-subline");
    expect(subline?.classList.contains("intel-list-refresh-march-subline-pulse")).toBe(true);
    expect(subline?.classList.contains("intel-list-refresh-march-subline-residual-deep-pulse")).toBe(
      true,
    );
    vi.advanceTimersByTime(3000);
    expect(row?.classList.contains("intel-list-refresh-march-pulse")).toBe(false);
    expect(subline?.classList.contains("intel-list-refresh-march-subline-pulse")).toBe(false);
    expect(subline?.classList.contains("intel-list-refresh-march-subline-residual-deep-pulse")).toBe(
      false,
    );
    expect(mount.querySelector('[data-role="march-submit-intel-refresh-stamp"]')?.classList.contains("hidden")).toBe(
      true,
    );
    vi.useRealTimers();
  });

  it("notifyMarchStarted applies intel handoff strip and intel-new-march-highlight (CLIENT-222)", async () => {
    vi.useFakeTimers();
    const arriveAt = Date.now() + 30 * 60_000;
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 42,
            phase: 2,
            to_x: 6,
            to_y: 7,
            arrive_at_ms: arriveAt,
          },
        ],
        total: 1,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.notifyMarchStarted(42, { toX: 6, toY: 7 });
    await vi.waitFor(() => {
      const line = mount.querySelector('[data-role="march-submit-intel-handoff-line"]');
      expect(line?.textContent).toMatch(/^军情交接 · \(6,7\) · /);
    });
    const handoff = mount.querySelector('[data-role="march-submit-intel-handoff-line"]');
    const row = mount.querySelector('.march-list li[data-march-id="42"]');
    expect(row?.classList.contains("intel-new-march-highlight")).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(row?.classList.contains("intel-new-march-highlight")).toBe(false);
    expect(handoff?.classList.contains("hidden")).toBe(true);
    vi.useRealTimers();
  });

  it("applies march-row-recent for highlighted march and clears on other row select", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          { march_id: 11, phase: 2, to_x: 1, to_y: 1 },
          { march_id: 22, phase: 2, to_x: 2, to_y: 2 },
        ],
        total: 2,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.setRecentMarchHighlight(11);
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(2));

    expect(
      mount.querySelector('.march-list li[data-march-id="11"]')?.classList.contains(MARCH_ROW_RECENT_CLASS),
    ).toBe(true);
    const other = mount.querySelector('.march-list li[data-march-id="22"]') as HTMLElement;
    other.click();
    expect(panel.getSelectedMarchId()).toBe(22);
    expect(
      mount.querySelector('.march-list li[data-march-id="11"]')?.classList.contains(MARCH_ROW_RECENT_CLASS),
    ).toBe(false);
    expect(sessionStorage.getItem(MARCH_HIGHLIGHT_SESSION_KEY)).toBeNull();
  });

  it("pulses march-phase-changed when phase changes on refresh (CLIENT-141)", async () => {
    vi.useFakeTimers();
    const gateway = {
      listMarches: vi
        .fn()
        .mockResolvedValueOnce({
          marches: [{ march_id: 5, phase: 2, to_x: 3, to_y: 4, arrive_at_ms: Date.now() + 60_000 }],
          total: 1,
        })
        .mockResolvedValueOnce({
          marches: [{ march_id: 5, phase: 3, to_x: 3, to_y: 4, arrive_at_ms: Date.now() }],
          total: 1,
        }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      pollIntervalMs: 60_000,
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(gateway.listMarches).toHaveBeenCalledTimes(1));
    await panel.getRoot().querySelector<HTMLButtonElement>('[data-action="refresh-marches"]')!.click();
    await vi.waitFor(() => expect(gateway.listMarches).toHaveBeenCalledTimes(2));
    const row = mount.querySelector('.march-list li[data-march-id="5"]');
    expect(row?.classList.contains("march-phase-changed")).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(row?.classList.contains("march-phase-changed")).toBe(false);
    vi.useRealTimers();
  });

  it("pulses intel-phase-change-flash on row and info strip when selected march phase changes (CLIENT-221)", async () => {
    vi.useFakeTimers();
    const gateway = {
      listMarches: vi
        .fn()
        .mockResolvedValueOnce({
          marches: [
            {
              march_id: 5,
              phase: 2,
              to_x: 3,
              to_y: 4,
              arrive_at_ms: Date.now() + 60_000,
            },
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          marches: [{ march_id: 5, phase: 3, to_x: 3, to_y: 4, arrive_at_ms: Date.now() }],
          total: 1,
        }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      pollIntervalMs: 60_000,
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(gateway.listMarches).toHaveBeenCalledTimes(1));
    mount.querySelector('.march-list li[data-march-id="5"]')!.click();
    const stripBefore = mount.querySelector(".march-intel-phase-eta-strip");
    expect(stripBefore?.textContent).toContain("行军中");

    await panel.getRoot().querySelector<HTMLButtonElement>('[data-action="refresh-marches"]')!.click();
    await vi.waitFor(() => expect(gateway.listMarches).toHaveBeenCalledTimes(2));

    const row = mount.querySelector('.march-list li[data-march-id="5"]');
    const strip = mount.querySelector(".march-intel-phase-eta-strip");
    expect(row?.classList.contains(INTEL_PHASE_CHANGE_FLASH_CLASS)).toBe(true);
    expect(strip?.classList.contains(INTEL_PHASE_CHANGE_FLASH_CLASS)).toBe(true);
    expect(row?.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(true);
    expect(strip?.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(true);
    expect(strip?.textContent).toContain("已到达");
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS);
    expect(row?.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(false);
    expect(strip?.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(false);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_FLASH_MS - INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS);
    expect(row?.classList.contains(INTEL_PHASE_CHANGE_FLASH_CLASS)).toBe(false);
    expect(strip?.classList.contains(INTEL_PHASE_CHANGE_FLASH_CLASS)).toBe(false);
    vi.useRealTimers();
  });

  it("fires onMarchArrivalReminders when phase changes on refresh", async () => {
    const gateway = {
      listMarches: vi
        .fn()
        .mockResolvedValueOnce({
          marches: [{ march_id: 5, phase: 2, to_x: 3, to_y: 4 }],
          total: 1,
        })
        .mockResolvedValueOnce({
          marches: [{ march_id: 5, phase: 3, to_x: 3, to_y: 4, report_id: 9 }],
          total: 1,
        }),
    };
    const onMarchArrivalReminders = vi.fn();
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      onMarchArrivalReminders,
      pollIntervalMs: 60_000,
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(gateway.listMarches).toHaveBeenCalledTimes(1));
    await panel.getRoot().querySelector<HTMLButtonElement>('[data-action="refresh-marches"]')!.click();
    await vi.waitFor(() => expect(onMarchArrivalReminders).toHaveBeenCalled());
    expect(onMarchArrivalReminders.mock.calls[0][0][0]).toMatchObject({
      marchId: 5,
      toX: 3,
      toY: 4,
      reportId: 9,
    });
  });

  it("remarch button opens military prefill without selecting row", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 7,
            phase: 2,
            to_x: 12,
            to_y: 13,
            troops: [{ unit_cfg_id: 1, count: 80 }],
          },
        ],
        total: 1,
      }),
    };
    const onRemarchFromRow = vi.fn();
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {}, {
      onRemarchFromRow,
    });
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelector(".march-row-remarch-btn")).toBeTruthy());

    const btn = mount.querySelector(".march-row-remarch-btn") as HTMLButtonElement;
    btn.click();
    expect(onRemarchFromRow).toHaveBeenCalledWith(
      expect.objectContaining({ march_id: 7, to_x: 12, to_y: 13 }),
    );
    expect(panel.getSelectedMarchId()).toBeNull();
  });

  it("exposes phase filter chips with aria-pressed (CLIENT-124)", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({ marches: [], total: 0 }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    const chips = mount.querySelectorAll('[data-action="march-phase-filter-chip"][data-ui-filter-chip]');
    expect(chips.length).toBe(5);
    const allChip = mount.querySelector(
      '[data-action="march-phase-filter-chip"][data-phase="all"]',
    ) as HTMLButtonElement;
    expect(allChip.getAttribute("aria-pressed")).toBe("true");
  });

  it("filters by phase and persists military-list-filter-v1 (CLIENT-109)", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          { march_id: 1, phase: 2, to_x: 1, to_y: 1 },
          { march_id: 2, phase: 4, to_x: 2, to_y: 2 },
        ],
        total: 2,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.toggle();
    await vi.waitFor(() => expect(mount.querySelectorAll(".march-list li").length).toBe(2));

    const returnChip = mount.querySelector(
      '[data-action="march-phase-filter-chip"][data-phase="return"]',
    ) as HTMLButtonElement;
    returnChip.click();
    expect(mount.querySelectorAll(".march-list li").length).toBe(1);
    expect(mount.querySelector('.march-list li[data-march-id="2"]')).toBeTruthy();
    expect(sessionStorage.getItem(MILITARY_LIST_FILTER_SESSION_KEY)).toContain('"return"');
  });

  it("shows error when listMarches fails", async () => {
    const gateway = {
      listMarches: vi.fn().mockRejectedValue(new Error("网关超时")),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.toggle();

    await vi.waitFor(() => {
      expect(mount.querySelector('[data-role="march-list-status"]')?.textContent).toContain("加载失败");
    });
  });
});
