import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualDeepestDeeperLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
  syncMarchFormTroopMarginResidualDeepestDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeeper";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";

describe("formatMarchFormTroopMarginResidualDeepestDeeperLine (CLIENT-317)", () => {
  it("stacks deepest-deeper consolidate line on CLIENT-301 residual deepest", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const deepestDeeper = formatMarchFormTroopMarginResidualDeepestDeeperLine(
      reserve,
      { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 120 },
      { food: 500 },
    );
    expect(deepestDeeper?.line).toContain("出征后城内余");
    expect(deepestDeeper?.deepestLine).toContain("巩固再加深一层");
    expect(deepestDeeper?.deepestDeeperLine).toContain("巩固再加深二层");
    expect(deepestDeeper?.deepestDeeperLine).toContain("余量二层巩固 ↔ 粮稳");
    expect(deepestDeeper?.deepestDeeperLine).toContain("巩固再加深一层");
  });

  it("uses warn margin snippet when troop reserve insufficient", () => {
    const reserve = formatMarchFormTroopReserveLine(120, 100);
    const deepestDeeper = formatMarchFormTroopMarginResidualDeepestDeeperLine(
      reserve,
      { summaryLine: "", resourceWarn: true, resourceWarnLine: "warn", estimatedFoodCost: 50 },
      { food: 10 },
    );
    expect(deepestDeeper?.deepestDeeperLine).toContain("余量二层警示 ↔ 粮途");
  });

  it("returns null when troop count not selected", () => {
    expect(
      formatMarchFormTroopMarginResidualDeepestDeeperLine(
        { line: null, insufficient: false, selected: null, available: 0 },
        null,
        undefined,
      ),
    ).toBeNull();
  });

  it("syncMarchFormTroopMarginResidualDeepestDeeperLine renders deepest-deeper line", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p data-role="march-form-troop-margin-residual-line">
        <span data-role="march-form-troop-margin-residual-primary"></span>
        <span data-role="march-form-troop-margin-residual-subline"></span>
        <span data-role="march-form-troop-margin-residual-deep-line"></span>
        <span data-role="march-form-troop-margin-residual-deeper-line"></span>
        <span data-role="march-form-troop-margin-residual-deepest-line"></span>
        <span data-role="march-form-troop-margin-residual-deepest-deeper-line"></span>
      </p>
    `;
    syncMarchFormTroopMarginResidualDeepestDeeperLine(root, {
      line: "兵力余量",
      subline: "钱包粮",
      hasWarn: false,
      deepLine: "余量深对照 · test",
      deeperLine: "巩固再加深 · test",
      deepestLine: "巩固再加深一层 · test",
      deepestDeeperLine: "巩固再加深二层 · test",
    });
    const deepestDeeper = root.querySelector(
      '[data-role="march-form-troop-margin-residual-deepest-deeper-line"]',
    )!;
    expect(deepestDeeper.textContent).toBe("巩固再加深二层 · test");
    expect(deepestDeeper.classList.contains(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS)).toBe(
      true,
    );
    syncMarchFormTroopMarginResidualDeepestDeeperLine(root, null);
    expect(deepestDeeper.classList.contains("hidden")).toBe(true);
  });
});
