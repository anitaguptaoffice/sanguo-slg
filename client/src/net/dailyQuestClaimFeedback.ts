export const DAILY_QUEST_CLAIMABLE_ROW_CLASS = "daily-quest-claimable";
export const QUEST_CLAIM_PULSE_CLASS = "quest-claim-pulse";
/** 领奖行脉冲时长（≤2s，与 HUD resource-pulse 并存）。 */
export const QUEST_CLAIM_PULSE_MS = 1200;

export function scheduleQuestClaimRowPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(QUEST_CLAIM_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(QUEST_CLAIM_PULSE_CLASS);
  window.setTimeout(() => row.classList.remove(QUEST_CLAIM_PULSE_CLASS), QUEST_CLAIM_PULSE_MS);
}

export function scrollDailyQuestRowIntoView(
  panelRoot: ParentNode,
  questCfgId: number,
): boolean {
  if (questCfgId <= 0) return false;
  const row = panelRoot.querySelector<HTMLElement>(`li[data-quest-cfg-id="${questCfgId}"]`);
  if (!row || typeof row.scrollIntoView !== "function") return false;
  row.scrollIntoView({ block: "nearest" });
  return true;
}
