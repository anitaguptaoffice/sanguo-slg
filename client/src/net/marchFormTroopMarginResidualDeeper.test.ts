import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualDeeperLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPER_LINE_CLASS,
  syncMarchFormTroopMarginResidualDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeeper";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";

describe("formatMarchFormTroopMarginResidualDeeperLine (CLIENT-285)", () => {
  it("stacks deeper consolidate line on CLIENT-269 residual deep", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const deeper = formatMarchFormTroopMarginResidualDeeperLine(
      reserve,
      { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 120 },
      { food: 500 },
    );
    expect(deeper?.line).toContain("出征后城内余");
    expect(deeper?.deepLine).toContain("余量深对照");
    expect(deeper?.deeperLine).toContain("巩固再加深");
    expect(deeper?.deeperLine).toContain("余量巩固 ↔ 粮持");
    expect(deeper?.deeperLine).toContain("余量深对照");
  });

  it("uses warn margin snippet when troop reserve insufficient", () => {
    const reserve = formatMarchFormTroopReserveLine(120, 100);
    const deeper = formatMarchFormTroopMarginResidualDeeperLine(
      reserve,
      { summaryLine: "", resourceWarn: true, resourceWarnLine: "warn", estimatedFoodCost: 50 },
      { food: 10 },
    );
    expect(deeper?.deeperLine).toContain("余量警示 ↔ 粮途");
  });

  it("returns null when troop count not selected", () => {
    expect(
      formatMarchFormTroopMarginResidualDeeperLine(
        { line: null, insufficient: false, selected: null, available: 0 },
        null,
        undefined,
      ),
    ).toBeNull();
  });

  it("syncMarchFormTroopMarginResidualDeeperLine renders fourth line", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p data-role="march-form-troop-margin-residual-line">
        <span data-role="march-form-troop-margin-residual-primary"></span>
        <span data-role="march-form-troop-margin-residual-subline"></span>
        <span data-role="march-form-troop-margin-residual-deep-line"></span>
        <span data-role="march-form-troop-margin-residual-deeper-line"></span>
      </p>
    `;
    syncMarchFormTroopMarginResidualDeeperLine(root, {
      line: "兵力余量",
      subline: "钱包粮",
      hasWarn: false,
      deepLine: "余量深对照 · test",
      deeperLine: "巩固再加深 · test",
    });
    const deeper = root.querySelector('[data-role="march-form-troop-margin-residual-deeper-line"]')!;
    expect(deeper.textContent).toBe("巩固再加深 · test");
    expect(deeper.classList.contains(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPER_LINE_CLASS)).toBe(true);
    syncMarchFormTroopMarginResidualDeeperLine(root, null);
    expect(deeper.classList.contains("hidden")).toBe(true);
  });
});
