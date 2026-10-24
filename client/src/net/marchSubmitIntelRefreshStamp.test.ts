import { describe, expect, it, vi } from "vitest";
import {
  applyMarchSubmitIntelRefreshStamp,
  formatMarchSubmitIntelRefreshStampLine,
  INTEL_LIST_REFRESH_MARCH_PULSE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_MS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE,
} from "@/net/marchSubmitIntelRefreshStamp";

describe("marchSubmitIntelRefreshStamp (CLIENT-238)", () => {
  it("formatMarchSubmitIntelRefreshStampLine includes march id and relative time", () => {
    const now = 1_700_000_000_000;
    const line = formatMarchSubmitIntelRefreshStampLine(7, now - 5_000, now);
    expect(line).toBe("军情 ListMarches 已刷新（刚刚） · 新行军 #7");
    expect(formatMarchSubmitIntelRefreshStampLine(0, now)).toBe("");
  });

  it("applyMarchSubmitIntelRefreshStamp shows stamp and row pulse for 2s", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `
      <p class="hidden" data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"></p>
      <ul class="march-list"><li data-march-id="5">row</li></ul>
    `;
    const stamp = root.querySelector(`[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`)!;
    const row = root.querySelector('li[data-march-id="5"]')!;

    applyMarchSubmitIntelRefreshStamp(root, 5, Date.now());
    expect(stamp.classList.contains("hidden")).toBe(false);
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS)).toBe(true);
    expect(stamp.textContent).toMatch(/新行军 #5/);
    expect(row.classList.contains(INTEL_LIST_REFRESH_MARCH_PULSE_CLASS)).toBe(true);

    vi.advanceTimersByTime(MARCH_SUBMIT_INTEL_REFRESH_STAMP_MS);
    expect(stamp.classList.contains("hidden")).toBe(true);
    expect(row.classList.contains(INTEL_LIST_REFRESH_MARCH_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});
