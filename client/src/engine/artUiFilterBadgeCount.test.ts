import { describe, expect, it } from "vitest";
import { formatUiFilterBadgeCount } from "@/engine/artUiFilterBadgeCount";

describe("formatUiFilterBadgeCount", () => {
  it("hides zero", () => {
    expect(formatUiFilterBadgeCount(0)).toBe("");
    expect(formatUiFilterBadgeCount(-1)).toBe("");
  });

  it("shows 1–9 literally", () => {
    expect(formatUiFilterBadgeCount(1)).toBe("1");
    expect(formatUiFilterBadgeCount(9)).toBe("9");
  });

  it("caps at 9+ without 99+", () => {
    expect(formatUiFilterBadgeCount(10)).toBe("9+");
    expect(formatUiFilterBadgeCount(99)).toBe("9+");
    expect(formatUiFilterBadgeCount(100)).toBe("9+");
  });
});
