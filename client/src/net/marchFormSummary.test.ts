import { describe, expect, it } from "vitest";
import {
  chebyshevGridDistance,
  estimateMarchFoodCost,
  formatMarchFormSummary,
  marchDurationSecFromDistance,
  readMarchFormSnapshot,
  setMarchFormSummaryDisplay,
  syncMarchFormInlineFeedback,
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
    expect(ok.resourceWarnLine).toContain("粮持有量低于途粮估算");

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

  it.each([3, 400, 5000])("labels food as a non-debit estimate with %i held", (food) => {
    const result = formatMarchFormSummary(
      {
        toXRaw: "160", toYRaw: "60", marchCountRaw: "200", heroIdRaw: "1",
        unitCfgId: 1, cityX: 60, cityY: 60, wallet: { food },
      },
      0,
    );
    expect(result.estimatedFoodCost).toBe(400);
    expect(result.summaryLine).toBe(
      "出征汇总：目标 (160,60) · 步兵×200 · 剩余 120m · 途粮约 400（仅估算，当前出征不扣粮）",
    );
    expect(result.resourceWarn).toBe(food < 400);
    expect(result.resourceWarnLine).toBe(
      food < 400 ? "粮持有量低于途粮估算（约 400，持 3）" : null,
    );
  });

  it("keeps the warning informational and clears it when the wallet reaches the estimate", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input data-field="to-x" value="160" /><input data-field="to-y" value="60" />
      <input data-field="march-count" value="200" />
      <select data-field="march-hero"><option value="1" selected>将领</option></select>
      <p data-role="march-form-summary"></p>
      <p data-role="march-form-summary-warn" class="hidden"></p>
      <p data-role="march-form-error" class="hidden"></p>
    `;
    const summary = root.querySelector('[data-role="march-form-summary"]')!;
    const warning = root.querySelector('[data-role="march-form-summary-warn"]')!;
    for (const food of [3, 400, 3]) {
      syncMarchFormInlineFeedback(root, {
        cityX: 60, cityY: 60, cityTroops: [{ unit_cfg_id: 1, count: 300 }],
        ownedHeroes: [{ hero_id: 1, template_cfg_id: 1001, status: 1 }],
        wallet: { food }, clockMs: 0,
      });
      expect(summary.textContent).toContain("仅估算，当前出征不扣粮");
      expect(summary.classList.contains("resource-warn")).toBe(food < 400);
      expect(warning.classList.contains("hidden")).toBe(food >= 400);
      expect(warning.textContent).toBe(
        food < 400 ? "粮持有量低于途粮估算（约 400，持 3）" : "",
      );
      expect(root.querySelector('[data-role="march-form-error"]')?.textContent).toBe("");
    }
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
      <select data-field="march-hero"><option value="1" selected>将领</option></select>
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

  it("syncMarchFormInlineFeedback refreshes summary and march-form-error on prefill", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input data-field="to-x" value="60" />
      <input data-field="to-y" value="60" />
      <input data-field="march-count" value="50" />
      <select data-field="march-hero"><option value="1" selected>将领</option></select>
      <p data-role="march-form-summary"></p>
      <p class="hidden" data-role="march-form-error"></p>
    `;
    syncMarchFormInlineFeedback(root, {
      cityX: 60,
      cityY: 60,
      cityTroops: [{ unit_cfg_id: 1, count: 100 }],
      ownedHeroes: [{ hero_id: 1, template_cfg_id: 1001, status: 1 }],
      clockMs: 0,
    });
    expect(root.querySelector('[data-role="march-form-error"]')?.textContent).toContain(
      "不能与己方城池同格",
    );
  });
});
