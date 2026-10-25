import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualDeepestDeepestDeepestLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS,
  syncMarchFormTroopMarginResidualDeepestDeepestDeepestLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeepestDeepest";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";

describe("formatMarchFormTroopMarginResidualDeepestDeepestDeepestLine (CLIENT-349)", () => {
  it("stacks deepest-deepest-deepest consolidate line on CLIENT-333 residual deepest-deepest-deeper", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const deepestDeepestDeepest = formatMarchFormTroopMarginResidualDeepestDeepestDeepestLine(
      reserve,
      { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 120 },
      { food: 500 },
    );
    expect(deepestDeepestDeepest?.line).toContain("出征后城内余");
    expect(deepestDeepestDeepest?.deepestDeepestDeeperLine).toContain("巩固再加深三层");
    expect(deepestDeepestDeepest?.deepestDeepestDeepestLine).toContain("巩固再加深四层");
    expect(deepestDeepestDeepest?.deepestDeepestDeepestLine).toContain("余量四层巩固 ↔ 粮稳");
    expect(deepestDeepestDeepest?.deepestDeepestDeepestLine).toContain("巩固再加深三层");
  });

  it("uses warn margin snippet when troop reserve insufficient", () => {
    const reserve = formatMarchFormTroopReserveLine(120, 100);
    const deepestDeepestDeepest = formatMarchFormTroopMarginResidualDeepestDeepestDeepestLine(
      reserve,
      { summaryLine: "", resourceWarn: true, resourceWarnLine: "warn", estimatedFoodCost: 50 },
      { food: 10 },
    );
    expect(deepestDeepestDeepest?.deepestDeepestDeepestLine).toContain("余量四层警示 ↔ 粮途");
  });

  it("returns null when troop count not selected", () => {
    expect(
      formatMarchFormTroopMarginResidualDeepestDeepestDeepestLine(
        { line: null, insufficient: false, selected: null, available: 0 },
        null,
        undefined,
      ),
    ).toBeNull();
  });

  it("syncMarchFormTroopMarginResidualDeepestDeepestDeepestLine renders deepest-deepest-deepest line", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p data-role="march-form-troop-margin-residual-line">
        <span data-role="march-form-troop-margin-residual-primary"></span>
        <span data-role="march-form-troop-margin-residual-subline"></span>
        <span data-role="march-form-troop-margin-residual-deep-line"></span>
        <span data-role="march-form-troop-margin-residual-deeper-line"></span>
        <span data-role="march-form-troop-margin-residual-deepest-line"></span>
        <span data-role="march-form-troop-margin-residual-deepest-deeper-line"></span>
        <span data-role="march-form-troop-margin-residual-deepest-deepest-deeper-line"></span>
        <span data-role="march-form-troop-margin-residual-deepest-deepest-deepest-line"></span>
      </p>
    `;
    syncMarchFormTroopMarginResidualDeepestDeepestDeepestLine(root, {
      line: "兵力余量",
      subline: "钱包粮",
      hasWarn: false,
      deepLine: "余量深对照 · test",
      deeperLine: "巩固再加深 · test",
      deepestLine: "巩固再加深一层 · test",
      deepestDeeperLine: "巩固再加深二层 · test",
      deepestDeepestDeeperLine: "巩固再加深三层 · test",
      deepestDeepestDeepestLine: "巩固再加深四层 · test",
    });
    const deepestDeepestDeepest = root.querySelector(
      '[data-role="march-form-troop-margin-residual-deepest-deepest-deepest-line"]',
    )!;
    expect(deepestDeepestDeepest.textContent).toBe("巩固再加深四层 · test");
    expect(
      deepestDeepestDeepest.classList.contains(
        MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS,
      ),
    ).toBe(true);
    syncMarchFormTroopMarginResidualDeepestDeepestDeepestLine(root, null);
    expect(deepestDeepestDeepest.classList.contains("hidden")).toBe(true);
  });
});
