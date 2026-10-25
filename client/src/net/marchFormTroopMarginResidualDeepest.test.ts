import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualDeepestLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_LINE_CLASS,
  syncMarchFormTroopMarginResidualDeepestLine,
} from "@/net/marchFormTroopMarginResidualDeepest";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";

describe("formatMarchFormTroopMarginResidualDeepestLine (CLIENT-301)", () => {
  it("stacks deepest consolidate line on CLIENT-285 residual deeper", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const deepest = formatMarchFormTroopMarginResidualDeepestLine(
      reserve,
      { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 120 },
      { food: 500 },
    );
    expect(deepest?.line).toContain("出征后城内余");
    expect(deepest?.deepLine).toContain("余量深对照");
    expect(deepest?.deeperLine).toContain("巩固再加深");
    expect(deepest?.deepestLine).toContain("巩固再加深一层");
    expect(deepest?.deepestLine).toContain("余量再巩固 ↔ 粮稳");
    expect(deepest?.deepestLine).toContain("巩固再加深");
  });

  it("uses warn margin snippet when troop reserve insufficient", () => {
    const reserve = formatMarchFormTroopReserveLine(120, 100);
    const deepest = formatMarchFormTroopMarginResidualDeepestLine(
      reserve,
      { summaryLine: "", resourceWarn: true, resourceWarnLine: "warn", estimatedFoodCost: 50 },
      { food: 10 },
    );
    expect(deepest?.deepestLine).toContain("余量再警示 ↔ 粮途");
  });

  it("returns null when troop count not selected", () => {
    expect(
      formatMarchFormTroopMarginResidualDeepestLine(
        { line: null, insufficient: false, selected: null, available: 0 },
        null,
        undefined,
      ),
    ).toBeNull();
  });

  it("syncMarchFormTroopMarginResidualDeepestLine renders fifth line", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p data-role="march-form-troop-margin-residual-line">
        <span data-role="march-form-troop-margin-residual-primary"></span>
        <span data-role="march-form-troop-margin-residual-subline"></span>
        <span data-role="march-form-troop-margin-residual-deep-line"></span>
        <span data-role="march-form-troop-margin-residual-deeper-line"></span>
        <span data-role="march-form-troop-margin-residual-deepest-line"></span>
      </p>
    `;
    syncMarchFormTroopMarginResidualDeepestLine(root, {
      line: "兵力余量",
      subline: "钱包粮",
      hasWarn: false,
      deepLine: "余量深对照 · test",
      deeperLine: "巩固再加深 · test",
      deepestLine: "巩固再加深一层 · test",
    });
    const deepest = root.querySelector('[data-role="march-form-troop-margin-residual-deepest-line"]')!;
    expect(deepest.textContent).toBe("巩固再加深一层 · test");
    expect(deepest.classList.contains(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_LINE_CLASS)).toBe(true);
    syncMarchFormTroopMarginResidualDeepestLine(root, null);
    expect(deepest.classList.contains("hidden")).toBe(true);
  });
});
