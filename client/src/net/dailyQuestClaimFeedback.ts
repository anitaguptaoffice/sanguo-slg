import type { DailyQuestRow } from "@/net/dailyQuestState";
import {
  pickFirstClaimableDailyQuestCfgIdForFilter,
  type DailyQuestListFilter,
} from "@/net/dailyQuestListFilter";
import { pickFirstClaimableDailyQuestCfgId } from "@/net/hudCenterTodo";

export const DAILY_QUEST_CLAIMABLE_ROW_CLASS = "daily-quest-claimable";
export const QUEST_CLAIM_PULSE_CLASS = "quest-claim-pulse";
/** CLIENT-123：与行九宫皮肤并存的领奖脉冲类名。 */
export const DAILY_QUEST_CLAIM_PULSE_CLASS = "daily-quest-claim-pulse";
/** 领奖次行/进度条脉冲（CLIENT-233，与 CLIENT-174 进度条并存）。 */
export const QUEST_CLAIM_PROGRESS_PULSE_CLASS = "quest-claim-progress-pulse";
/** 领奖行脉冲时长（≤2s，与 HUD resource-pulse 并存）。 */
export const QUEST_CLAIM_PULSE_MS = 1200;
export const QUEST_CLAIM_PROGRESS_PULSE_MS = 1000;

export function scheduleQuestClaimRowPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(QUEST_CLAIM_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(QUEST_CLAIM_PULSE_CLASS, DAILY_QUEST_CLAIM_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(QUEST_CLAIM_PULSE_CLASS, DAILY_QUEST_CLAIM_PULSE_CLASS);
  }, QUEST_CLAIM_PULSE_MS);
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

/** 可领取首条 quest_cfg_id：「可领取」筛选用 CLIENT-091 排序，否则当前链列表顺序。 */
export function pickQuestCfgIdForClaimableScroll(
  rows: DailyQuestRow[],
  listFilter: DailyQuestListFilter,
): number {
  if (listFilter === "claimable") {
    return pickFirstClaimableDailyQuestCfgIdForFilter(rows);
  }
  return pickFirstClaimableDailyQuestCfgId(rows);
}

/** CLIENT-233：打开日常或定位时，将首条可领取行滚入视区（不退化 CLIENT-091 筛选语义）。 */
export function scrollQuestClaimableIntoView(
  panelRoot: ParentNode,
  rows: DailyQuestRow[],
  listFilter: DailyQuestListFilter,
): boolean {
  const id = pickQuestCfgIdForClaimableScroll(rows, listFilter);
  return scrollDailyQuestRowIntoView(panelRoot, id);
}

export function findDailyQuestRowSecondary(
  panelRoot: ParentNode,
  questCfgId: number,
): HTMLElement | null {
  if (questCfgId <= 0) return null;
  const row = panelRoot.querySelector<HTMLElement>(`li[data-quest-cfg-id="${questCfgId}"]`);
  return row?.querySelector<HTMLElement>(".daily-quest-row-secondary") ?? null;
}

export function scheduleQuestClaimProgressPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(QUEST_CLAIM_PROGRESS_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(QUEST_CLAIM_PROGRESS_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(QUEST_CLAIM_PROGRESS_PULSE_CLASS);
  }, QUEST_CLAIM_PROGRESS_PULSE_MS);
}

export function pulseDailyQuestClaimProgress(panelRoot: ParentNode, questCfgId: number): void {
  scheduleQuestClaimProgressPulse(findDailyQuestRowSecondary(panelRoot, questCfgId));
}
