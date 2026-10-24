import { describe, expect, it } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import {
  formatMarchIntelRemarchResidualSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidual,
} from "@/net/marchIntelRemarchResidual";

describe("prefillMarchFormFromIntelResidual (CLIENT-258)", () => {
  const march: MarchSummary = {
    march_id: 3,
    to_x: 8,
    to_y: 9,
    troops: [{ unit_cfg_id: 1, count: 40 }],
  };

  it("formatMarchIntelRemarchResidualSummary joins coord and troop read-only parts", () => {
    const line = formatMarchIntelRemarchResidualSummary({
      toX: 8,
      toY: 9,
      lastTroopsSummary: "上次兵力：步兵×40",
    });
    expect(line).toBe("再出征只读 · 目标 (8,9) · 步兵×40");
  });

  it("prefills form coords and residual summary line", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input data-field="to-x" value="0" />
      <input data-field="to-y" value="0" />
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE}" class="hidden"></p>
    `;
    const prefill = prefillMarchFormFromIntelResidual(root, march);
    expect(prefill).toMatchObject({ toX: 8, toY: 9 });
    expect(root.querySelector<HTMLInputElement>('[data-field="to-x"]')!.value).toBe("8");
    expect(root.querySelector<HTMLInputElement>('[data-field="to-y"]')!.value).toBe("9");
    const summary = root.querySelector(`[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE}"]`);
    expect(summary?.textContent).toContain("目标 (8,9)");
    expect(summary?.classList.contains("hidden")).toBe(false);
  });
});
