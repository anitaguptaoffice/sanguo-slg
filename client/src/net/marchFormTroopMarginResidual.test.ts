import { describe, expect, it } from "vitest";
import {
  formatMarchFormTroopMarginResidualLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_WARN_CLASS,
  syncMarchFormTroopMarginResidualLine,
} from "@/net/marchFormTroopMarginResidual";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";

describe("formatMarchFormTroopMarginResidualLine (CLIENT-253)", () => {
  it("builds troop margin warn line and wallet food subline", () => {
    const reserve = formatMarchFormTroopReserveLine(120, 100);
    const residual = formatMarchFormTroopMarginResidualLine(
      reserve,
      { summaryLine: "", resourceWarn: true, resourceWarnLine: "x", estimatedFoodCost: 500 },
      { food: 200 },
    );
    expect(residual?.line).toContain("兵力余量警示");
    expect(residual?.subline).toContain("持");
    expect(residual?.subline).toBe("钱包粮 持 200 / 途粮估算 500（不扣粮）");
    expect(residual?.hasWarn).toBe(true);
  });

  it("shows post-march margin when troops sufficient", () => {
    const reserve = formatMarchFormTroopReserveLine(40, 100);
    const residual = formatMarchFormTroopMarginResidualLine(
      reserve,
      { summaryLine: "", resourceWarn: false, resourceWarnLine: null, estimatedFoodCost: 0 },
      { food: 10_000 },
    );
    expect(residual?.line).toContain("出征后城内余 60");
    expect(residual?.hasWarn).toBe(false);
  });

  it("syncMarchFormTroopMarginResidualLine toggles warn class", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p class="hidden" data-role="march-form-troop-margin-residual-line">
        <span data-role="march-form-troop-margin-residual-primary"></span>
        <span data-role="march-form-troop-margin-residual-subline"></span>
      </p>
    `;
    const line = root.querySelector('[data-role="march-form-troop-margin-residual-line"]')!;
    syncMarchFormTroopMarginResidualLine(root, {
      line: "兵力余量警示",
      subline: "钱包粮",
      hasWarn: true,
    });
    expect(line.classList.contains("hidden")).toBe(false);
    expect(line.classList.contains(MARCH_FORM_TROOP_MARGIN_RESIDUAL_WARN_CLASS)).toBe(true);
    syncMarchFormTroopMarginResidualLine(root, null);
    expect(line.classList.contains("hidden")).toBe(true);
  });
});
