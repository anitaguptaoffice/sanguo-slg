import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MARCH_HIGHLIGHT_SESSION_KEY, MARCH_ROW_RECENT_CLASS } from "@/net/marchHighlight";
import { MINIMAP_MARCH_FOCUS_SESSION_KEY } from "@/net/minimapMarchFocus";
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
    expect(row?.querySelector('[data-role="march-phase-chip"]')?.textContent).toBe("去程");
    expect(row?.querySelector(".march-row-primary")?.textContent).toContain("攻击");
    expect(row?.querySelector(".march-row-primary")?.textContent).toContain("(1,2)");
    expect(row?.querySelector(".march-row-meta")?.textContent).toContain("出发");
    expect(row?.querySelector(".march-row-meta")?.textContent).toMatch(/剩余|即将到达/);
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
