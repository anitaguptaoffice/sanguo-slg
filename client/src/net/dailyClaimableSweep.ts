import { clampDailyQuestProgressPercent } from "@/net/dailyQuestProgressFormat";
import {
  countClaimableDailyQuests,
  pickFirstClaimableDailyQuestCfgId,
} from "@/net/hudCenterTodo";
import type { DailyQuestRow } from "@/net/dailyQuestState";

export const DAILY_CLAIMABLE_SWEEP_CLASS = "daily-claimable-sweep";
export const DAILY_CLAIM_PROGRESS_PULSE_CLASS = "daily-claim-progress-pulse";
export const DAILY_CLAIM_PROGRESS_PULSE_MS = 1000;

function findDailyQuestRow(rows: DailyQuestRow[], questCfgId: number): DailyQuestRow | null {
  if (questCfgId <= 0) return null;
  return rows.find((r) => (r.quest_cfg_id ?? 0) === questCfgId) ?? null;
}

/**
 * 日常面板顶栏：可领取条数 + 首条 quest_cfg_id 进度百分比（ListPlayerQuests 快照，不新 RPC）。
 */
export function formatDailyClaimableSweepLine(rows: DailyQuestRow[]): string | null {
  const claimable = countClaimableDailyQuests(rows);
  if (claimable <= 0) return null;
  const firstId = pickFirstClaimableDailyQuestCfgId(rows);
  const first = findDailyQuestRow(rows, firstId);
  const base = `可领 ${claimable}`;
  if (!first || firstId <= 0) return base;
  const percent = clampDailyQuestProgressPercent(
    first.progress_current ?? 0,
    first.progress_target ?? 0,
  );
  if (percent == null) return `${base} · #${firstId}`;
  return `${base} · #${firstId} 进度 ${percent}%`;
}

export function scheduleDailyClaimProgressSweepPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(DAILY_CLAIM_PROGRESS_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(DAILY_CLAIM_PROGRESS_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(DAILY_CLAIM_PROGRESS_PULSE_CLASS);
  }, DAILY_CLAIM_PROGRESS_PULSE_MS);
}
