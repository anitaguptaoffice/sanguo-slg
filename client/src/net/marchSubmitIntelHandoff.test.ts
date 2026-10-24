import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyMarchSubmitIntelHandoff,
  formatMarchSubmitIntelHandoffLine,
  formatMarchSubmitIntelHandoffPhaseHint,
  INTEL_NEW_MARCH_HIGHLIGHT_CLASS,
  INTEL_NEW_MARCH_HIGHLIGHT_MS,
  MARCH_SUBMIT_INTEL_HANDOFF_LINE_ROLE,
  pulseIntelNewMarchHighlight,
} from "@/net/marchSubmitIntelHandoff";

describe("marchSubmitIntelHandoff", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formatMarchSubmitIntelHandoffLine includes coords and phase hint", () => {
    expect(formatMarchSubmitIntelHandoffLine(3, 4, "行军中 · 剩 120s")).toBe(
      "军情交接 · (3,4) · 行军中 · 剩 120s",
    );
    expect(formatMarchSubmitIntelHandoffLine(1, 2, "")).toBe("军情交接 · (1,2) · 行军中");
  });

  it("formatMarchSubmitIntelHandoffPhaseHint uses march phase strip", () => {
    const now = 1_000_000;
    const arrive = now + 90_000;
    expect(
      formatMarchSubmitIntelHandoffPhaseHint(
        { march_id: 1, phase: 2, to_x: 1, to_y: 2, arrive_at_ms: arrive },
        now,
      ),
    ).toMatch(/行军中/);
    expect(formatMarchSubmitIntelHandoffPhaseHint(null, now)).toBe("行军中");
  });

  it("pulseIntelNewMarchHighlight applies intel-new-march-highlight for 3s", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `<ul class="march-list"><li data-march-id="7"></li></ul>`;
    const row = root.querySelector("li")!;
    pulseIntelNewMarchHighlight(root, 7);
    expect(row.classList.contains(INTEL_NEW_MARCH_HIGHLIGHT_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_NEW_MARCH_HIGHLIGHT_MS - 1);
    expect(row.classList.contains(INTEL_NEW_MARCH_HIGHLIGHT_CLASS)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(row.classList.contains(INTEL_NEW_MARCH_HIGHLIGHT_CLASS)).toBe(false);
  });

  it("applyMarchSubmitIntelHandoff syncs handoff line and row highlight", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `
      <p class="hidden" data-role="${MARCH_SUBMIT_INTEL_HANDOFF_LINE_ROLE}"></p>
      <ul class="march-list"><li data-march-id="5"></li></ul>
    `;
    const line = root.querySelector(`[data-role="${MARCH_SUBMIT_INTEL_HANDOFF_LINE_ROLE}"]`)!;
    const row = root.querySelector("li")!;
    const now = 2_000_000;
    const arrive = now + 60_000;
    applyMarchSubmitIntelHandoff(root, 5, {
      march: { march_id: 5, phase: 2, to_x: 8, to_y: 9, arrive_at_ms: arrive },
      toX: 8,
      toY: 9,
      nowMs: now,
    });
    expect(line.classList.contains("hidden")).toBe(false);
    expect(line.textContent).toMatch(/^军情交接 · \(8,9\) · /);
    expect(row.classList.contains(INTEL_NEW_MARCH_HIGHLIGHT_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_NEW_MARCH_HIGHLIGHT_MS);
    expect(row.classList.contains(INTEL_NEW_MARCH_HIGHLIGHT_CLASS)).toBe(false);
    expect(line.classList.contains("hidden")).toBe(true);
  });
});
