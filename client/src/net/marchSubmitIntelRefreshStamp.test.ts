import { describe, expect, it, vi } from "vitest";
import {
  applyMarchSubmitIntelRefreshStamp,
  applyMarchSubmitIntelRefreshStampDeep,
  applyMarchSubmitIntelRefreshStampResidualDeep,
  applyMarchSubmitIntelRefreshStampResidualDeeper,
  applyMarchSubmitIntelRefreshStampResidualDeepest,
  applyMarchSubmitIntelRefreshStampResidualDeepestDeeper,
  formatMarchSubmitIntelRefreshStampLine,
  INTEL_LIST_REFRESH_MARCH_PULSE_CLASS,
  INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_CLASS,
  INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS,
  INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_CLASS,
  INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_CLASS,
  INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_MS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_MS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_MS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_MS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_MS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_MS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE,
} from "@/net/marchSubmitIntelRefreshStamp";
import { INTEL_ROW_PHASE_SUBLINE_CLASS } from "@/net/marchIntelPhaseEtaStrip";

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

  it("applyMarchSubmitIntelRefreshStampDeep shows deep class and subline pulse for 2.5s (CLIENT-253)", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `
      <p class="hidden" data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"></p>
      <ul class="march-list">
        <li data-march-id="9">
          <div class="march-row-body">
            <span class="march-row-primary">#9</span>
            <span class="${INTEL_ROW_PHASE_SUBLINE_CLASS}">行军中</span>
          </div>
        </li>
      </ul>
    `;
    const stamp = root.querySelector(`[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`)!;
    const subline = root.querySelector(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`)!;

    applyMarchSubmitIntelRefreshStampDeep(root, 9, Date.now());
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS)).toBe(true);
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_CLASS)).toBe(true);

    vi.advanceTimersByTime(MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_MS);
    expect(stamp.classList.contains("hidden")).toBe(true);
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS)).toBe(false);
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });

  it("applyMarchSubmitIntelRefreshStampResidualDeep extends stamp and subline pulse for 3s (CLIENT-269)", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `
      <p class="hidden" data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"></p>
      <ul class="march-list">
        <li data-march-id="11">
          <span class="${INTEL_ROW_PHASE_SUBLINE_CLASS}">行军中</span>
        </li>
      </ul>
    `;
    const stamp = root.querySelector(`[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`)!;
    const subline = root.querySelector(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`)!;

    applyMarchSubmitIntelRefreshStampResidualDeep(root, 11, Date.now());
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS)).toBe(true);
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS)).toBe(
      true,
    );
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_CLASS)).toBe(true);
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      true,
    );

    vi.advanceTimersByTime(MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_MS);
    expect(stamp.classList.contains("hidden")).toBe(false);
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      true,
    );

    vi.advanceTimersByTime(
      MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_MS - MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_MS,
    );
    expect(stamp.classList.contains("hidden")).toBe(true);
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS)).toBe(
      false,
    );
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      false,
    );
    vi.useRealTimers();
  });

  it("applyMarchSubmitIntelRefreshStampResidualDeeper extends stamp and subline deeper pulse for 3s (CLIENT-285)", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `
      <p class="hidden" data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"></p>
      <ul class="march-list">
        <li data-march-id="13">
          <span class="${INTEL_ROW_PHASE_SUBLINE_CLASS}">行军中</span>
        </li>
      </ul>
    `;
    const stamp = root.querySelector(`[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`)!;
    const subline = root.querySelector(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`)!;

    applyMarchSubmitIntelRefreshStampResidualDeeper(root, 13, Date.now());
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS)).toBe(true);
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_CLASS)).toBe(
      true,
    );
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      true,
    );
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(
      true,
    );

    vi.advanceTimersByTime(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_MS);
    expect(stamp.classList.contains("hidden")).toBe(true);
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_CLASS)).toBe(
      false,
    );
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(
      false,
    );
    vi.useRealTimers();
  });

  it("applyMarchSubmitIntelRefreshStampResidualDeepest extends stamp and subline deepest pulse for 3s (CLIENT-301)", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `
      <p class="hidden" data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"></p>
      <ul class="march-list">
        <li data-march-id="14">
          <span class="${INTEL_ROW_PHASE_SUBLINE_CLASS}">行军中</span>
        </li>
      </ul>
    `;
    const stamp = root.querySelector(`[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`)!;
    const subline = root.querySelector(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`)!;

    applyMarchSubmitIntelRefreshStampResidualDeepest(root, 14, Date.now());
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_CLASS)).toBe(
      true,
    );
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_CLASS)).toBe(
      true,
    );
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(
      true,
    );
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(
      true,
    );

    vi.advanceTimersByTime(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_MS);
    expect(stamp.classList.contains("hidden")).toBe(true);
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_CLASS)).toBe(
      false,
    );
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(
      false,
    );
    vi.useRealTimers();
  });

  it("applyMarchSubmitIntelRefreshStampResidualDeepestDeeper extends stamp and subline deepest-deeper pulse for 3s (CLIENT-317)", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `
      <p class="hidden" data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"></p>
      <ul class="march-list">
        <li data-march-id="15">
          <span class="${INTEL_ROW_PHASE_SUBLINE_CLASS}">行军中</span>
        </li>
      </ul>
    `;
    const stamp = root.querySelector(`[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`)!;
    const subline = root.querySelector(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`)!;

    applyMarchSubmitIntelRefreshStampResidualDeepestDeeper(root, 15, Date.now());
    expect(stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_CLASS)).toBe(
      true,
    );
    expect(
      stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_CLASS),
    ).toBe(true);
    expect(subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(
      true,
    );
    expect(
      subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(true);

    vi.advanceTimersByTime(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_MS);
    expect(stamp.classList.contains("hidden")).toBe(true);
    expect(
      stamp.classList.contains(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_CLASS),
    ).toBe(false);
    expect(
      subline.classList.contains(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(false);
    vi.useRealTimers();
  });
});
