import { describe, expect, it } from "vitest";
import { formatRecruitWalletCompareLine } from "@/net/recruitWalletCompare";

describe("formatRecruitWalletCompareLine (CLIENT-215)", () => {
  it("shows need vs hold side by side for resources and items", () => {
    const line = formatRecruitWalletCompareLine(
      { gold: 5, food: 100 },
      {
        recruit_cost: { gold: 10, food: 80 },
        recruit_item: { item_cfg_id: 2017, quantity: 2 },
      },
      [{ item_cfg_id: 2017, quantity: 1 }],
    );
    expect(line?.hasDeficit).toBe(true);
    expect(line?.text).toContain("币 需10 | 持5不足");
    expect(line?.text).toContain("粮 需80 | 持100✓");
    expect(line?.text).toContain("将魂碎晶 需2 | 持1不足");
  });

  it("returns null when template has no cost lines", () => {
    expect(formatRecruitWalletCompareLine({ gold: 1 }, {}, [])).toBeNull();
    expect(formatRecruitWalletCompareLine({ gold: 1 }, undefined, [])).toBeNull();
  });

  it("marks sufficient when wallet and bag cover template", () => {
    const line = formatRecruitWalletCompareLine(
      { gold: 50 },
      { recruit_cost: { gold: 10 } },
      [],
    );
    expect(line?.hasDeficit).toBe(false);
    expect(line?.text).toBe("币 需10 | 持50✓");
  });
});
