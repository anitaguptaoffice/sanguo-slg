import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeper";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";

describe("formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine (CLIENT-381)", () => {
  it("stacks deepest-deepest-deepest-deepest-deeper consolidate line on CLIENT-365 residual deepest-deepest-deepest-deeper", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const deepestDeepestDeepestDeepestDeeper =
      formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(
        reserve,
        { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 120 },
        { food: 500 },
      );
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("出征后城内余");
    expect(deepestDeepestDeepestDeepestDeeper?.deepestDeepestDeepestDeeperLine).toContain("巩固再加深五层");
    expect(deepestDeepestDeepestDeepestDeeper?.deepestDeepestDeepestDeepestDeeperLine).toContain(
      "巩固再加深五层",
    );
    expect(deepestDeepestDeepestDeepestDeeper?.deepestDeepestDeepestDeepestDeeperLine).toContain(
      "余量六层巩固 ↔ 粮稳",
    );
    expect(deepestDeepestDeepestDeepestDeeper?.deepestDeepestDeepestDeepestDeeperLine).toContain(
      "巩固再加深五层",
    );
  });

  it("uses warn margin snippet when troop reserve insufficient", () => {
    const reserve = formatMarchFormTroopReserveLine(120, 100);
    const deepestDeepestDeepestDeepestDeeper =
      formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(
        reserve,
        { summaryLine: "", resourceWarn: true, resourceWarnLine: "warn", estimatedFoodCost: 50 },
        { food: 10 },
      );
    expect(deepestDeepestDeepestDeepestDeeper?.deepestDeepestDeepestDeepestDeeperLine).toContain(
      "余量六层警示 ↔ 粮途",
    );
  });

  it("returns null when troop count not selected", () => {
    expect(
      formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(
        { line: null, insufficient: false, selected: null, available: 0 },
        null,
        undefined,
      ),
    ).toBeNull();
  });

  it("syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine renders deepest-deepest-deepest-deepest-deeper line", () => {
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
        <span data-role="march-form-troop-margin-residual-deepest-deepest-deepest-deepest-deeper-line"></span>
      </p>
    `;
    syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(root, {
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
      deepestDeepestDeepestDeepestDeeperLine: "巩固再加深五层 · deepest-deepest-deepest-deepest · test",
    });
    const deepestDeepestDeepestDeepestDeeper = root.querySelector(
      '[data-role="march-form-troop-margin-residual-deepest-deepest-deepest-deepest-deeper-line"]',
    )!;
    expect(deepestDeepestDeepestDeepestDeeper.textContent).toBe(
      "巩固再加深五层 · deepest-deepest-deepest-deepest · test",
    );
    expect(
      deepestDeepestDeepestDeepestDeeper.classList.contains(
        MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
      ),
    ).toBe(true);
    syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(root, null);
    expect(deepestDeepestDeepestDeepestDeeper.classList.contains("hidden")).toBe(true);
  });
});
