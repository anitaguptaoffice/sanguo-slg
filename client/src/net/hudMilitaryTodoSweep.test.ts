import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HUD_MILITARY_TODO_PULSE_CLASS,
  HUD_MILITARY_TODO_PULSE_MS,
  buildHudMilitaryTodoSweepCounts,
  countIntelInProgressMarches,
  formatHudMilitaryTodoSweepLine,
  hudMilitaryTodoFacetForToolbarAction,
  hudMilitaryTodoSweepSegments,
  resolveHudMarchSubmittableCount,
  resolveToolbarPanelFromHudMilitaryTodo,
  scheduleHudMilitaryTodoPulse,
  toolbarPanelActionFromHudMilitaryTodo,
} from "@/net/hudMilitaryTodoSweep";

describe("formatHudMilitaryTodoSweepLine (CLIENT-226)", () => {
  it("segments intel in progress, battle report unread, and march submittable", () => {
    expect(
      formatHudMilitaryTodoSweepLine({
        intelInProgress: 2,
        battleReportUnread: 3,
        marchSubmittable: 1,
      }),
    ).toBe("军情进行中 2 · 战报未读 3 · 出征可提交 1");
    expect(
      formatHudMilitaryTodoSweepLine({
        intelInProgress: 1,
        battleReportUnread: 0,
        marchSubmittable: 0,
      }),
    ).toBe("军情进行中 1");
    expect(
      formatHudMilitaryTodoSweepLine({
        intelInProgress: 0,
        battleReportUnread: 0,
        marchSubmittable: 0,
      }),
    ).toBeNull();
  });

  it("hudMilitaryTodoSweepSegments omit zero facets", () => {
    const segments = hudMilitaryTodoSweepSegments({
      intelInProgress: 0,
      battleReportUnread: 2,
      marchSubmittable: 1,
    });
    expect(segments.map((s) => s.facet)).toEqual(["reports", "march"]);
  });

  it("countIntelInProgressMarches ignores completed phases", () => {
    expect(
      countIntelInProgressMarches([
        { phase: 2, march_id: 1 },
        { phase: 5, march_id: 2 },
      ]),
    ).toBe(1);
  });

  it("resolveHudMarchSubmittableCount respects submit state and validation", () => {
    expect(
      resolveHudMarchSubmittableCount(
        "submitting",
        { ok: true, toX: 1, toY: 2, marchCount: 10 },
        null,
      ),
    ).toBe(0);
    expect(
      resolveHudMarchSubmittableCount(
        "idle",
        { ok: true, toX: 1, toY: 2, marchCount: 10 },
        null,
      ),
    ).toBe(1);
    expect(
      resolveHudMarchSubmittableCount("idle", { ok: false, message: "x" }, null),
    ).toBe(0);
  });

  it("buildHudMilitaryTodoSweepCounts merges march list and form snapshot", () => {
    const counts = buildHudMilitaryTodoSweepCounts({
      marches: [{ phase: 1, march_id: 9 }],
      battleReportUnread: 4,
      marchSubmitState: "idle",
      marchFormValidation: { ok: true, toX: 0, toY: 0, marchCount: 1 },
      troopReserve: null,
    });
    expect(counts).toEqual({
      intelInProgress: 1,
      battleReportUnread: 4,
      marchSubmittable: 1,
    });
  });
});

describe("resolveToolbarPanelFromHudMilitaryTodo (CLIENT-226)", () => {
  const counts = {
    intelInProgress: 2,
    battleReportUnread: 3,
    marchSubmittable: 1,
  };

  it("returns panel when facet has todo", () => {
    expect(resolveToolbarPanelFromHudMilitaryTodo("intel", counts)).toBe("marches");
    expect(resolveToolbarPanelFromHudMilitaryTodo("reports", counts)).toBe("reports");
    expect(resolveToolbarPanelFromHudMilitaryTodo("march", counts)).toBe("military");
  });

  it("returns null when facet has no todo", () => {
    expect(
      resolveToolbarPanelFromHudMilitaryTodo("intel", { ...counts, intelInProgress: 0 }),
    ).toBeNull();
  });

  it("maps panels to toolbar data-action", () => {
    expect(toolbarPanelActionFromHudMilitaryTodo("marches")).toBe("toggle-marches");
    expect(toolbarPanelActionFromHudMilitaryTodo("military")).toBe("toggle-military");
  });

  it("hudMilitaryTodoFacetForToolbarAction aligns with badge deep link", () => {
    expect(hudMilitaryTodoFacetForToolbarAction("toggle-reports", counts)).toBe("reports");
    expect(hudMilitaryTodoFacetForToolbarAction("toggle-mail", counts)).toBeNull();
  });
});

describe("scheduleHudMilitaryTodoPulse", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${HUD_MILITARY_TODO_PULSE_CLASS} for ${HUD_MILITARY_TODO_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleHudMilitaryTodoPulse(btn);
    expect(btn.classList.contains(HUD_MILITARY_TODO_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(HUD_MILITARY_TODO_PULSE_MS);
    expect(btn.classList.contains(HUD_MILITARY_TODO_PULSE_CLASS)).toBe(false);
  });
});
