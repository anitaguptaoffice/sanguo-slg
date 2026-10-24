import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualDeepLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS,
  syncMarchFormTroopMarginResidualDeepLine,
} from "@/net/marchFormTroopMarginResidualDeep";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";

describe("formatMarchFormTroopMarginResidualDeepLine (CLIENT-269)", () => {
  it("stacks deep consolidate line on CLIENT-253 residual", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const deep = formatMarchFormTroopMarginResidualDeepLine(
      reserve,
      { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 120 },
      { food: 500 },
    );
    expect(deep?.line).toContain("出征后城内余");
    expect(deep?.subline).toContain("途耗约");
    expect(deep?.deepLine).toContain("余量深对照");
    expect(deep?.deepLine).toContain("出征后余 60");
    expect(deep?.deepLine).toContain("粮持");
  });

  it("returns null when troop count not selected", () => {
    expect(
      formatMarchFormTroopMarginResidualDeepLine(
        { line: null, insufficient: false, selected: null, available: 0 },
        null,
        undefined,
      ),
    ).toBeNull();
  });

  it("syncMarchFormTroopMarginResidualDeepLine renders third line", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p data-role="march-form-troop-margin-residual-line">
        <span data-role="march-form-troop-margin-residual-primary"></span>
        <span data-role="march-form-troop-margin-residual-subline"></span>
        <span data-role="march-form-troop-margin-residual-deep-line"></span>
      </p>
    `;
    syncMarchFormTroopMarginResidualDeepLine(root, {
      line: "兵力余量",
      subline: "钱包粮",
      hasWarn: false,
      deepLine: "余量深对照 · test",
    });
    const deep = root.querySelector('[data-role="march-form-troop-margin-residual-deep-line"]')!;
    expect(deep.textContent).toBe("余量深对照 · test");
    expect(deep.classList.contains(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS)).toBe(true);
    syncMarchFormTroopMarginResidualDeepLine(root, null);
    expect(deep.classList.contains("hidden")).toBe(true);
  });
});
