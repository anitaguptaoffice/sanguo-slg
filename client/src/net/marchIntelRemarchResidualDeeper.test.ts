import { describe, expect, it } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import { MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidual";
import {
  MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE,
} from "@/net/marchIntelRemarchResidualDeep";
import {
  formatMarchIntelRemarchResidualDeeperSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeeper,
} from "@/net/marchIntelRemarchResidualDeeper";

describe("prefillMarchFormFromIntelResidualDeeper (CLIENT-290)", () => {
  const march: MarchSummary = {
    march_id: 3,
    to_x: 8,
    to_y: 9,
    troops: [{ unit_cfg_id: 1, count: 40 }],
  };

  it("formatMarchIntelRemarchResidualDeeperSummary extends CLIENT-274 deep line", () => {
    const line = formatMarchIntelRemarchResidualDeeperSummary({
      toX: 8,
      toY: 9,
      lastTroopsSummary: "上次兵力：步兵×40",
    });
    expect(line).toContain("巩固再加深");
    expect(line).toContain("巩固加深");
    expect(line).toContain("目标 (8,9)");
    expect(line).toContain("步兵×40");
  });

  it("prefills form coords, residual/deep summaries, and deeper summary line", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input data-field="to-x" value="0" />
      <input data-field="to-y" value="0" />
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE}" class="hidden"></p>
    `;
    const prefill = prefillMarchFormFromIntelResidualDeeper(root, march, undefined, null, {
      line: "兵力余量 · 出征后城内余 10",
      subline: "钱包粮 持 100",
      hasWarn: false,
    });
    expect(prefill).toMatchObject({ toX: 8, toY: 9 });
    const residual = root.querySelector(`[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE}"]`);
    const deep = root.querySelector(`[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE}"]`);
    const deeper = root.querySelector(
      `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE}"]`,
    );
    expect(residual?.textContent).toContain("目标 (8,9)");
    expect(deep?.textContent).toContain("巩固加深");
    expect(deeper?.textContent).toContain("巩固再加深");
    expect(deeper?.textContent).toContain("兵力余量");
    expect(deeper?.classList.contains("hidden")).toBe(false);
  });
});
