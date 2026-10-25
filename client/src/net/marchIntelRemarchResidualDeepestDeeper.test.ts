import { describe, expect, it } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import { MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidual";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeep";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeeper";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeepest";
import {
  formatMarchIntelRemarchResidualDeepestDeeperSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeepestDeeper,
} from "@/net/marchIntelRemarchResidualDeepestDeeper";

describe("prefillMarchFormFromIntelResidualDeepestDeeper (CLIENT-322)", () => {
  const march: MarchSummary = {
    march_id: 4,
    to_x: 8,
    to_y: 9,
    troops: [{ unit_cfg_id: 1, count: 40 }],
  };

  it("formatMarchIntelRemarchResidualDeepestDeeperSummary extends CLIENT-306 deepest line", () => {
    const line = formatMarchIntelRemarchResidualDeepestDeeperSummary({
      toX: 8,
      toY: 9,
      lastTroopsSummary: "上次兵力：步兵×40",
    });
    expect(line).toContain("巩固再加深二层");
    expect(line).toContain("巩固再加深一层");
    expect(line).toContain("目标 (8,9)");
    expect(line).toContain("步兵×40");
  });

  it("prefills form coords, residual through deepest summaries, and deepest-deeper summary line", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input data-field="to-x" value="0" />
      <input data-field="to-y" value="0" />
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE}" class="hidden"></p>
    `;
    const prefill = prefillMarchFormFromIntelResidualDeepestDeeper(root, march, undefined, null, {
      line: "兵力余量 · 出征后城内余 10",
      subline: "钱包粮 持 100",
      hasWarn: false,
    });
    expect(prefill).toMatchObject({ toX: 8, toY: 9 });
    const deepestDeeper = root.querySelector(
      `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE}"]`,
    );
    expect(deepestDeeper?.textContent).toContain("巩固再加深二层");
    expect(deepestDeeper?.textContent).toContain("兵力余量");
    expect(deepestDeeper?.classList.contains("hidden")).toBe(false);
  });
});
