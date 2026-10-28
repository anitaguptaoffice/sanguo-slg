// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatHudTodoSweepLine } from "@/net/hudTodoSweep";

describe("formatHudTodoSweepLine (CLIENT-193)", () => {
  it("merges mail attachment and daily claimable counts", () => {
    expect(formatHudTodoSweepLine({ mailClaimable: 2, dailyClaimable: 3 })).toBe(
      "邮件附件 2 · 日常可领 3",
    );
    expect(formatHudTodoSweepLine({ mailClaimable: 0, dailyClaimable: 1 })).toBe("日常可领 1");
    expect(formatHudTodoSweepLine({ mailClaimable: 4, dailyClaimable: 0 })).toBe("邮件附件 4");
    expect(formatHudTodoSweepLine({ mailClaimable: 0, dailyClaimable: 0 })).toBeNull();
  });
});
