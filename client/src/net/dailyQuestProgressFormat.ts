import { itemLabel, questStateLabel } from "@/net/contentFormat";
import { dailyObjectiveLabelForQuest } from "@/net/dailyQuestObjective";
import {
  DAILY_QUEST_STATE_COMPLETED,
  DAILY_QUEST_STATE_IN_PROGRESS,
} from "@/net/dailyQuestListFilter";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import { DAILY_QUEST_PROGRESS_SECONDARY_CLASS } from "@/engine/filterListNarrowManifest";
import {
  DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS,
  formatQuestChainTypeSubline,
} from "@/net/questChainTypeSubline";

export const DAILY_QUEST_PROGRESS_BAR_CLASS = "daily-quest-progress";
export const DAILY_QUEST_PROGRESS_FILL_CLASS = "daily-quest-progress-fill";
export const DAILY_QUEST_REWARD_LINE_CLASS = "daily-quest-row-reward";

/** DATA-002 chain 400 任务首项道具奖励（cfg_quest.rewards.items[0]）。 */
const DAILY_QUEST_ITEM_REWARD_BY_CFG_ID: Record<number, { reward_item_id: number; quantity: number }> =
  {
    1014: { reward_item_id: 2003, quantity: 1 },
    1032: { reward_item_id: 2011, quantity: 1 },
    1033: { reward_item_id: 2042, quantity: 1 },
  };

const DAILY_QUEST_ITEM_REWARD_BY_CODE: Record<string, { reward_item_id: number; quantity: number }> =
  {
    daily_train_1: { reward_item_id: 2003, quantity: 1 },
    daily_build_1: { reward_item_id: 2011, quantity: 1 },
    daily_march_1: { reward_item_id: 2042, quantity: 1 },
  };

/** 日常列表主行：标签 + cfg + 状态（进度放次行扫读）。 */
export function formatDailyQuestRowPrimary(q: DailyQuestRow): string {
  const tag = dailyObjectiveLabelForQuest(q);
  const id = q.quest_cfg_id ?? "?";
  const code = q.quest_code ?? "";
  return `[${tag}] #${id} ${code} · ${questStateLabel(q.state)}`;
}

/** chain 400 次行进度文案（ListPlayerQuests 快照，不新 RPC）。 */
export function formatDailyQuestProgressSecondary(q: DailyQuestRow): string | null {
  const state = q.state ?? 0;
  const target = q.progress_target ?? 0;
  if (state === DAILY_QUEST_STATE_COMPLETED) {
    if (target > 0) {
      return `链进度 ${target}/${target} · 已完成`;
    }
    return "已完成";
  }
  if (target <= 0) return null;
  const current = q.progress_current ?? 0;
  const base = `链进度 ${current}/${target}`;
  if (state === DAILY_QUEST_STATE_CLAIMABLE) {
    return `${base} · 可领取`;
  }
  if (state === DAILY_QUEST_STATE_IN_PROGRESS) {
    return base;
  }
  return base;
}

function resolveDailyQuestItemReward(
  q: DailyQuestRow,
): { reward_item_id: number; quantity: number } | null {
  const rowId = q.reward_item_id ?? 0;
  const rowQty = q.quantity ?? 0;
  if (rowId > 0 && rowQty > 0) {
    return { reward_item_id: rowId, quantity: rowQty };
  }
  const id = q.quest_cfg_id ?? 0;
  if (id > 0 && DAILY_QUEST_ITEM_REWARD_BY_CFG_ID[id]) {
    return DAILY_QUEST_ITEM_REWARD_BY_CFG_ID[id];
  }
  const code = q.quest_code?.trim();
  if (code && DAILY_QUEST_ITEM_REWARD_BY_CODE[code]) {
    return DAILY_QUEST_ITEM_REWARD_BY_CODE[code];
  }
  return null;
}

/** 奖励道具只读摘要（无道具奖励时返回 null）。 */
export function formatDailyQuestRewardLine(q: DailyQuestRow): string | null {
  const reward = resolveDailyQuestItemReward(q);
  if (!reward) return null;
  return `奖励 ${itemLabel(reward.reward_item_id)}×${reward.quantity}`;
}

/** 0–100；target≤0 时为 null。 */
export function clampDailyQuestProgressPercent(
  progressCurrent: number,
  progressTarget: number,
): number | null {
  if (progressTarget <= 0) return null;
  const raw = (progressCurrent / progressTarget) * 100;
  if (!Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/** 日常列表行次行：进度文案 + 细进度条 + 奖励道具摘要。 */
export function appendDailyQuestRowSecondary(li: HTMLElement, q: DailyQuestRow): void {
  const text = formatDailyQuestProgressSecondary(q);
  const percent = clampDailyQuestProgressPercent(q.progress_current ?? 0, q.progress_target ?? 0);
  const rewardLine = formatDailyQuestRewardLine(q);
  if (!text && percent == null && !rewardLine) return;

  const wrap = document.createElement("span");
  wrap.className = `daily-quest-row-secondary ${DAILY_QUEST_PROGRESS_SECONDARY_CLASS}`;

  const chainSubline =
    (q.state ?? 0) === DAILY_QUEST_STATE_CLAIMABLE ? formatQuestChainTypeSubline(q) : null;
  if (chainSubline) {
    const chainSpan = document.createElement("span");
    chainSpan.className = DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS;
    chainSpan.textContent = chainSubline;
    wrap.appendChild(chainSpan);
  }

  if (text) {
    const textSpan = document.createElement("span");
    textSpan.className = "daily-quest-row-progress-text";
    textSpan.textContent = text;
    wrap.appendChild(textSpan);
  }

  if (percent != null) {
    const bar = document.createElement("span");
    bar.className = DAILY_QUEST_PROGRESS_BAR_CLASS;
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(percent));
    const fill = document.createElement("span");
    fill.className = DAILY_QUEST_PROGRESS_FILL_CLASS;
    fill.style.width = `${percent}%`;
    bar.appendChild(fill);
    wrap.appendChild(bar);
  }

  if (rewardLine) {
    const rewardSpan = document.createElement("span");
    rewardSpan.className = DAILY_QUEST_REWARD_LINE_CLASS;
    rewardSpan.textContent = rewardLine;
    wrap.appendChild(rewardSpan);
  }

  li.appendChild(wrap);
}
