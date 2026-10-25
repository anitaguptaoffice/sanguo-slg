import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeepestDeepestDeeper";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";

describe("formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine (CLIENT-365)", () => {
  it("stacks deepest-deepest-deepest-deeper consolidate line on CLIENT-349 residual deepest-deepest-deepest", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const deepestDeepestDeepestDeeper = formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(
      reserve,
      { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 120 },
      { food: 500 },
    );
    expect(deepestDeepestDeepestDeeper?.line).toContain("出征后城内余");
    expect(deepestDeepestDeepestDeeper?.deepestDeepestDeepestLine).toContain("巩固再加深四层");
    expect(deepestDeepestDeepestDeeper?.deepestDeepestDeepestDeeperLine).toContain("巩固再加深五层");
    expect(deepestDeepestDeepestDeeper?.deepestDeepestDeepestDeeperLine).toContain("余量五层巩固 ↔ 粮稳");
    expect(deepestDeepestDeepestDeeper?.deepestDeepestDeepestDeeperLine).toContain("巩固再加深四层");
  });

  it("uses warn margin snippet when troop reserve insufficient", () => {
    const reserve = formatMarchFormTroopReserveLine(120, 100);
    const deepestDeepestDeepestDeeper = formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(
      reserve,
      { summaryLine: "", resourceWarn: true, resourceWarnLine: "warn", estimatedFoodCost: 50 },
      { food: 10 },
    );
    expect(deepestDeepestDeepestDeeper?.deepestDeepestDeepestDeeperLine).toContain("余量五层警示 ↔ 粮途");
  });

  it("returns null when troop count not selected", () => {
    expect(
      formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(
        { line: null, insufficient: false, selected: null, available: 0 },
        null,
        undefined,
      ),
    ).toBeNull();
  });

  it("syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine renders deepest-deepest-deepest-deeper line", () => {
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
        <span data-role="march-form-troop-margin-residual-deepest-deepest-deepest-deeper-line"></span>
      </p>
    `;
    syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(root, {
      line: "兵力余量",
      subline: "钱包粮",
      hasWarn: false,
      deepLine: "余量深对照 · test",
      deeperLine: "巩固再加深 · test",
      deepestLine: "巩固再加深一层 · test",
      deepestDeeperLine: "巩固再加深二层 · test",
      deepestDeepestDeeperLine: "巩固再加深三层 · test",
      deepestDeepestDeepestLine: "巩固再加深四层 · test",
      deepestDeepestDeepestDeeperLine: "巩固再加深五层 · test",
    });
    const deepestDeepestDeepestDeeper = root.querySelector(
      '[data-role="march-form-troop-margin-residual-deepest-deepest-deepest-deeper-line"]',
    )!;
    expect(deepestDeepestDeepestDeeper.textContent).toBe("巩固再加深五层 · test");
    expect(
      deepestDeepestDeepestDeeper.classList.contains(
        MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
      ),
    ).toBe(true);
    syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(root, null);
    expect(deepestDeepestDeepestDeeper.classList.contains("hidden")).toBe(true);
  });
});
