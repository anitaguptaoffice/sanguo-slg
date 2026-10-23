import { describe, expect, it } from "vitest";
import {
  DAILY_BATTLE_REPORT_BANNER_TEXT,
  shouldShowDailyBattleReportBanner,
} from "@/net/dailyQuestBattleReportBanner";

describe("dailyQuestBattleReportBanner", () => {
  it("shows banner only when CLIENT-025 unread count is positive", () => {
    expect(shouldShowDailyBattleReportBanner(0)).toBe(false);
    expect(shouldShowDailyBattleReportBanner(-1)).toBe(false);
    expect(shouldShowDailyBattleReportBanner(1)).toBe(true);
    expect(shouldShowDailyBattleReportBanner(3)).toBe(true);
  });

  it("uses fixed banner copy", () => {
    expect(DAILY_BATTLE_REPORT_BANNER_TEXT).toBe("有未读战报，点击查看");
  });
});
