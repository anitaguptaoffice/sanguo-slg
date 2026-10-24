import type { ContentFormValidationResult } from "@/net/contentFormValidation";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import { DAILY_QUEST_STATE_COMPLETED } from "@/net/dailyQuestListFilter";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";

/** 单次批量最多领取条数（逐条 ClaimQuestReward，与 CLIENT-087 邮件上限对齐）。 */
export const BATCH_CLAIM_DAILY_CAP = 20;

export type DailyBatchClaimStepResult = { ok: true } | { ok: false; message: string };

export type DailyBatchClaimSummary = {
  successCount: number;
  failureCount: number;
  summaryText: string;
  lastError: string | null;
};

/** 列表顺序下全部可领奖 quest_cfg_id（state=3）。 */
export function orderBatchClaimDailyQuestIds(rows: DailyQuestRow[]): number[] {
  const ordered: number[] = [];
  for (const q of rows) {
    if ((q.state ?? 0) !== DAILY_QUEST_STATE_CLAIMABLE) continue;
    const id = q.quest_cfg_id ?? 0;
    if (id > 0) ordered.push(id);
  }
  return ordered;
}

export function validateBatchClaimDailySelection(rows: DailyQuestRow[]): ContentFormValidationResult {
  const ids = orderBatchClaimDailyQuestIds(rows);
  if (!ids.length) {
    return { ok: false, message: "当前无 chain 400 可领取日常" };
  }
  if (ids.length > BATCH_CLAIM_DAILY_CAP) {
    return { ok: false, message: `单次最多批量领取 ${BATCH_CLAIM_DAILY_CAP} 条日常` };
  }
  return { ok: true };
}

/** 领取成功后局部合并行态（批量路径避免整表重拉前角标滞后）。 */
export function applyDailyQuestRowAfterClaim(
  rows: DailyQuestRow[],
  questCfgId: number,
  patch?: Partial<DailyQuestRow>,
): DailyQuestRow[] {
  return rows.map((q) => {
    if ((q.quest_cfg_id ?? 0) !== questCfgId) return q;
    const target = patch?.progress_target ?? q.progress_target;
    return {
      ...q,
      ...patch,
      state: patch?.state ?? DAILY_QUEST_STATE_COMPLETED,
      progress_current: patch?.progress_current ?? target ?? q.progress_current,
      progress_target: target,
    };
  });
}

export function dailyBatchClaimSummary(results: DailyBatchClaimStepResult[]): DailyBatchClaimSummary {
  let successCount = 0;
  let failureCount = 0;
  let lastError: string | null = null;
  for (const r of results) {
    if (r.ok) successCount += 1;
    else {
      failureCount += 1;
      lastError = r.message;
    }
  }
  const parts: string[] = [];
  parts.push(`批量领取：成功 ${successCount} 条日常`);
  if (failureCount > 0) {
    parts.push(`失败 ${failureCount} 条`);
    if (lastError) parts.push(`末条 ${lastError}`);
  }
  return {
    successCount,
    failureCount,
    summaryText: parts.join(" · "),
    lastError: failureCount > 0 ? lastError : null,
  };
}
