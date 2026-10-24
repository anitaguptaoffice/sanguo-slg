import { describe, expect, it } from "vitest";
import { formatBuildUpgradeCostLine } from "@/net/buildUpgradeCostLine";

describe("formatBuildUpgradeCostLine", () => {
  it("marks deficient resources with resource-deficit", () => {
    const { textLine, htmlLine } = formatBuildUpgradeCostLine(
      2,
      { food: 80, wood: 240, stone: 48, iron: 0 },
      { food: 10_000, wood: 100, stone: 10_000, iron: 0 },
      { timeSec: 67 },
    );
    expect(textLine).toContain("升至 Lv2");
    expect(textLine).toContain("木 240");
    expect(htmlLine).toContain('class="build-cost-segment resource-deficit">木 240</span>');
    expect(htmlLine).toContain('class="build-cost-segment">粮 80</span>');
    expect(textLine).toContain("耗时 1:07");
  });

  it("uses plain segments when wallet covers cost", () => {
    const { htmlLine } = formatBuildUpgradeCostLine(
      2,
      { food: 80, wood: 240, stone: 48, iron: 0 },
      { food: 10_000, wood: 10_000, stone: 10_000, iron: 0 },
    );
    expect(htmlLine).not.toContain("resource-deficit");
  });
});
