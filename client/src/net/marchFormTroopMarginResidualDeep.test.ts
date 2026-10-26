import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualDeepLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS,
  syncMarchFormTroopMarginResidualDeepLine,
} from "@/net/marchFormTroopMarginResidualDeep";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";
import { formatMarchFormSummary } from "@/net/marchFormSummary";
import { formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine } from "@/net/marchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeper";

describe("formatMarchFormTroopMarginResidualDeepLine (CLIENT-269)", () => {
  it("stacks deep consolidate line on CLIENT-253 residual", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const deep = formatMarchFormTroopMarginResidualDeepLine(
      reserve,
      { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 120 },
      { food: 500 },
    );
    expect(deep?.line).toContain("出征后城内余");
    expect(deep?.subline).toContain("途粮估算 120（不扣粮）");
    expect(deep?.deepLine).toContain("余量深对照");
    expect(deep?.deepLine).toContain("出征后余 60");
    expect(deep?.deepLine).toContain("粮持");
    expect(deep?.deepLine).toContain("途粮估算 120（不扣粮）");
  });

  it.each([3, 400, 5000])("preserves the estimate through every deeper wrapper with %i held", (food) => {
    const wallet = { food };
    const summary = formatMarchFormSummary({
      toXRaw: "160", toYRaw: "60", marchCountRaw: "200", heroIdRaw: "1",
      unitCfgId: 1, cityX: 60, cityY: 60, wallet,
    }, 0);
    const result = formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(
      formatMarchFormTroopReserveLine(200, 300), summary, wallet,
    )!;
    expect(result.line).toBe("兵力余量 · 出征后城内余 100");
    expect(result.hasWarn).toBe(food < 400);
    const { line: _line, hasWarn: _hasWarn, ...foodLines } = result;
    expect(Object.keys(foodLines)).toHaveLength(9);
    for (const line of Object.values(foodLines)) {
      expect(line).toContain("途粮估算 400（不扣粮）");
      expect(line).not.toMatch(/粮余量不足|途耗/);
    }
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
