import { describe, expect, it } from "vitest";
import { formatRecruitWalletSweepLine } from "@/net/recruitWalletSweep";

describe("formatRecruitWalletSweepLine", () => {
  it("compares gold and item vs wallet/bag with deficit flag", () => {
    const line = formatRecruitWalletSweepLine(
      { gold: 5, food: 100 },
      {
        recruit_cost: { gold: 10, food: 80 },
        recruit_item: { item_cfg_id: 2017, quantity: 2 },
      },
      [{ item_cfg_id: 2017, quantity: 1 }],
    );
    expect(line.hasDeficit).toBe(true);
    expect(line.text).toContain("币 余5/需10不足");
    expect(line.text).toContain("粮 余100/需80✓");
    expect(line.text).toContain("将魂碎晶 余1/需2不足");
  });

  it("marks hasDeficit false when wallet and bag cover cost", () => {
    const line = formatRecruitWalletSweepLine(
      { gold: 50 },
      { recruit_cost: { gold: 10 } },
      [],
    );
    expect(line.hasDeficit).toBe(false);
    expect(line.text).toContain("币 余50/需10✓");
  });
});
