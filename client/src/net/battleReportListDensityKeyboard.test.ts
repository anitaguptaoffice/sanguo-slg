import { describe, expect, it, vi } from "vitest";
import {
  applyBattleReportListDensityRowClasses,
  battleReportListKeyboardFocusIndex,
  battleReportListKeyboardDirectionFromKey,
  formatBattleReportListDensityCoordLine,
  formatBattleReportListDensityTimestampLine,
  formatBattleReportListDensityTitleLine,
  handleBattleReportListPanelKeyDown,
  REPORT_LIST_DENSITY_ROW_CLASS,
  REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
  syncBattleReportListKeyboardFocusRing,
} from "@/net/battleReportListDensityKeyboard";

describe("battleReportListDensityKeyboard (CLIENT-239)", () => {
  const summary = {
    report_id: 42,
    outcome: 1,
    defender_player_id: 9,
    location_x: 12,
    location_y: 34,
    created_at_ms: Date.UTC(2024, 5, 1, 8, 30),
  };

  it("formats density title, timestamp, and coord lines", () => {
    expect(formatBattleReportListDensityTitleLine(summary)).toBe("#42 · 守方玩家#9");
    expect(formatBattleReportListDensityTimestampLine(summary)).toContain("2024");
    expect(formatBattleReportListDensityCoordLine(summary)).toContain("12");
    expect(formatBattleReportListDensityCoordLine(summary)).toContain("34");
  });

  it("maps j/k and arrow keys to list nav directions", () => {
    expect(battleReportListKeyboardDirectionFromKey("j")).toBe("next");
    expect(battleReportListKeyboardDirectionFromKey("K")).toBe("prev");
    expect(battleReportListKeyboardDirectionFromKey("ArrowDown")).toBe("next");
    expect(battleReportListKeyboardDirectionFromKey("x")).toBeNull();
  });

  it("battleReportListKeyboardFocusIndex steps within filtered order", () => {
    const ids = [10, 8, 5];
    expect(battleReportListKeyboardFocusIndex(ids, 8, "prev")).toBe(0);
    expect(battleReportListKeyboardFocusIndex(ids, 8, "next")).toBe(2);
    expect(battleReportListKeyboardFocusIndex(ids, 10, "prev")).toBeNull();
    expect(battleReportListKeyboardFocusIndex(ids, 5, "next")).toBeNull();
  });

  it("applyBattleReportListDensityRowClasses sets row and outcome band class", () => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="report-list-density-outcome-band"></span>`;
    applyBattleReportListDensityRowClasses(li, summary);
    expect(li.classList.contains(REPORT_LIST_DENSITY_ROW_CLASS)).toBe(true);
    expect(li.querySelector(".report-list-density-outcome-band")?.classList.contains("outcome-attacker-win")).toBe(
      true,
    );
  });

  it("syncBattleReportListKeyboardFocusRing toggles focus ring on selected row", () => {
    const ul = document.createElement("ul");
    ul.innerHTML = `<li data-report-id="10"></li><li data-report-id="8"></li>`;
    syncBattleReportListKeyboardFocusRing(ul, 8);
    const rows = ul.querySelectorAll("li");
    expect(rows[0].classList.contains(REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS)).toBe(false);
    expect(rows[1].classList.contains(REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS)).toBe(true);
  });

  it("handleBattleReportListPanelKeyDown selects adjacent row from detail focus", () => {
    const panel = document.createElement("div");
    panel.className = "battle-report-panel";
    const detail = document.createElement("div");
    detail.setAttribute("data-role", "report-detail");
    detail.tabIndex = 0;
    const ul = document.createElement("ul");
    ul.innerHTML = `<li data-report-id="10"></li><li data-report-id="8"></li>`;
    panel.append(detail, ul);
    document.body.append(panel);

    const onSelect = vi.fn();
    detail.focus();
    const handled = handleBattleReportListPanelKeyDown(
      new KeyboardEvent("keydown", { key: "j", bubbles: true }),
      {
        panel,
        list: ul,
        orderedIds: [10, 8],
        selectedReportId: 10,
        onSelectReportId: onSelect,
      },
    );
    expect(handled).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(8);

    panel.remove();
  });
});
