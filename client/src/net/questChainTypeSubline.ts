import {
  clampDailyQuestProgressPercent,
  formatDailyQuestProgressSecondary,
} from "@/net/dailyQuestProgressFormat";
import { dailyQuestChainTabLabel } from "@/net/dailyQuestChainTab";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";
import { DAILY_QUEST_CHAIN_ID, type DailyQuestRow } from "@/net/dailyQuestState";

/** CLIENT-218：日常可领行 chain 类型只读次行。 */
export const DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS = "daily-quest-chain-type-subline";

/**
 * 可领日常行次行：chain 类型标签 + 进度摘要（ListPlayerQuests 快照，不新 RPC）。
 * 非可领行返回 null；CLIENT-174 进度条/奖励次行不退化。
 */
export function formatQuestChainTypeSubline(q: DailyQuestRow): string | null {
  const state = q.state ?? 0;
  if (state !== DAILY_QUEST_STATE_CLAIMABLE) return null;
  const chainId = q.chain_id ?? DAILY_QUEST_CHAIN_ID;
  const chainLabel = dailyQuestChainTabLabel(chainId);
  const progressText = formatDailyQuestProgressSecondary(q);
  if (progressText) return `${chainLabel} · ${progressText}`;
  const percent = clampDailyQuestProgressPercent(
    q.progress_current ?? 0,
    q.progress_target ?? 0,
  );
  if (percent != null) return `${chainLabel} · 进度 ${percent}%`;
  return chainLabel;
}
