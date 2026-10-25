import { describe, expect, it } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import { MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidual";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeep";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeeper";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeepest";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeepestDeeper";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeepestDeepestDeeper";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeepestDeepestDeepest";
import { MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE } from "@/net/marchIntelRemarchResidualDeepestDeepestDeepestDeeper";
import {
  formatMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeepestDeepestDeepestDeepestDeeper,
} from "@/net/marchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeper";

describe("prefillMarchFormFromIntelResidualDeepestDeepestDeepestDeepestDeeper (CLIENT-386)", () => {
  const march: MarchSummary = {
    march_id: 4,
    to_x: 8,
    to_y: 9,
    troops: [{ unit_cfg_id: 1, count: 40 }],
  };

  it("formatMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary extends CLIENT-370 deepest-deepest-deepest-deeper line", () => {
    const line = formatMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary({
      toX: 8,
      toY: 9,
      lastTroopsSummary: "上次兵力：步兵×40",
    });
    expect(line).toContain("巩固再加深五层");
    expect(line).toMatch(/巩固再加深五层.*巩固再加深五层/);
    expect(line).toContain("目标 (8,9)");
    expect(line).toContain("步兵×40");
  });

  it("prefills form coords, residual through deepest-deepest-deepest-deeper summaries, and deepest-deepest-deepest-deepest-deeper summary line", () => {
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
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}" class="hidden"></p>
      <p data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}" class="hidden"></p>
    `;
    const prefill = prefillMarchFormFromIntelResidualDeepestDeepestDeepestDeepestDeeper(root, march, undefined, null, {
      line: "兵力余量 · 出征后城内余 10",
      subline: "钱包粮 持 100",
      hasWarn: false,
    });
    expect(prefill).toMatchObject({ toX: 8, toY: 9 });
    const deepestDeepestDeepestDeepestDeeper = root.querySelector(
      `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}"]`,
    );
    expect(deepestDeepestDeepestDeepestDeeper?.textContent).toContain("巩固再加深五层");
    expect(deepestDeepestDeepestDeepestDeeper?.textContent).toContain("兵力余量");
    expect(deepestDeepestDeepestDeepestDeeper?.classList.contains("hidden")).toBe(false);
  });
});
