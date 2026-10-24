import { describe, expect, it } from "vitest";
import { formatRecruitWalletCompareResidualLine } from "@/net/recruitWalletCompareResidual";

describe("formatRecruitWalletCompareResidualLine (CLIENT-242)", () => {
  it("mirrors list sweep line under compare line", () => {
    const residual = formatRecruitWalletCompareResidualLine(
      { gold: 5 },
      { recruit_cost: { gold: 10 } },
      [],
    );
    expect(residual?.hasDeficit).toBe(true);
    expect(residual?.text).toContain("列表口径");
    expect(residual?.text).toContain("币 余5/需10");
  });

  it("returns null without template cost", () => {
    expect(formatRecruitWalletCompareResidualLine({ gold: 1 }, undefined, [])).toBeNull();
  });
});
