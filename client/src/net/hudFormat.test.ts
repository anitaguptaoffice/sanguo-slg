import { describe, expect, it } from "vitest";
import {
  formatKeyBuildingHudLine,
  formatResourceAmount,
  formatResourceHudGroup,
  formatUpgradeRemaining,
  formatUpgradeSummary,
  formatWalletGainBrief,
  walletResourceIncreases,
} from "@/net/hudFormat";

describe("hudFormat", () => {
  it("formats resource amounts with locale and wan/yi", () => {
    expect(formatResourceAmount(0)).toBe("0");
    expect(formatResourceAmount(1234)).toBe((1234).toLocaleString("zh-CN"));
    expect(formatResourceAmount(15000)).toBe("1.5万");
    expect(formatResourceAmount(120_000_000)).toBe("1.2亿");
  });

  it("summarizes wallet increases for HUD flash", () => {
    expect(walletResourceIncreases({ food: 100 }, { food: 250, wood: 10 })).toEqual({ food: 150, wood: 10 });
    expect(formatWalletGainBrief({ food: 100 }, { food: 100 })).toBeNull();
    expect(formatWalletGainBrief({ food: 100 }, { food: 1150, gold: 5 })).toBe("+粮1,050 +币5");
  });

  it("groups HUD wallet resources", () => {
    expect(formatResourceHudGroup({ food: 100, wood: 2000, gold: 50 })).toBe(
      "粮 100 · 木 2,000 · 铁 0 · 石 0 · 币 50",
    );
  });

  it("formats upgrade remaining and summary", () => {
    const now = 1_000_000;
    expect(formatUpgradeRemaining(now + 90_000, now)).toBe("剩 1:30");
    expect(formatUpgradeRemaining(now + 3_700_000, now)).toBe("剩 1:01:40");
    expect(formatUpgradeRemaining(now - 1, now)).toBeNull();
    const future = now + 60_000;
    expect(formatUpgradeSummary(future, now)).toMatch(/^剩 /);
  });

  it("formats key building HUD line", () => {
    const now = 5_000_000;
    const line = formatKeyBuildingHudLine(
      [
        { slot_key: "hall", level: 3 },
        { slot_key: "farm", level: 5, upgrade_finish_at_ms: now + 120_000 },
      ],
      { hall: "城主府", farm: "农田" },
      ["hall", "farm"],
      now,
    );
    expect(line).toContain("城主府 Lv3");
    expect(line).toContain("农田 Lv5");
    expect(line).toContain("剩 2:00");
  });
});
