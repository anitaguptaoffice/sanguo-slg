import { describe, expect, it } from "vitest";
import {
  formatMarchFormSummaryLine,
  formatMarchReadonlyLineFromMarch,
  resolveMarchFormReadonlyStripModel,
  syncMarchFormReadonlyStrip,
  MARCH_FORM_VIEW_INTEL_INFO_ACTION,
} from "@/net/marchFormReadonlyStrip";

describe("marchFormReadonlyStrip (CLIENT-178)", () => {
  it("formatMarchFormSummaryLine and march snapshot line", () => {
    const line = formatMarchFormSummaryLine(
      {
        toXRaw: "65",
        toYRaw: "60",
        marchCountRaw: "50",
        unitCfgId: 1,
        cityX: 60,
        cityY: 60,
        wallet: { food: 10_000 },
      },
      1_000,
    );
    expect(line).toContain("(65,60)");
    expect(line).not.toContain("途粮约");
    expect(formatMarchReadonlyLineFromMarch({ march_id: 7, to_x: 65, to_y: 60, phase: 2, arrive_at_ms: 361_000 }, 1_000)).toContain(
      "剩余",
    );
  });

  it("resolve + sync prefers intel march for jump", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input data-field="to-x" value="1" /><input data-field="to-y" value="2" />
      <input data-field="march-count" value="10" />
      <div data-role="march-form-readonly-strip">
        <p data-role="march-form-readonly-strip-line"></p>
        <button data-action="${MARCH_FORM_VIEW_INTEL_INFO_ACTION}"></button>
      </div>
    `;
    const model = resolveMarchFormReadonlyStripModel({
      intelSelectedMarch: { march_id: 3, to_x: 9, to_y: 9, phase: 2, arrive_at_ms: 120_000 },
      queueBannerMarchId: null,
      queueBannerMarch: null,
      formRoot: root,
      nowMs: 0,
    });
    expect(model.jumpMarchId).toBe(3);
    syncMarchFormReadonlyStrip(root, model);
    expect(root.querySelector("button")?.getAttribute("data-march-id")).toBe("3");
  });
});
