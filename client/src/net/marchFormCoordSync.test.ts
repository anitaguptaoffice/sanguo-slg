import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import {
  createMarchFormCoordSyncTimers,
  formatMarchIntelCoordSyncEmptyHint,
  highlightMarchFormCoordsFromIntel,
  MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS,
  MARCH_FORM_COORD_SYNC_HIGHLIGHT_MS,
  MARCH_INTEL_COORD_SYNC_EMPTY_HINT_ROLE,
  MARCH_INTEL_ROW_COORD_SYNC_HIGHLIGHT_CLASS,
  scrollIntelRowForCoords,
} from "@/net/marchFormCoordSync";

describe("marchFormCoordSync (CLIENT-189)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formatMarchIntelCoordSyncEmptyHint describes coord with no march", () => {
    expect(formatMarchIntelCoordSyncEmptyHint(3, 7)).toContain("(3,7)");
    expect(formatMarchIntelCoordSyncEmptyHint(3, 7)).toContain("暂无指向行军");
  });

  it("highlightMarchFormCoordsFromIntel marks inputs when form matches march dest", () => {
    const military = document.createElement("div");
    military.innerHTML = `
      <input data-field="to-x" value="10" />
      <input data-field="to-y" value="20" />
    `;
    const march: MarchSummary = { march_id: 1, to_x: 10, to_y: 20 };
    const timers = createMarchFormCoordSyncTimers();

    highlightMarchFormCoordsFromIntel(military, march, { timers });
    expect(military.querySelector('[data-field="to-x"]')?.classList.contains(MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS)).toBe(
      true,
    );
    expect(military.querySelector('[data-field="to-y"]')?.classList.contains(MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS)).toBe(
      true,
    );

    vi.advanceTimersByTime(MARCH_FORM_COORD_SYNC_HIGHLIGHT_MS);
    expect(military.querySelector(`.${MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS}`)).toBeNull();
  });

  it("highlightMarchFormCoordsFromIntel highlights even when form coords differ", () => {
    const military = document.createElement("div");
    military.innerHTML = `
      <input data-field="to-x" value="1" />
      <input data-field="to-y" value="2" />
    `;
    highlightMarchFormCoordsFromIntel(military, { march_id: 1, to_x: 10, to_y: 20 });
    expect(military.querySelectorAll(`.${MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS}`).length).toBe(2);
  });

  it("scrollIntelRowForCoords scrolls matching row and clears highlight after TTL", () => {
    const intel = document.createElement("div");
    intel.innerHTML = `
      <p data-role="${MARCH_INTEL_COORD_SYNC_EMPTY_HINT_ROLE}" class="hidden"></p>
      <div data-role="march-scroll"><ul class="march-list">
        <li data-march-id="5"></li>
        <li data-march-id="9"></li>
      </ul></div>
    `;
    const row = intel.querySelector('li[data-march-id="5"]') as HTMLElement;
    row.scrollIntoView = vi.fn();

    const marches: MarchSummary[] = [
      { march_id: 5, to_x: 4, to_y: 6 },
      { march_id: 9, to_x: 1, to_y: 1 },
    ];
    const timers = createMarchFormCoordSyncTimers();

    scrollIntelRowForCoords(intel, marches, 4, 6, { timers });
    expect(row.classList.contains(MARCH_INTEL_ROW_COORD_SYNC_HIGHLIGHT_CLASS)).toBe(true);
    expect(row.scrollIntoView).toHaveBeenCalled();
    expect(intel.querySelector(`[data-role="${MARCH_INTEL_COORD_SYNC_EMPTY_HINT_ROLE}"]`)?.classList.contains("hidden")).toBe(
      true,
    );

    vi.advanceTimersByTime(MARCH_FORM_COORD_SYNC_HIGHLIGHT_MS);
    expect(row.classList.contains(MARCH_INTEL_ROW_COORD_SYNC_HIGHLIGHT_CLASS)).toBe(false);
  });

  it("scrollIntelRowForCoords shows empty hint when no march matches", () => {
    const intel = document.createElement("div");
    intel.innerHTML = `
      <p data-role="${MARCH_INTEL_COORD_SYNC_EMPTY_HINT_ROLE}" class="hidden"></p>
      <ul class="march-list"><li data-march-id="1"></li></ul>
    `;
    scrollIntelRowForCoords(intel, [{ march_id: 1, to_x: 2, to_y: 2 }], 9, 9);
    const hint = intel.querySelector(`[data-role="${MARCH_INTEL_COORD_SYNC_EMPTY_HINT_ROLE}"]`);
    expect(hint?.classList.contains("hidden")).toBe(false);
    expect(hint?.textContent).toContain("(9,9)");
    expect(hint?.getAttribute("data-panel-state")).toBe("empty");
  });
});
