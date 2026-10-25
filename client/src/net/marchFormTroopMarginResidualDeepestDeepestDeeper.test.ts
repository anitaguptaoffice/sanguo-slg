import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualDeepestDeepestDeeperLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  syncMarchFormTroopMarginResidualDeepestDeepestDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeepestDeeper";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";

describe("formatMarchFormTroopMarginResidualDeepestDeepestDeeperLine (CLIENT-333)", () => {
  it("stacks deepest-deepest-deeper consolidate line on CLIENT-317 residual deepest-deeper", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const deepestDeepestDeeper = formatMarchFormTroopMarginResidualDeepestDeepestDeeperLine(
      reserve,
      { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 120 },
      { food: 500 },
    );
    expect(deepestDeepestDeeper?.line).toContain("出征后城内余");
    expect(deepestDeepestDeeper?.deepestDeeperLine).toContain("巩固再加深二层");
    expect(deepestDeepestDeeper?.deepestDeepestDeeperLine).toContain("巩固再加深三层");
    expect(deepestDeepestDeeper?.deepestDeepestDeeperLine).toContain("余量三层巩固 ↔ 粮稳");
    expect(deepestDeepestDeeper?.deepestDeepestDeeperLine).toContain("巩固再加深二层");
  });

  it("uses warn margin snippet when troop reserve insufficient", () => {
    const reserve = formatMarchFormTroopReserveLine(120, 100);
    const deepestDeepestDeeper = formatMarchFormTroopMarginResidualDeepestDeepestDeeperLine(
      reserve,
      { summaryLine: "", resourceWarn: true, resourceWarnLine: "warn", estimatedFoodCost: 50 },
      { food: 10 },
    );
    expect(deepestDeepestDeeper?.deepestDeepestDeeperLine).toContain("余量三层警示 ↔ 粮途");
  });

  it("returns null when troop count not selected", () => {
    expect(
      formatMarchFormTroopMarginResidualDeepestDeepestDeeperLine(
        { line: null, insufficient: false, selected: null, available: 0 },
        null,
        undefined,
      ),
    ).toBeNull();
  });

  it("syncMarchFormTroopMarginResidualDeepestDeepestDeeperLine renders deepest-deepest-deeper line", () => {
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
      </p>
    `;
    syncMarchFormTroopMarginResidualDeepestDeepestDeeperLine(root, {
      line: "兵力余量",
      subline: "钱包粮",
      hasWarn: false,
      deepLine: "余量深对照 · test",
      deeperLine: "巩固再加深 · test",
      deepestLine: "巩固再加深一层 · test",
      deepestDeeperLine: "巩固再加深二层 · test",
      deepestDeepestDeeperLine: "巩固再加深三层 · test",
    });
    const deepestDeepestDeeper = root.querySelector(
      '[data-role="march-form-troop-margin-residual-deepest-deepest-deeper-line"]',
    )!;
    expect(deepestDeepestDeeper.textContent).toBe("巩固再加深三层 · test");
    expect(
      deepestDeepestDeeper.classList.contains(
        MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
      ),
    ).toBe(true);
    syncMarchFormTroopMarginResidualDeepestDeepestDeeperLine(root, null);
    expect(deepestDeepestDeeper.classList.contains("hidden")).toBe(true);
  });
});
