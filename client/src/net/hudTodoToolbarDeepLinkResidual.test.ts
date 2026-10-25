import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_MS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_MS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_MS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_MS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_MS,
  pulseHudTodoToolbarDeepLinkResidual,
  scheduleHudTodoToolbarDeepLinkResidualDeepPulse,
  scheduleHudTodoToolbarDeepLinkResidualDeeperPulse,
  scheduleHudTodoToolbarDeepLinkResidualDeepestDeeperPulse,
  scheduleHudTodoToolbarDeepLinkResidualDeepestDeepestDeepestPulse,
  scheduleHudTodoToolbarDeepLinkResidualDeepestDeepestDeeperPulse,
  scheduleHudTodoToolbarDeepLinkResidualDeepestPulse,
  scheduleHudTodoToolbarDeepLinkResidualPulse,
} from "@/net/hudTodoToolbarDeepLinkResidual";
import { TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS } from "@/net/hudTodoMergedSweep";

describe("scheduleHudTodoToolbarDeepLinkResidualPulse (CLIENT-250)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS} for ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleHudTodoToolbarDeepLinkResidualPulse(btn);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_MS);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS)).toBe(false);
  });
});

describe("scheduleHudTodoToolbarDeepLinkResidualDeepPulse (CLIENT-266)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS} for ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleHudTodoToolbarDeepLinkResidualDeepPulse(btn);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_MS);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS)).toBe(false);
  });
});

describe("scheduleHudTodoToolbarDeepLinkResidualDeeperPulse (CLIENT-282)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS} for ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleHudTodoToolbarDeepLinkResidualDeeperPulse(btn);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(
      true,
    );
    vi.advanceTimersByTime(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_MS);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(
      false,
    );
  });
});

describe("scheduleHudTodoToolbarDeepLinkResidualDeepestPulse (CLIENT-298)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS} for ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleHudTodoToolbarDeepLinkResidualDeepestPulse(btn);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(
      true,
    );
    vi.advanceTimersByTime(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_MS);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(
      false,
    );
  });
});

describe("scheduleHudTodoToolbarDeepLinkResidualDeepestDeeperPulse (CLIENT-314)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS} for ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleHudTodoToolbarDeepLinkResidualDeepestDeeperPulse(btn);
    expect(
      btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(true);
    vi.advanceTimersByTime(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_MS);
    expect(
      btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(false);
  });
});

describe("scheduleHudTodoToolbarDeepLinkResidualDeepestDeepestDeepestPulse (CLIENT-346)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS} for ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleHudTodoToolbarDeepLinkResidualDeepestDeepestDeepestPulse(btn);
    expect(
      btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS),
    ).toBe(true);
    vi.advanceTimersByTime(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS);
    expect(
      btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS),
    ).toBe(false);
  });
});

describe("scheduleHudTodoToolbarDeepLinkResidualDeepestDeepestDeeperPulse (CLIENT-330)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS} for ${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleHudTodoToolbarDeepLinkResidualDeepestDeepestDeeperPulse(btn);
    expect(
      btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(true);
    vi.advanceTimersByTime(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS);
    expect(
      btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(false);
  });
});

describe("pulseHudTodoToolbarDeepLinkResidual (CLIENT-250)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stacks residual pulse with CLIENT-216 toolbar deep link pulse", () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    pulseHudTodoToolbarDeepLinkResidual(btn);
    expect(btn.classList.contains(TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS)).toBe(true);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS)).toBe(true);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(
      true,
    );
    expect(btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(
      true,
    );
    expect(
      btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(true);
    expect(
      btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(true);
    expect(
      btn.classList.contains(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS),
    ).toBe(true);
  });
});
