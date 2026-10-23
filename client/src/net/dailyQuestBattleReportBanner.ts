/** 日常面板顶部战报未读联动横幅文案（CLIENT-044 / CLIENT-025 未读口径一致）。 */
export const DAILY_BATTLE_REPORT_BANNER_TEXT = "有未读战报，点击查看";

/** 是否展示日常面板战报未读横幅（纯函数，供单测与 UI 复用）。 */
export function shouldShowDailyBattleReportBanner(battleReportUnread: number): boolean {
  return battleReportUnread > 0;
}
