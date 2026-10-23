import { describe, expect, it } from "vitest";
import {
  chebyshevGridDistance,
  estimateMarchFoodCost,
  formatMarchFormSummary,
  marchDurationSecFromDistance,
  readMarchFormSnapshot,
  setMarchFormSummaryDisplay,
} from "@/net/marchFormSummary";

describe("marchFormSummary", () => {
  it("chebyshevGridDistance matches server grid metric", () => {
    expect(chebyshevGridDistance(60, 60, 65, 60)).toBe(5);
    expect(chebyshevGridDistance(0, 0, 3, 4)).toBe(4);
  });

  it("marchDurationSecFromDistance uses M1 calibration at speed 50", () => {
    expect(marchDurationSecFromDistance(10, 50)).toBe(720);
    expect(marchDurationSecFromDistance(1, 50)).toBe(72);
  });

  it("formatMarchFormSummary shows target, troops, CLIENT-047 ETA, and resource warn", () => {
    const now = 1_000;
    const ok = formatMarchFormSummary(
      {
        toXRaw: "65",
        toYRaw: "60",
        marchCountRaw: "50",
        unitCfgId: 1,
        cityX: 60,
        cityY: 60,
        wallet: { food: 3 },
      },
      now,
    );
    expect(ok.summaryLine).toContain("目标 (65,60)");
    expect(ok.summaryLine).toContain("步兵×50");
    expect(ok.summaryLine).toContain("剩余 6m");
    expect(ok.summaryLine).toContain("途粮约");
    expect(ok.resourceWarn).toBe(true);
    expect(ok.resourceWarnLine).toContain("粮余量不足");

    const ample = formatMarchFormSummary(
      {
        toXRaw: "65",
        toYRaw: "60",
        marchCountRaw: "50",
        unitCfgId: 1,
        cityX: 60,
        cityY: 60,
        wallet: { food: 10_000 },
      },
      now,
    );
    expect(ample.resourceWarn).toBe(false);
    expect(ample.resourceWarnLine).toBeNull();
  });

  it("estimateMarchFoodCost scales with upkeep and duration", () => {
    expect(estimateMarchFoodCost(1, 50, 3600)).toBe(50);
    expect(estimateMarchFoodCost(1, 50, 3601)).toBe(100);
  });

  it("readMarchFormSnapshot and setMarchFormSummaryDisplay update DOM", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input data-field="to-x" value="8" />
      <input data-field="to-y" value="9" />
      <input data-field="march-count" value="20" />
      <p data-role="march-form-summary"></p>
      <p class="hidden" data-role="march-form-summary-warn"></p>
    `;
    const snap = readMarchFormSnapshot(root, { cityX: 60, cityY: 60, wallet: {} });
    expect(snap.toXRaw).toBe("8");
    expect(snap.marchCountRaw).toBe("20");

    const result = formatMarchFormSummary(snap, Date.now());
    setMarchFormSummaryDisplay(root, result);
    expect(root.querySelector('[data-role="march-form-summary"]')?.textContent).toContain(
      "出征汇总",
    );
  });
});
