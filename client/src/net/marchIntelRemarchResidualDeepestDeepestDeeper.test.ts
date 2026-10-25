import { describe, expect, it } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import { MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidual";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeep";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeeper";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeepest";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeepestDeeper";
import {
  formatMarchIntelRemarchResidualDeepestDeepestDeeperSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeepestDeepestDeeper,
} from "@/net/marchIntelRemarchResidualDeepestDeepestDeeper";

describe("prefillMarchFormFromIntelResidualDeepestDeepestDeeper (CLIENT-338)", () => {
  const march: MarchSummary = {
    march_id: 4,
    to_x: 8,
    to_y: 9,
    troops: [{ unit_cfg_id: 1, count: 40 }],
  };

  it("formatMarchIntelRemarchResidualDeepestDeepestDeeperSummary extends CLIENT-322 deepest-deeper line", () => {
    const line = formatMarchIntelRemarchResidualDeepestDeepestDeeperSummary({
      toX: 8,
      toY: 9,
      lastTroopsSummary: "上次兵力：步兵×40",
    });
    expect(line).toContain("巩固再加深三层");
    expect(line).toContain("巩固再加深二层");
    expect(line).toContain("目标 (8,9)");
    expect(line).toContain("步兵×40");
  });

  it("prefills form coords, residual through deepest-deeper summaries, and deepest-deepest-deeper summary line", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input data-field="to-x" value="0" />
      <input data-field="to-y" value="0" />
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}" class="hidden"></p>
    `;
    const prefill = prefillMarchFormFromIntelResidualDeepestDeepestDeeper(root, march, undefined, null, {
      line: "兵力余量 · 出征后城内余 10",
      subline: "钱包粮 持 100",
      hasWarn: false,
    });
    expect(prefill).toMatchObject({ toX: 8, toY: 9 });
    const deepestDeepestDeeper = root.querySelector(
      `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}"]`,
    );
    expect(deepestDeepestDeeper?.textContent).toContain("巩固再加深三层");
    expect(deepestDeepestDeeper?.textContent).toContain("兵力余量");
    expect(deepestDeepestDeeper?.classList.contains("hidden")).toBe(false);
  });
});
